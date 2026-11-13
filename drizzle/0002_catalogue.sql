CREATE TYPE "public"."stock_mode" AS ENUM('stocked', 'made_to_order', 'stocked_then_made_to_order');--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	CONSTRAINT "category_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "colour_image" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"colour_id" uuid NOT NULL,
	"size" text NOT NULL,
	"finish" text NOT NULL,
	"url" text NOT NULL,
	"alt" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "colour_set" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "colour_set_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "colour" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"name" text NOT NULL,
	"hex" text NOT NULL,
	"photo_url" text,
	"rank" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_image" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"alt" text NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"description" text,
	"brand" text,
	"published" boolean DEFAULT false NOT NULL,
	"page_type" text,
	"stock_mode" "stock_mode" DEFAULT 'made_to_order' NOT NULL,
	"lead_time_min_days" integer,
	"lead_time_max_days" integer,
	"category_id" uuid,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"colour_set_id" uuid,
	"colour_option" text,
	"colour_option_value" text,
	"colour_required" boolean DEFAULT true NOT NULL,
	"colour_label" text,
	"bespoke" jsonb,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pim_sku" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "variant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text,
	"title" text NOT NULL,
	"options" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price_pence" integer,
	"weight_kg" double precision,
	"coverage_m2" double precision,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"barcode" text,
	"rank" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_parent_id_category_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "colour_image" ADD CONSTRAINT "colour_image_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "colour" ADD CONSTRAINT "colour_set_id_colour_set_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."colour_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_colour_set_id_colour_set_id_fk" FOREIGN KEY ("colour_set_id") REFERENCES "public"."colour_set"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant" ADD CONSTRAINT "variant_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "colour_image_product_idx" ON "colour_image" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "colour_set_idx" ON "colour" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "product_image_product_idx" ON "product_image" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "variant_product_idx" ON "variant" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "variant_sku_idx" ON "variant" USING btree ("sku");