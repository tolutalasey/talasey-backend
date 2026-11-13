CREATE TYPE "public"."order_status" AS ENUM('placed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('stripe', 'test');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('paid', 'partly_refunded', 'refunded');--> statement-breakpoint
CREATE TABLE "basket_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"basket_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_pence" integer,
	"colour_id" uuid,
	"build_id" text,
	"build_parts" jsonb,
	"bespoke" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "basket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"address" jsonb,
	"shipment" "shipment_type",
	"slot" jsonb,
	"access" jsonb,
	"payment_reference" text,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"variant_id" uuid,
	"product_title" text NOT NULL,
	"variant_title" text,
	"sku" text,
	"colour" text,
	"quantity" integer NOT NULL,
	"unit_price_pence" integer NOT NULL,
	"total_pence" integer NOT NULL,
	"stock" text NOT NULL,
	"build_id" text,
	"build_parts" jsonb,
	"bespoke" jsonb
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"basket_id" uuid NOT NULL,
	"email" text NOT NULL,
	"address" jsonb NOT NULL,
	"shipment" "shipment_type" NOT NULL,
	"delivery_name" text NOT NULL,
	"item_total_pence" integer NOT NULL,
	"delivery_pence" integer NOT NULL,
	"total_pence" integer NOT NULL,
	"slot" jsonb,
	"access" jsonb,
	"status" "order_status" DEFAULT 'placed' NOT NULL,
	"payment_provider" "payment_provider" NOT NULL,
	"payment_reference" text NOT NULL,
	"payment_status" "payment_status" DEFAULT 'paid' NOT NULL,
	"refunded_pence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_number_unique" UNIQUE("number"),
	CONSTRAINT "order_basket_id_unique" UNIQUE("basket_id")
);
--> statement-breakpoint
ALTER TABLE "basket_line" ADD CONSTRAINT "basket_line_basket_id_basket_id_fk" FOREIGN KEY ("basket_id") REFERENCES "public"."basket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "basket_line" ADD CONSTRAINT "basket_line_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "basket_line" ADD CONSTRAINT "basket_line_colour_id_colour_id_fk" FOREIGN KEY ("colour_id") REFERENCES "public"."colour"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "basket_line_basket_idx" ON "basket_line" USING btree ("basket_id");--> statement-breakpoint
CREATE INDEX "order_line_order_idx" ON "order_line" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_created_idx" ON "order" USING btree ("created_at");