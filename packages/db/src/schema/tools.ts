import { relations, sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	pgTable,
	text,
	timestamp,
	unique,
	uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { founder, product } from "./matilha";

export const tool = pgTable(
	"tool",
	{
		category: text("category").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		description: text("description"),
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		logoUrl: text("logo_url"),
		name: text("name").notNull(),
		normalizedKey: text("normalized_key").notNull(),
		slug: text("slug").notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		url: text("url").notNull(),
	},
	(table) => [
		uniqueIndex("tool_normalized_key_unique").on(table.normalizedKey),
		uniqueIndex("tool_slug_unique").on(table.slug),
	]
);

export const builderTool = pgTable(
	"builder_tool",
	{
		createdAt: timestamp("created_at").defaultNow().notNull(),
		founderId: text("founder_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		// Blank is stored as NULL, never "". Readers rely on a plain NULL check.
		note: text("note"),
		toolId: text("tool_id")
			.notNull()
			.references(() => tool.id, { onDelete: "cascade" }),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		// A constraint, not a bare index: builder_tool_product's composite foreign
		// key references these columns, and only a constraint is emitted with the
		// table itself, so it always exists before the key that depends on it.
		unique("builder_tool_unique").on(table.founderId, table.toolId),
		// The (founder, tool) unique index cannot serve a tool-only filter.
		index("builder_tool_tool_id_idx").on(table.toolId),
		check("builder_tool_note_not_blank", sql`btrim(${table.note}) <> ''`),
	]
);

// Keyed on (founder, tool) rather than builder_tool's surrogate id, so an
// adoption writes as one batch with no read-back. See writeAdoption.
export const builderToolProduct = pgTable(
	"builder_tool_product",
	{
		createdAt: timestamp("created_at").defaultNow().notNull(),
		founderId: text("founder_id").notNull(),
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		productId: text("product_id")
			.notNull()
			.references(() => product.id, { onDelete: "cascade" }),
		toolId: text("tool_id").notNull(),
	},
	(table) => [
		uniqueIndex("builder_tool_product_unique").on(
			table.founderId,
			table.toolId,
			table.productId
		),
		foreignKey({
			columns: [table.founderId, table.toolId],
			foreignColumns: [builderTool.founderId, builderTool.toolId],
		}).onDelete("cascade"),
	]
);

export const toolRelations = relations(tool, ({ many }) => ({
	adoptions: many(builderTool),
}));

export const builderToolRelations = relations(builderTool, ({ one, many }) => ({
	founder: one(founder, {
		fields: [builderTool.founderId],
		references: [founder.userId],
	}),
	products: many(builderToolProduct),
	tool: one(tool, {
		fields: [builderTool.toolId],
		references: [tool.id],
	}),
}));

export const builderToolProductRelations = relations(
	builderToolProduct,
	({ one }) => ({
		builderTool: one(builderTool, {
			fields: [builderToolProduct.founderId, builderToolProduct.toolId],
			references: [builderTool.founderId, builderTool.toolId],
		}),
		product: one(product, {
			fields: [builderToolProduct.productId],
			references: [product.id],
		}),
	})
);
