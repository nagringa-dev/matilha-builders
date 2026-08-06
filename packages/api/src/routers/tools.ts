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
	sql,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { z } from "zod";

import { protectedProcedure } from "../index";
import {
	PAGE_SIZE,
	TOOL_AVATAR_PREVIEW_LIMIT,
	TOOL_NOTED_ADOPTERS_PAGE_SIZE,
} from "../lib/constants";
import { paginate } from "../lib/pagination";
import { computeCurrentStreak } from "../lib/streak";
import { faviconUrl, normalizeToolUrl, toolSlug } from "../lib/tool-url";

// Allowlist: keeps normalizedKey and timestamps off the wire.
const catalogFields = {
	category: tool.category,
	description: tool.description,
	id: tool.id,
	logoUrl: tool.logoUrl,
	name: tool.name,
	slug: tool.slug,
	url: tool.url,
};

const adopterRelations = {
	founder: { with: { user: true } },
	products: { with: { product: true } },
} as const;

type AdopterRow = Awaited<
	ReturnType<
		typeof db.query.builderTool.findMany<{ with: typeof adopterRelations }>
	>
>[number];

function toAdopter(row: AdopterRow, now: Date) {
	return {
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
	};
}

async function fetchNotedAdopters(toolId: string, limit: number) {
	const rows = await db.query.builderTool.findMany({
		limit,
		orderBy: desc(builderTool.createdAt),
		where: and(eq(builderTool.toolId, toolId), isNotNull(builderTool.note)),
		with: adopterRelations,
	});
	const now = new Date();
	return rows.map((row) => toAdopter(row, now));
}

async function fetchAllAdopters(toolId: string, offset: number) {
	const rows = await db.query.builderTool.findMany({
		limit: PAGE_SIZE,
		offset,
		orderBy: [
			desc(sql`(${builderTool.note} is not null)`),
			desc(builderTool.createdAt),
		],
		where: eq(builderTool.toolId, toolId),
		with: adopterRelations,
	});
	const now = new Date();
	return rows.map((row) => toAdopter(row, now));
}

// Capped in SQL so a popular tool does not ship every adoption row to render
// eight faces.
function avatarPreviewQuery(where: Parameters<typeof and>[0]) {
	const ranked = db
		.select({
			avatarUrl: sql<string>`${founder.avatarUrl}`.as("avatar_url"),
			rank: sql<number>`row_number() over (
				partition by ${builderTool.toolId}
				order by ${builderTool.createdAt} desc
			)`.as("rank"),
			toolId: builderTool.toolId,
		})
		.from(builderTool)
		.innerJoin(founder, eq(founder.userId, builderTool.founderId))
		.where(and(isNotNull(founder.avatarUrl), where))
		.as("ranked");

	return db
		.select({ avatarUrl: ranked.avatarUrl, toolId: ranked.toolId })
		.from(ranked)
		.where(sql`${ranked.rank} <= ${TOOL_AVATAR_PREVIEW_LIMIT}`)
		.orderBy(ranked.rank);
}

