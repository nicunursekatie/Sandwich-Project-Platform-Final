-- Migration: Add missing columns to event_requests table
-- These columns exist in the Drizzle schema (shared/schema.ts) but were never migrated
-- admin_escalation_sent_at: Tracks when escalation emails were sent to admins
-- manual_entry_source: Records the source of manually entered event requests

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS admin_escalation_sent_at TIMESTAMP;
--> statement-breakpoint
ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS manual_entry_source VARCHAR;
