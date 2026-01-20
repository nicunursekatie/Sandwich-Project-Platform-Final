-- Restore AI categorization columns that were incorrectly removed in migration 0024
-- These columns are used by the active AI categorization feature (/api/event-requests/:id/ai-categorize)

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS auto_categories jsonb;

--> statement-breakpoint

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS categorized_at timestamp;

--> statement-breakpoint

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS categorized_by varchar(255);
