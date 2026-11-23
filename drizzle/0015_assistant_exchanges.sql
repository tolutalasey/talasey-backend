CREATE TABLE "assistant_exchange" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"page" text,
	"question" text NOT NULL,
	"had_photo" boolean DEFAULT false NOT NULL,
	"reply" text,
	"products" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gap" text,
	"handed_off" boolean DEFAULT false NOT NULL,
	"failed" boolean DEFAULT false NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"cached_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "assistant_exchange_created_idx" ON "assistant_exchange" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "assistant_exchange_conversation_idx" ON "assistant_exchange" USING btree ("conversation_id");