async function findToolByKey(key: string) {
	const [row] = await db
		.select(catalogFields)
		.from(tool)
		.where(eq(tool.normalizedKey, key))
		.limit(1);
	return row ?? null;
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
			and(
				eq(builderToolProduct.founderId, builderTool.founderId),
				eq(builderToolProduct.toolId, builderTool.toolId)
			)
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

// Must run before any write, so a stale client cannot leave a half-applied
// adoption behind.
async function assertOwnsProducts(productIds: string[], founderId: string) {
	if (productIds.length === 0) {
		return;
	}
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

// neon-http has no interactive transactions, so batch is the atomic unit here.
// Keep note and links in one batch or an update can leave the links cleared.
function writeAdoption(input: {
	founderId: string;
	note: string | null;
	productIds: string[];
	toolId: string;
}) {
	const { founderId, note, productIds, toolId } = input;
	const statements: [BatchItem<"pg">, ...BatchItem<"pg">[]] = [
		db
			.insert(builderTool)
			.values({ founderId, note, toolId })
			.onConflictDoUpdate({
				set: { note },
				target: [builderTool.founderId, builderTool.toolId],
			}),
		db
			.delete(builderToolProduct)
			.where(
				and(
					eq(builderToolProduct.founderId, founderId),
					eq(builderToolProduct.toolId, toolId)
				)
			),
	];
	if (productIds.length > 0) {
		statements.push(
			db
				.insert(builderToolProduct)
				.values(
					productIds.map((productId) => ({ founderId, productId, toolId }))
				)
		);
	}
	return db.batch(statements);
}

const adoptionInput = {
	note: z.string().optional(),
	productIds: z.array(z.string()).default([]),
};

const addToStackInput = z.discriminatedUnion("kind", [
	z.object({
		...adoptionInput,
		kind: z.literal("existing"),
		url: z.string().min(1),
	}),
	z.object({
		...adoptionInput,
		category: z.enum(TOOL_CATEGORY_SLUGS),
		description: z.string().optional(),
		kind: z.literal("new"),
		name: z.string().min(1),
		url: z.string().min(1),
	}),
]);

export const toolsRouter = {
	tools: {
		addToStack: protectedProcedure
			.input(addToStackInput)
			.handler(async ({ input, context }) => {
				const founderId = context.session.user.id;
				const normalized = normalizeToolUrl(input.url);
				if (!normalized) {
					throw new ORPCError("BAD_REQUEST", {
						message: "Link inválido. Confere o endereço da ferramenta.",
					});
				}
				await assertOwnsProducts(input.productIds, founderId);

				// Another founder may have inserted the same URL in between, so the
				// insert yields to whatever is already keyed on it.
				const [inserted] =
					input.kind === "new"
						? await db
								.insert(tool)
								.values({
									category: input.category,
									description: input.description?.trim() || null,
									logoUrl: faviconUrl(normalized.key),
									name: input.name.trim(),
									normalizedKey: normalized.key,
									slug: toolSlug(input.name, normalized.key),
									url: normalized.url,
								})
								.onConflictDoNothing({ target: tool.normalizedKey })
								.returning(catalogFields)
						: [];

				const target = inserted ?? (await findToolByKey(normalized.key));
				if (!target) {
					throw new ORPCError("NOT_FOUND", {
						message: "Essa ferramenta ainda não está no catálogo.",
					});
				}

				await writeAdoption({
					founderId,
					note: input.note?.trim() || null,
					productIds: input.productIds,
					toolId: target.id,
				});
				return { slug: target.slug, toolId: target.id };
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
					.select(catalogFields)
					.from(tool)
					.where(eq(tool.slug, input.slug))
					.limit(1);
				if (!row) {
					throw new ORPCError("NOT_FOUND");
				}

				const [counts] = await db
					.select({
						noted: count(builderTool.note).mapWith(Number),
						total: count(builderTool.id).mapWith(Number),
					})
					.from(builderTool)
					.where(eq(builderTool.toolId, row.id));

				const adopterCount = counts?.total ?? 0;
				const notedCount = counts?.noted ?? 0;

				const [notedAdopters, silentAvatarRows, viewerAdoption] =
					await Promise.all([
						fetchNotedAdopters(row.id, TOOL_NOTED_ADOPTERS_PAGE_SIZE),
						avatarPreviewQuery(
							and(eq(builderTool.toolId, row.id), isNull(builderTool.note))
						),
						fetchViewerAdoption(row.id, founderId),
					]);

				return {
					...row,
					adopterCount,
					notedAdopters,
					notedCount,
					silentAvatarUrls: silentAvatarRows.map(
						(silentRow) => silentRow.avatarUrl
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
				const avatarRows = toolIds.length
					? await avatarPreviewQuery(inArray(builderTool.toolId, toolIds))
					: [];
				const avatarsByTool = Map.groupBy(avatarRows, (row) => row.toolId);

				const items = rows.map((row) => ({
					...row,
					avatarUrls:
						avatarsByTool.get(row.id)?.map((entry) => entry.avatarUrl) ?? [],
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
				const items = await fetchAllAdopters(toolRow.id, cursor);
				return paginate(items, cursor);
			}),
		lookup: protectedProcedure
			.input(z.object({ url: z.string() }))
			.handler(async ({ input, context }) => {
				const normalized = normalizeToolUrl(input.url);
				if (!normalized) {
					return { adoption: null, tool: null };
				}
				const row = await findToolByKey(normalized.key);
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
					...adoptionInput,
					toolId: z.string(),
				})
			)
			.handler(async ({ input, context }) => {
				const founderId = context.session.user.id;
				await assertOwnsProducts(input.productIds, founderId);

				// Must not silently re-adopt a tool dropped in another tab.
				const [existing] = await db
					.select({ id: builderTool.id })
					.from(builderTool)
					.where(
						and(
							eq(builderTool.toolId, input.toolId),
							eq(builderTool.founderId, founderId)
						)
					)
					.limit(1);
				if (!existing) {
					throw new ORPCError("NOT_FOUND");
				}

				await writeAdoption({
					founderId,
					note: input.note?.trim() || null,
					productIds: input.productIds,
					toolId: input.toolId,
				});
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
				// The catalog is community-owned: any adopter can correct it for all.
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
						description: input.description?.trim() || null,
						name: input.name.trim(),
					})
					.where(eq(tool.id, input.toolId))
					.returning(catalogFields);
				if (!row) {
					throw new ORPCError("NOT_FOUND");
				}
				return row;
			}),
	},
};
