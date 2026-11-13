CREATE TYPE "public"."shipment_type" AS ENUM('parcel', 'pallet');--> statement-breakpoint
CREATE TYPE "public"."slot_hold_status" AS ENUM('held', 'booked', 'released');--> statement-breakpoint
CREATE TABLE "delivery_rate" (
	"zone" text NOT NULL,
	"shipment" "shipment_type" NOT NULL,
	"max_weight_kg" integer NOT NULL,
	"price_pence" integer NOT NULL,
	"sample" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "delivery_rate_zone_shipment_max_weight_kg_pk" PRIMARY KEY("zone","shipment","max_weight_kg")
);
--> statement-breakpoint
CREATE TABLE "delivery_slot_hold" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone" text NOT NULL,
	"date" date NOT NULL,
	"reference" text NOT NULL,
	"status" "slot_hold_status" DEFAULT 'held' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_slot_settings" (
	"zone" text PRIMARY KEY NOT NULL,
	"pallets_per_day" integer NOT NULL,
	"lead_time_days" integer NOT NULL,
	"sample" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_slot" (
	"zone" text NOT NULL,
	"date" date NOT NULL,
	"capacity" integer NOT NULL,
	CONSTRAINT "delivery_slot_zone_date_pk" PRIMARY KEY("zone","date")
);
--> statement-breakpoint
CREATE TABLE "delivery_zone" (
	"postcode_area" text PRIMARY KEY NOT NULL,
	"zone" text NOT NULL,
	"sample" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "delivery_slot_hold_slot_idx" ON "delivery_slot_hold" USING btree ("zone","date");--> statement-breakpoint
CREATE INDEX "delivery_slot_hold_reference_idx" ON "delivery_slot_hold" USING btree ("reference");