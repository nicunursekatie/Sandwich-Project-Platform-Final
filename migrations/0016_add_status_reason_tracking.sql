-- Add declined tracking fields
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "declined_reason" text;
--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "declined_notes" text;
--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "declined_at" timestamp;
--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "declined_by" varchar;
--> statement-breakpoint
-- Add cancelled tracking fields
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "cancelled_reason" text;
--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "cancelled_notes" text;
--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp;
--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "cancelled_by" varchar;
--> statement-breakpoint
-- Add enhanced postponement tracking fields
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "original_scheduled_date" timestamp;
--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "postponed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "postponed_by" varchar;
--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "was_postponed" boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "postponement_count" integer DEFAULT 0;
