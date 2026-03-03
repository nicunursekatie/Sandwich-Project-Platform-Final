ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "non_event_reason" text;
--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "non_event_notes" text;
--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "non_event_at" timestamp;
--> statement-breakpoint
ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "non_event_by" varchar;
