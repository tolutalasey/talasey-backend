CREATE TYPE "public"."content_release_status" AS ENUM('open', 'scheduled', 'published', 'failed');--> statement-breakpoint
CREATE TABLE "content_release_item" (
	"release_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	CONSTRAINT "content_release_item_release_id_document_id_pk" PRIMARY KEY("release_id","document_id")
);
--> statement-breakpoint
CREATE TABLE "content_release" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" "content_release_status" DEFAULT 'open' NOT NULL,
	"publish_at" timestamp with time zone,
	"scheduled_by_id" uuid,
	"scheduled_by" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"problems" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_release_item" ADD CONSTRAINT "content_release_item_release_id_content_release_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."content_release"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_release_item" ADD CONSTRAINT "content_release_item_document_id_content_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."content_document"("id") ON DELETE cascade ON UPDATE no action;