import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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
		uniqueIndex("builder_tool_unique").on(table.founderId, table.toolId),
	]
);

export const builderToolProduct = pgTable(
	"builder_tool_product",
	{
		builderToolId: text("builder_tool_id")
			.notNull()
			.references(() => builderTool.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		productId: text("product_id")
			.notNull()
			.references(() => product.id, { onDelete: "cascade" }),
	},
	(table) => [
		uniqueIndex("builder_tool_product_unique").on(
			table.builderToolId,
			table.productId
		),
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
			fields: [builderToolProduct.builderToolId],
			references: [builderTool.id],
		}),
		product: one(product, {
			fields: [builderToolProduct.productId],
			references: [product.id],
		}),
	})
);
