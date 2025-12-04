ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "willing_to_speak" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "latitude" numeric;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "longitude" numeric;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "geocoded_at" timestamp;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN IF NOT EXISTS "latitude" numeric;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN IF NOT EXISTS "longitude" numeric;--> statement-breakpoint
ALTER TABLE "recipients" ADD COLUMN IF NOT EXISTS "geocoded_at" timestamp;
