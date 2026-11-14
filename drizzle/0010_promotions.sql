CREATE TYPE "public"."promotion_kind" AS ENUM('percent', 'amount', 'free_delivery');--> statement-breakpoint
CREATE TABLE "promotion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"kind" "promotion_kind" NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"min_spend_pence" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"max_uses" integer,
	"uses" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotion_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "basket" ADD COLUMN "promotion_code" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "discount_pence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "promotions" jsonb DEFAULT '[]'::jsonb NOT NULL;