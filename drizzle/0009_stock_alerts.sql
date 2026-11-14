CREATE TABLE "stock_alert" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "stock_alert" ADD CONSTRAINT "stock_alert_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_alert_waiting_idx" ON "stock_alert" USING btree ("variant_id","email") WHERE "stock_alert"."notified_at" is null;--> statement-breakpoint
CREATE INDEX "stock_alert_variant_idx" ON "stock_alert" USING btree ("variant_id");