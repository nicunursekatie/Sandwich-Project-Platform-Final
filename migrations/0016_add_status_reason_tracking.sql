-- Add declined tracking fields
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "declined_reason" text;
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "declined_notes" text;
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "declined_at" timestamp;
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "declined_by" varchar;

-- Add cancelled tracking fields
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "cancelled_reason" text;
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "cancelled_notes" text;
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp;
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "cancelled_by" varchar;

-- Add enhanced postponement tracking fields
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "original_scheduled_date" timestamp;
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "postponed_at" timestamp;
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "postponed_by" varchar;
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "was_postponed" boolean DEFAULT false;
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "postponement_count" integer DEFAULT 0;
