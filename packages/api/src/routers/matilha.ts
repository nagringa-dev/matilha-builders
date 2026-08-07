import { db } from "@matilha-builders/db";
import { user } from "@matilha-builders/db/schema/auth";
import {
	checkIn,
	checkInDismissalVote,
	founder,
	product,
} from "@matilha-builders/db/schema/matilha";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, exists, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import {
	DISMISSAL_VOTE_THRESHOLD,
	MAX_PRODUCTS_PER_FOUNDER,
	PAGE_SIZE,
} from "../lib/constants";
import { fetchOgImage } from "../lib/og-image";
import { paginate } from "../lib/pagination";
import { normalizePhone } from "../lib/phone";
import {
	computeCurrentStreak,
	computeNextStreak,
	currentStreakSql,
	EDIT_WINDOW_MS,
} from "../lib/streak";
import { notifyCheckIn } from "../lib/whatsapp";

function hasProductWithStatus(
	founderUserId: typeof founder.userId,
	status: (typeof product.status.enumValues)[number]
) {
	return exists(
		db
			.select({ id: product.id })
			.from(product)
			.where(
				and(eq(product.founderId, founderUserId), eq(product.status, status))
			)
	);
}

async function requireOwnedProduct(productId: string, founderId: string) {
	const [row] = await db
		.select({ founderId: product.founderId, name: product.name })
		.from(product)
		.where(eq(product.id, productId))
		.limit(1);
	if (!row || row.founderId !== founderId) {
		throw new ORPCError("NOT_FOUND");
	}
	return row.name;
}

async function requireEditableCheckIn(checkInId: string, founderId: string) {
	const [row] = await db
		.select({
			createdAt: checkIn.createdAt,
			dismissedAt: checkIn.dismissedAt,
			founderId: checkIn.founderId,
		})
		.from(checkIn)
		.where(eq(checkIn.id, checkInId))
		.limit(1);
	if (!row || row.founderId !== founderId) {
		throw new ORPCError("NOT_FOUND");
	}
	if (row.dismissedAt) {
		throw new ORPCError("BAD_REQUEST", {
			message:
				"Esse check-in foi desconsiderado pela comunidade e não pode mais ser alterado.",
		});
	}
	if (Date.now() - row.createdAt.getTime() >= EDIT_WINDOW_MS) {
		throw new ORPCError("BAD_REQUEST", {
			message:
				"A janela de edição desse check-in fechou. Só dá pra editar nos 14 dias seguintes ao post.",
		});
	}
}

async function recomputeFounderStreak(founderId: string) {
	const remaining = await db
		.select({ createdAt: checkIn.createdAt })
		.from(checkIn)
		.where(and(eq(checkIn.founderId, founderId), isNull(checkIn.dismissedAt)))
		.orderBy(checkIn.createdAt);

	let streak = 0;
	let lastCheckInAt: Date | null = null;
	for (const row of remaining) {
		streak = computeNextStreak(streak, lastCheckInAt, row.createdAt);
		lastCheckInAt = row.createdAt;
	}

	await db
		.update(founder)
		.set({ lastCheckInAt, streak })
		.where(eq(founder.userId, founderId));
}

async function attachDismissalInfo<
	T extends { id: string; founderId: string; dismissedAt: Date | null },
>(items: T[], voterId: string) {
	const checkInIds = items.map((item) => item.id);
	if (checkInIds.length === 0) {
		return items.map((item) => ({ ...item, hasVoted: false, voteCount: 0 }));
	}

	const votes = await db
		.select({ checkInId: checkInDismissalVote.checkInId })
		.from(checkInDismissalVote)
		.where(inArray(checkInDismissalVote.checkInId, checkInIds));

	const voteCounts = new Map<string, number>();
	for (const vote of votes) {
		voteCounts.set(vote.checkInId, (voteCounts.get(vote.checkInId) ?? 0) + 1);
	}

	const myVotes = await db
		.select({ checkInId: checkInDismissalVote.checkInId })
		.from(checkInDismissalVote)
		.where(
			and(
				inArray(checkInDismissalVote.checkInId, checkInIds),
				eq(checkInDismissalVote.voterId, voterId)
			)
		);
	const votedIds = new Set(myVotes.map((vote) => vote.checkInId));

	return items.map((item) => ({
		...item,
		hasVoted: votedIds.has(item.id),
		voteCount: voteCounts.get(item.id) ?? 0,
	}));
}

