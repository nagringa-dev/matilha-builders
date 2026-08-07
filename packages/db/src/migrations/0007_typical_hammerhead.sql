CREATE TABLE "builder_tool" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"founder_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"note" text,
	"tool_id" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "builder_tool_unique" UNIQUE("founder_id","tool_id"),
	CONSTRAINT "builder_tool_note_not_blank" CHECK (btrim("builder_tool"."note") <> '')
);
--> statement-breakpoint
CREATE TABLE "builder_tool_product" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"founder_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"tool_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tool" (
	"category" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"logo_url" text,
	"name" text NOT NULL,
	"normalized_key" text NOT NULL,
	"slug" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "builder_tool" ADD CONSTRAINT "builder_tool_founder_id_user_id_fk" FOREIGN KEY ("founder_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_tool" ADD CONSTRAINT "builder_tool_tool_id_tool_id_fk" FOREIGN KEY ("tool_id") REFERENCES "public"."tool"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_tool_product" ADD CONSTRAINT "builder_tool_product_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "builder_tool_product" ADD CONSTRAINT "builder_tool_product_founder_id_tool_id_builder_tool_founder_id_tool_id_fk" FOREIGN KEY ("founder_id","tool_id") REFERENCES "public"."builder_tool"("founder_id","tool_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "builder_tool_tool_id_idx" ON "builder_tool" USING btree ("tool_id");--> statement-breakpoint
CREATE UNIQUE INDEX "builder_tool_product_unique" ON "builder_tool_product" USING btree ("founder_id","tool_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_normalized_key_unique" ON "tool" USING btree ("normalized_key");--> statement-breakpoint
CREATE UNIQUE INDEX "tool_slug_unique" ON "tool" USING btree ("slug");