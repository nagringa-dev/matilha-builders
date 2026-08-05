import { db } from "@matilha-builders/db";
import { founder, product } from "@matilha-builders/db/schema/matilha";
import {
	builderTool,
	builderToolProduct,
	tool,
} from "@matilha-builders/db/schema/tools";
import { TOOL_CATEGORY_SLUGS } from "@matilha-builders/db/tool-categories";
import { ORPCError } from "@orpc/server";
import {
	and,
	count,
	desc,
	eq,
	inArray,
	isNotNull,
	isNull,
	max,
	or,
	sql,
} from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure } from "../index";
import {
	PAGE_SIZE,
	TOOL_AVATAR_PREVIEW_LIMIT,
	TOOL_NOTED_ADOPTERS_PAGE_SIZE,
} from "../lib/constants";
import { paginate } from "../lib/pagination";
import { computeCurrentStreak } from "../lib/streak";
import {
	faviconUrl,
	type NormalizedToolUrl,
	normalizeToolUrl,
	slugify,
} from "../lib/tool-url";

const MAX_SLUG_ATTEMPTS = 10;

const hasNoteCondition = and(
	isNotNull(builderTool.note),
	sql`btrim(${builderTool.note}) <> ''`
);

const noNoteCondition = or(
	isNull(builderTool.note),
	sql`btrim(${builderTool.note}) = ''`
);

async function fetchAdopters(
	toolId: string,
	options: { limit?: number; offset?: number; onlyNoted?: boolean }
) {
	const notePriority = sql`case when ${builderTool.note} is not null and btrim(${builderTool.note}) <> '' then 1 else 0 end`;
	const rows = await db.query.builderTool.findMany({
		limit: options.limit,
		offset: options.offset,
		orderBy: [desc(notePriority), desc(builderTool.createdAt)],
		where: options.onlyNoted
			? and(eq(builderTool.toolId, toolId), hasNoteCondition)
			: eq(builderTool.toolId, toolId),
		with: {
			founder: { with: { user: true } },
			products: { with: { product: true } },
		},
	});
	const now = new Date();
	return rows.map((row) => ({
		avatarUrl: row.founder.avatarUrl,
		founderId: row.founderId,
		name: row.founder.user.name,
		note: row.note,
		products: row.products.map((link) => link.product),
		streak: computeCurrentStreak(
			row.founder.streak,
			row.founder.lastCheckInAt,
			now
		),
	}));
}

