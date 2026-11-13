CREATE TYPE "public"."content_status" AS ENUM('draft', 'published', 'changed');--> statement-breakpoint
CREATE TABLE "content_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"key" text NOT NULL,
	"draft" jsonb NOT NULL,
	"published" jsonb,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_by" text,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "content_document_type_idx" ON "content_document" USING btree ("type","key");