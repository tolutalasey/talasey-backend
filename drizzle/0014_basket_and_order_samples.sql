ALTER TABLE "basket" ADD COLUMN "samples" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "samples" jsonb DEFAULT '[]'::jsonb NOT NULL;