async function createToolWithUniqueSlug(
	input: {
		category: (typeof TOOL_CATEGORY_SLUGS)[number];
		description: string | null;
		name: string;
	},
	normalized: NormalizedToolUrl
) {
	const baseSlug = slugify(input.name);
	for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt += 1) {
		const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`;
		// biome-ignore lint/performance/noAwaitInLoops: each attempt depends on whether the previous insert or re-select found a row; the attempts are inherently sequential.
		const [inserted] = await db
			.insert(tool)
			.values({
				category: input.category,
				description: input.description,
				logoUrl: faviconUrl(normalized.host),
				name: input.name,
				normalizedKey: normalized.key,
				slug,
				url: normalized.url,
			})
			.onConflictDoNothing()
			.returning();
		if (inserted) {
			return inserted;
		}
		const [concurrent] = await db
			.select()
			.from(tool)
			.where(eq(tool.normalizedKey, normalized.key))
			.limit(1);
		if (concurrent) {
			return concurrent;
		}
	}
	throw new ORPCError("BAD_REQUEST", {
		message: "Não deu pra gerar um endereço único pra essa ferramenta.",
	});
}

async function upsertAdoption(
	toolId: string,
	founderId: string,
	note: string | null
) {
	const [adoption] = await db
		.insert(builderTool)
		.values({ founderId, note, toolId })
		.onConflictDoUpdate({
			set: { note },
			target: [builderTool.founderId, builderTool.toolId],
		})
		.returning({ id: builderTool.id });
	if (!adoption) {
		throw new ORPCError("NOT_FOUND");
	}
	return adoption.id;
}

async function fetchViewerAdoption(toolId: string, founderId: string) {
	const rows = await db
		.select({
			note: builderTool.note,
			productId: builderToolProduct.productId,
		})
		.from(builderTool)
		.leftJoin(
			builderToolProduct,
			eq(builderToolProduct.builderToolId, builderTool.id)
		)
		.where(
			and(eq(builderTool.toolId, toolId), eq(builderTool.founderId, founderId))
		);
	const [first] = rows;
	if (!first) {
		return null;
	}
	return {
		note: first.note,
		productIds: rows
			.map((link) => link.productId)
			.filter((id): id is string => id !== null),
		toolId,
	};
}

async function replaceProductLinks(
	builderToolId: string,
	productIds: string[],
	founderId: string
) {
	if (productIds.length > 0) {
		const owned = await db
			.select({ id: product.id })
			.from(product)
			.where(
				and(inArray(product.id, productIds), eq(product.founderId, founderId))
			);
		if (owned.length !== productIds.length) {
			throw new ORPCError("NOT_FOUND");
		}
	}
	await db
		.delete(builderToolProduct)
		.where(eq(builderToolProduct.builderToolId, builderToolId));
	if (productIds.length > 0) {
		await db
			.insert(builderToolProduct)
			.values(productIds.map((productId) => ({ builderToolId, productId })));
	}
}

export const toolsRouter = {
	tools: {
		addToStack: protectedProcedure
			.input(
				z.object({
					category: z.enum(TOOL_CATEGORY_SLUGS).optional(),
					description: z.string().optional(),
					name: z.string().optional(),
					note: z.string().optional(),
					productIds: z.array(z.string()).default([]),
					url: z.string().min(1),
				})
			)
			.handler(async ({ input, context }) => {
				const founderId = context.session.user.id;
				const normalized = normalizeToolUrl(input.url);
				if (!normalized) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Link inválido. Confere o endereço da ferramenta.",
					});
				}

				let [existingTool] = await db
					.select()
					.from(tool)
					.where(eq(tool.normalizedKey, normalized.key))
					.limit(1);

				if (!existingTool) {
					if (!(input.name && input.category)) {
						throw new ORPCError("BAD_REQUEST", {
							message:
								"Nome e categoria são obrigatórios para cadastrar uma ferramenta nova.",
						});
					}
					existingTool = await createToolWithUniqueSlug(
						{
							category: input.category,
							description: input.description?.trim() || null,
							name: input.name.trim(),
						},
						normalized
					);
				}

				const note = input.note?.trim() || null;
				const builderToolId = await upsertAdoption(
					existingTool.id,
					founderId,
					note
				);

				await replaceProductLinks(builderToolId, input.productIds, founderId);

				return { slug: existingTool.slug, toolId: existingTool.id };
			}),
		byFounder: protectedProcedure
			.input(z.object({ founderId: z.string() }))
			.handler(async ({ input }) => {
				const rows = await db.query.builderTool.findMany({
					orderBy: desc(builderTool.createdAt),
					where: eq(builderTool.founderId, input.founderId),
					with: {
						products: { with: { product: true } },
						tool: true,
					},
				});
				return rows.map((row) => ({
					category: row.tool.category,
					description: row.tool.description,
					logoUrl: row.tool.logoUrl,
					name: row.tool.name,
					note: row.note,
					products: row.products.map((link) => link.product),
					slug: row.tool.slug,
					toolId: row.toolId,
					url: row.tool.url,
				}));
			}),
		get: protectedProcedure
			.input(z.object({ slug: z.string() }))
			.handler(async ({ input, context }) => {
				const founderId = context.session.user.id;
				const [row] = await db
					.select()
					.from(tool)
					.where(eq(tool.slug, input.slug))
					.limit(1);
				if (!row) {
					throw new ORPCError("NOT_FOUND");
				}

				const [counts] = await db
					.select({
						noted:
							sql<number>`count(*) filter (where ${hasNoteCondition})`.mapWith(
								Number
							),
						total: count(builderTool.id),
					})
					.from(builderTool)
					.where(eq(builderTool.toolId, row.id));

				const adopterCount = counts?.total ?? 0;
				const notedCount = counts?.noted ?? 0;

				const [notedAdopters, silentAvatarRows, viewerAdoption] =
					await Promise.all([
						fetchAdopters(row.id, {
							limit: TOOL_NOTED_ADOPTERS_PAGE_SIZE,
							onlyNoted: notedCount > 0,
						}),
						db
							.select({ avatarUrl: founder.avatarUrl })
							.from(builderTool)
							.innerJoin(founder, eq(founder.userId, builderTool.founderId))
							.where(
								and(
									eq(builderTool.toolId, row.id),
									noNoteCondition,
									isNotNull(founder.avatarUrl)
								)
							)
							.orderBy(desc(builderTool.createdAt))
							.limit(TOOL_AVATAR_PREVIEW_LIMIT),
						fetchViewerAdoption(row.id, founderId),
					]);

				return {
					...row,
					adopterCount,
					hasMoreAdopters:
						(notedCount === 0 ? adopterCount : notedCount) >
						notedAdopters.length,
					notedAdopters,
					notedCount,
					silentAvatarUrls: silentAvatarRows.map(
						(silentRow) => silentRow.avatarUrl as string
					),
					silentCount: adopterCount - notedCount,
					viewerAdoption,
				};
			}),
		list: protectedProcedure
			.input(
				z
					.object({
						category: z.enum(TOOL_CATEGORY_SLUGS).optional(),
						cursor: z.number().int().min(0).optional(),
					})
					.optional()
			)
			.handler(async ({ input }) => {
				const cursor = input?.cursor ?? 0;
				const rows = await db
					.select({
						adopterCount: count(builderTool.id),
						category: tool.category,
						id: tool.id,
						logoUrl: tool.logoUrl,
						name: tool.name,
						slug: tool.slug,
						url: tool.url,
					})
					.from(tool)
					.leftJoin(builderTool, eq(builderTool.toolId, tool.id))
					.where(
						input?.category ? eq(tool.category, input.category) : undefined
					)
					.groupBy(tool.id)
					.orderBy(
						desc(count(builderTool.id)),
						desc(max(builderTool.createdAt)),
						desc(tool.createdAt)
					)
					.limit(PAGE_SIZE)
					.offset(cursor);

				const toolIds = rows.map((toolRow) => toolRow.id);
				const avatarsByTool = new Map<string, string[]>();
				if (toolIds.length > 0) {
					const avatarRows = await db
						.select({
							avatarUrl: founder.avatarUrl,
							toolId: builderTool.toolId,
						})
						.from(builderTool)
						.innerJoin(founder, eq(founder.userId, builderTool.founderId))
						.where(
							and(
								inArray(builderTool.toolId, toolIds),
								isNotNull(founder.avatarUrl)
							)
						)
						.orderBy(desc(builderTool.createdAt));
					for (const avatarRow of avatarRows) {
						const existing = avatarsByTool.get(avatarRow.toolId) ?? [];
						if (existing.length < TOOL_AVATAR_PREVIEW_LIMIT) {
							existing.push(avatarRow.avatarUrl as string);
						}
						avatarsByTool.set(avatarRow.toolId, existing);
					}
				}

				const items = rows.map((row) => ({
					adopterCount: row.adopterCount,
					avatarUrls: avatarsByTool.get(row.id) ?? [],
					category: row.category,
					id: row.id,
					logoUrl: row.logoUrl,
					name: row.name,
					slug: row.slug,
					url: row.url,
				}));
				return paginate(items, cursor);
			}),
		listAdopters: protectedProcedure
			.input(
				z.object({
					cursor: z.number().int().min(0).optional(),
					slug: z.string(),
				})
			)
			.handler(async ({ input }) => {
				const [toolRow] = await db
					.select({ id: tool.id })
					.from(tool)
					.where(eq(tool.slug, input.slug))
					.limit(1);
				if (!toolRow) {
					throw new ORPCError("NOT_FOUND");
				}
				const cursor = input.cursor ?? 0;
				const items = await fetchAdopters(toolRow.id, {
					limit: PAGE_SIZE,
					offset: cursor,
				});
				return paginate(items, cursor);
			}),
		lookup: protectedProcedure
			.input(z.object({ url: z.string() }))
			.handler(async ({ input, context }) => {
				const normalized = normalizeToolUrl(input.url);
				if (!normalized) {
					return { adoption: null, tool: null };
				}
				const [row] = await db
					.select()
					.from(tool)
					.where(eq(tool.normalizedKey, normalized.key))
					.limit(1);
				if (!row) {
					return { adoption: null, tool: null };
				}
				const adoption = await fetchViewerAdoption(
					row.id,
					context.session.user.id
				);
				return { adoption, tool: row };
			}),
		removeFromStack: protectedProcedure
			.input(z.object({ toolId: z.string() }))
			.handler(async ({ input, context }) => {
				const founderId = context.session.user.id;
				const [row] = await db
					.delete(builderTool)
					.where(
						and(
							eq(builderTool.toolId, input.toolId),
							eq(builderTool.founderId, founderId)
						)
					)
					.returning();
				if (!row) {
					throw new ORPCError("NOT_FOUND");
				}
				return { toolId: row.toolId };
			}),
		updateStack: protectedProcedure
			.input(
				z.object({
					note: z.string().optional(),
					productIds: z.array(z.string()).default([]),
					toolId: z.string(),
				})
			)
			.handler(async ({ input, context }) => {
				const founderId = context.session.user.id;
				const note = input.note?.trim() || null;
				const [existing] = await db
					.update(builderTool)
					.set({ note })
					.where(
						and(
							eq(builderTool.toolId, input.toolId),
							eq(builderTool.founderId, founderId)
						)
					)
					.returning({ id: builderTool.id });
				if (!existing) {
					throw new ORPCError("NOT_FOUND");
				}
				await replaceProductLinks(existing.id, input.productIds, founderId);
			}),
		updateTool: protectedProcedure
			.input(
				z.object({
					category: z.enum(TOOL_CATEGORY_SLUGS),
					description: z.string().optional(),
					name: z.string().min(1),
					toolId: z.string(),
				})
			)
			.handler(async ({ input, context }) => {
				const founderId = context.session.user.id;
				const [adoption] = await db
					.select({ id: builderTool.id })
					.from(builderTool)
					.where(
						and(
							eq(builderTool.toolId, input.toolId),
							eq(builderTool.founderId, founderId)
						)
					)
					.limit(1);
				if (!adoption) {
					throw new ORPCError("FORBIDDEN", {
						message:
							"Só quem usa a ferramenta pode editar as informações dela.",
					});
				}
				// slug and url are frozen: slug keeps shared links stable, url is the identity key.
				const [row] = await db
					.update(tool)
					.set({
						category: input.category,
						description: input.description || null,
						name: input.name,
					})
					.where(eq(tool.id, input.toolId))
					.returning();
				if (!row) {
					throw new ORPCError("NOT_FOUND");
				}
				return row;
			}),
	},
};
