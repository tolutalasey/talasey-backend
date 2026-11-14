CREATE TYPE "public"."sample_request_status" AS ENUM('new', 'dispatched');--> statement-breakpoint
CREATE TABLE "sample_offer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"label" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sample_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"email" text NOT NULL,
	"address" jsonb NOT NULL,
	"items" jsonb NOT NULL,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"status" "sample_request_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dispatched_at" timestamp with time zone,
	"dispatched_by" text,
	CONSTRAINT "sample_request_number_unique" UNIQUE("number")
);
--> statement-breakpoint
ALTER TABLE "sample_offer" ADD CONSTRAINT "sample_offer_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;