ALTER TABLE "product" ADD COLUMN "sell_online" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "offline_action" text DEFAULT 'stockist' NOT NULL;