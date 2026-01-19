-- Remove unused AI categorization columns from event_requests table
-- These columns were planned but never implemented (no code references found)
-- See: docs/event-requests-schema-audit.md

-- First, backup any data that might exist (just in case)
-- CREATE TABLE IF NOT EXISTS _backup_ai_categorization AS
-- SELECT id, auto_categories, categorized_at, categorized_by
-- FROM event_requests
-- WHERE auto_categories IS NOT NULL OR categorized_at IS NOT NULL OR categorized_by IS NOT NULL;

-- Remove the unused AI categorization columns
ALTER TABLE event_requests
DROP COLUMN IF EXISTS auto_categories;

--> statement-breakpoint

ALTER TABLE event_requests
DROP COLUMN IF EXISTS categorized_at;

--> statement-breakpoint

ALTER TABLE event_requests
DROP COLUMN IF EXISTS categorized_by;

--> statement-breakpoint

-- Also remove other unused/superseded columns identified in the audit
-- followUpMethod is superseded by communicationMethod
ALTER TABLE event_requests
DROP COLUMN IF EXISTS follow_up_method;

--> statement-breakpoint

-- unresponsiveReason is superseded by unresponsiveNotes
ALTER TABLE event_requests
DROP COLUMN IF EXISTS unresponsive_reason;

--> statement-breakpoint

-- contactedAt has no code references
ALTER TABLE event_requests
DROP COLUMN IF EXISTS contacted_at;

--> statement-breakpoint

-- contactCompletionNotes has no code references
ALTER TABLE event_requests
DROP COLUMN IF EXISTS contact_completion_notes;

--> statement-breakpoint

-- completedByUserId has no code references
ALTER TABLE event_requests
DROP COLUMN IF EXISTS completed_by_user_id;

--> statement-breakpoint

-- updatedEmail has no code references
ALTER TABLE event_requests
DROP COLUMN IF EXISTS updated_email;

--> statement-breakpoint

-- assignedDriverSpeakers was a concept that was never implemented
ALTER TABLE event_requests
DROP COLUMN IF EXISTS assigned_driver_speakers;