function withFeaturedFirst<T extends { id: string }>(
	products: T[],
	featuredProductId: string | null
): T[] {
	if (!featuredProductId) {
		return products;
	}
	const featuredIndex = products.findIndex((p) => p.id === featuredProductId);
	if (featuredIndex <= 0) {
		return products;
	}
	return [
		products[featuredIndex] as T,
		...products.filter((_, i) => i !== featuredIndex),
	];
}

export const matilhaRouter = {
	checkIns: {
		create: protectedProcedure
			.input(
				z.object({
					blocked: z.string(),
					help: z.string().optional(),
					productId: z.string().optional(),
					progress: z.string().min(1),
				})
			)
			.handler(async ({ input, context }) => {
				const founderId = context.session.user.id;
				let productName: string | null = null;
				if (input.productId) {
					productName = await requireOwnedProduct(input.productId, founderId);
				}
				const [profile] = await db
					.select({
						lastCheckInAt: founder.lastCheckInAt,
						streak: founder.streak,
					})
					.from(founder)
					.where(eq(founder.userId, founderId))
					.limit(1);
				const now = new Date();
				const nextStreak = computeNextStreak(
					profile?.streak ?? 0,
					profile?.lastCheckInAt ?? null,
					now
				);
				await db.insert(checkIn).values({
					blocked: input.blocked,
					founderId,
					help: input.help,
					productId: input.productId,
					progress: input.progress,
				});
				await db
					.update(founder)
					.set({ lastCheckInAt: now, streak: nextStreak })
					.where(eq(founder.userId, founderId));

				// Awaited rather than fire-and-forget: on serverless a floating
				// promise dies when the response returns. The client mutation is
				// optimistic, so this latency never reaches the founder. The catch
				// is the safety net for a rejection notifyCheckIn didn't swallow.
				await notifyCheckIn({
					blocked: input.blocked,
					founderName: context.session.user.name,
					help: input.help,
					productName,
					progress: input.progress,
					streak: nextStreak,
				}).catch(() => undefined);

				return { streak: nextStreak };
			}),
		dismissVote: protectedProcedure
			.input(z.object({ checkInId: z.string() }))
			.handler(async ({ input, context }) => {
				const voterId = context.session.user.id;
				const [target] = await db
					.select({
						dismissedAt: checkIn.dismissedAt,
						founderId: checkIn.founderId,
					})
					.from(checkIn)
					.where(eq(checkIn.id, input.checkInId))
					.limit(1);
				if (!target) {
					throw new ORPCError("NOT_FOUND");
				}
				if (target.dismissedAt) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Esse check-in já foi desconsiderado.",
					});
				}
				if (target.founderId === voterId) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Você não pode votar no próprio check-in.",
					});
				}
				const [existingVote] = await db
					.select({ id: checkInDismissalVote.id })
					.from(checkInDismissalVote)
					.where(
						and(
							eq(checkInDismissalVote.checkInId, input.checkInId),
							eq(checkInDismissalVote.voterId, voterId)
						)
					)
					.limit(1);
				if (existingVote) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Você já votou nesse check-in.",
					});
				}

				await db.insert(checkInDismissalVote).values({
					checkInId: input.checkInId,
					voterId,
				});
				const votes = await db
					.select({ id: checkInDismissalVote.id })
					.from(checkInDismissalVote)
					.where(eq(checkInDismissalVote.checkInId, input.checkInId));
				const voteCount = votes.length;

				let dismissed = false;
				if (voteCount >= DISMISSAL_VOTE_THRESHOLD) {
					await db
						.update(checkIn)
						.set({ dismissedAt: new Date() })
						.where(eq(checkIn.id, input.checkInId));
					await recomputeFounderStreak(target.founderId);
					dismissed = true;
				}

				return { dismissed, voteCount };
			}),
		listByFounder: protectedProcedure
			.input(
				z.object({
					cursor: z.number().int().min(0).optional(),
					founderId: z.string(),
				})
			)
			.handler(async ({ input }) => {
				const cursor = input.cursor ?? 0;
				const rows = await db.query.checkIn.findMany({
					limit: PAGE_SIZE,
					offset: cursor,
					orderBy: desc(checkIn.createdAt),
					where: eq(checkIn.founderId, input.founderId),
					with: { product: true },
				});
				return paginate(rows, cursor);
			}),
		listFeed: protectedProcedure
			.input(
				z.object({ cursor: z.number().int().min(0).optional() }).optional()
			)
			.handler(async ({ input, context }) => {
				const cursor = input?.cursor ?? 0;
				const now = new Date();
				const rows = await db.query.checkIn.findMany({
					limit: PAGE_SIZE,
					offset: cursor,
					orderBy: desc(checkIn.createdAt),
					with: {
						founder: { with: { user: true } },
						product: true,
					},
				});
				const baseItems = rows.map((row) => ({
					avatarUrl: row.founder.avatarUrl,
					blocked: row.blocked,
					createdAt: row.createdAt,
					dismissedAt: row.dismissedAt,
					founderId: row.founderId,
					help: row.help,
					id: row.id,
					name: row.founder.user.name,
					product: row.product,
					progress: row.progress,
					streak: computeCurrentStreak(
						row.founder.streak,
						row.founder.lastCheckInAt,
						now
					),
				}));
				const items = await attachDismissalInfo(
					baseItems,
					context.session.user.id
				);
				return paginate(items, cursor);
			}),
		update: protectedProcedure
			.input(
				z.object({
					blocked: z.string(),
					help: z.string().optional(),
					id: z.string(),
					productId: z.string().min(1),
					progress: z.string().min(1),
				})
			)
			.handler(async ({ input, context }) => {
				const founderId = context.session.user.id;
				await requireEditableCheckIn(input.id, founderId);
				await requireOwnedProduct(input.productId, founderId);
				await db
					.update(checkIn)
					.set({
						blocked: input.blocked,
						help: input.help ?? null,
						productId: input.productId,
						progress: input.progress,
					})
					.where(eq(checkIn.id, input.id));
			}),
	},
	founders: {
		get: protectedProcedure
			.input(z.object({ founderId: z.string() }))
			.handler(async ({ input }) => {
				const row = await db.query.founder.findFirst({
					where: eq(founder.userId, input.founderId),
					with: {
						products: { orderBy: desc(product.createdAt) },
						user: true,
					},
				});
				if (!row) {
					throw new ORPCError("NOT_FOUND");
				}
				const streak = computeCurrentStreak(
					row.streak,
					row.lastCheckInAt,
					new Date()
				);
				return {
					avatarUrl: row.avatarUrl,
					bio: row.bio,
					featuredProductId: row.featuredProductId,
					lastCheckInAt: row.lastCheckInAt,
					name: row.user.name,
					products: withFeaturedFirst(row.products, row.featuredProductId),
					streak,
					userId: row.userId,
				};
			}),
		list: protectedProcedure
			.input(
				z.object({ cursor: z.number().int().min(0).optional() }).optional()
			)
			.handler(async ({ input }) => {
				const cursor = input?.cursor ?? 0;
				const now = new Date();
				const rows = await db.query.founder.findMany({
					limit: PAGE_SIZE,
					offset: cursor,
					orderBy: [
						desc(currentStreakSql(founder.streak, founder.lastCheckInAt, now)),
						desc(hasProductWithStatus(founder.userId, "launched")),
						desc(hasProductWithStatus(founder.userId, "building")),
						desc(hasProductWithStatus(founder.userId, "validating")),
						desc(founder.lastCheckInAt),
					],
					where: exists(
						db
							.select({ id: user.id })
							.from(user)
							.where(
								and(
									eq(user.id, founder.userId),
									eq(user.approvalStatus, "approved")
								)
							)
					),
					with: {
						products: { orderBy: desc(product.createdAt) },
						user: true,
					},
				});
				const items = rows.map((row) => ({
					avatarUrl: row.avatarUrl,
					bio: row.bio,
					featuredProductId: row.featuredProductId,
					lastCheckInAt: row.lastCheckInAt,
					name: row.user.name,
					products: withFeaturedFirst(row.products, row.featuredProductId),
					streak: computeCurrentStreak(row.streak, row.lastCheckInAt, now),
					userId: row.userId,
				}));
				return paginate(items, cursor);
			}),
		setFeaturedProduct: protectedProcedure
			.input(z.object({ productId: z.string().nullable() }))
			.handler(async ({ input, context }) => {
				const founderId = context.session.user.id;
				if (input.productId) {
					await requireOwnedProduct(input.productId, founderId);
				}
				await db
					.update(founder)
					.set({ featuredProductId: input.productId })
					.where(eq(founder.userId, founderId));
				return { featuredProductId: input.productId };
			}),
		updateBio: protectedProcedure
			.input(z.object({ bio: z.string() }))
			.handler(async ({ input, context }) => {
				const founderId = context.session.user.id;
				await db
					.update(founder)
					.set({ bio: input.bio || null })
					.where(eq(founder.userId, founderId));
				return { bio: input.bio || null };
			}),
		updateSignupDetails: protectedProcedure
			.input(
				z.object({
					interest: z.enum(["running", "building", "observing"]),
					phone: z.string().min(1),
				})
			)
			.handler(async ({ input, context }) => {
				const phone = normalizePhone(input.phone);
				if (!phone) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Telefone inválido.",
					});
				}
				const founderId = context.session.user.id;
				await db
					.update(founder)
					.set({ interest: input.interest, phone })
					.where(eq(founder.userId, founderId));
				return { interest: input.interest, phone };
			}),
	},
	products: {
		create: protectedProcedure
			.input(
				z.object({
					icp: z.string().optional(),
					link: z.string().url().optional().or(z.literal("")),
					name: z.string().min(1),
					painPoint: z.string().optional(),
					solution: z.string().optional(),
				})
			)
			.handler(async ({ input, context }) => {
				const founderId = context.session.user.id;
				const existing = await db
					.select({ id: product.id })
					.from(product)
					.where(eq(product.founderId, founderId));
				if (existing.length >= MAX_PRODUCTS_PER_FOUNDER) {
					throw new ORPCError("BAD_REQUEST", {
						message: `Você já atingiu o limite de ${MAX_PRODUCTS_PER_FOUNDER} produtos.`,
					});
				}
				const imageUrl = input.link
					? await fetchOgImage(input.link)
					: undefined;
				const [row] = await db
					.insert(product)
					.values({
						founderId,
						icp: input.icp || undefined,
						imageUrl,
						link: input.link || undefined,
						name: input.name,
						painPoint: input.painPoint || undefined,
						solution: input.solution || undefined,
					})
					.returning();
				return row;
			}),
		delete: protectedProcedure
			.input(z.object({ id: z.string() }))
			.handler(async ({ input, context }) => {
				const founderId = context.session.user.id;
				const [row] = await db
					.delete(product)
					.where(
						and(eq(product.id, input.id), eq(product.founderId, founderId))
					)
					.returning();
				if (!row) {
					throw new ORPCError("NOT_FOUND");
				}
				return { id: row.id };
			}),
		mine: protectedProcedure.handler(async ({ context }) => {
			const founderId = context.session.user.id;
			return await db
				.select()
				.from(product)
				.where(eq(product.founderId, founderId))
				.orderBy(desc(product.createdAt));
		}),
		update: protectedProcedure
			.input(
				z.object({
					icp: z.string().optional(),
					id: z.string(),
					link: z.string().url().optional().or(z.literal("")),
					name: z.string().min(1).optional(),
					painPoint: z.string().optional(),
					solution: z.string().optional(),
					status: z.enum(["validating", "building", "launched"]).optional(),
				})
			)
			.handler(async ({ input, context }) => {
				const founderId = context.session.user.id;
				const { id, ...patch } = input;
				const nextLink = patch.link === "" ? null : patch.link;

				let imageUrl: string | undefined;
				if (nextLink) {
					const [existing] = await db
						.select({ imageUrl: product.imageUrl, link: product.link })
						.from(product)
						.where(and(eq(product.id, id), eq(product.founderId, founderId)));
					if (existing && !existing.imageUrl && existing.link !== nextLink) {
						imageUrl = (await fetchOgImage(nextLink)) ?? undefined;
					}
				}

				const [row] = await db
					.update(product)
					.set({
						...patch,
						...(imageUrl ? { imageUrl } : {}),
						link: nextLink,
					})
					.where(and(eq(product.id, id), eq(product.founderId, founderId)))
					.returning();
				if (!row) {
					throw new ORPCError("NOT_FOUND");
				}
				return row;
			}),
	},
};
