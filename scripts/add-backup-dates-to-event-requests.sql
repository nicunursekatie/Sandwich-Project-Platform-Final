-- Add backup_dates column to event_requests table
-- This allows storing multiple alternate dates for event requests

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS backup_dates JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN event_requests.backup_dates IS 'Array of backup/alternate dates in ISO format for when the primary desired date is not available';
