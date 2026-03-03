-- Migration 0044: Add non-event status columns to event_requests
-- Schema already defines these; DB was missing them (for status = 'non_event').
-- Safe to run: ADD COLUMN IF NOT EXISTS.

ALTER TABLE event_requests ADD COLUMN IF NOT EXISTS non_event_reason TEXT;
--> statement-breakpoint
ALTER TABLE event_requests ADD COLUMN IF NOT EXISTS non_event_notes TEXT;
--> statement-breakpoint
ALTER TABLE event_requests ADD COLUMN IF NOT EXISTS non_event_at TIMESTAMP;
--> statement-breakpoint
ALTER TABLE event_requests ADD COLUMN IF NOT EXISTS non_event_by VARCHAR;
