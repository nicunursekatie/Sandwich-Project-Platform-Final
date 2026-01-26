-- Add standby and stalled tracking fields to event_requests table
-- These fields support two new event statuses:
-- 1. 'standby' - waiting for organizer to work out details on their end (periodic check-ins)
-- 2. 'stalled' - no response after repeated outreach (kept in limbo for periodic follow-up)

-- Standby tracking fields (for 'standby' status - waiting on organizer)
ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS standby_reason TEXT;

--> statement-breakpoint

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS standby_expected_date TIMESTAMP;

--> statement-breakpoint

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS standby_notes TEXT;

--> statement-breakpoint

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS standby_marked_at TIMESTAMP;

--> statement-breakpoint

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS standby_marked_by VARCHAR(255);

--> statement-breakpoint

-- Stalled tracking fields (for 'stalled' status - no response after repeated outreach)
ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS stalled_reason TEXT;

--> statement-breakpoint

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS stalled_last_outreach_date TIMESTAMP;

--> statement-breakpoint

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS stalled_next_outreach_date TIMESTAMP;

--> statement-breakpoint

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS stalled_outreach_count INTEGER DEFAULT 0;

--> statement-breakpoint

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS stalled_notes TEXT;

--> statement-breakpoint

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS stalled_marked_at TIMESTAMP;

--> statement-breakpoint

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS stalled_marked_by VARCHAR(255);

--> statement-breakpoint

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS stalled_original_event_date TIMESTAMP;
