CREATE TABLE IF NOT EXISTS "driver_vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"driver_id" integer NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"year" integer,
	"color" text,
	"cooler_capacity" integer,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "is_event_driver" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "wants_app_walkthrough" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "wants_text_alerts" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "temporarily_unavailable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "unavailable_note" text;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "unavailable_until" timestamp;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "holds_tsp_coolers" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "will_purchase_coolers" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "agreement_in_database" boolean DEFAULT false NOT NULL;
