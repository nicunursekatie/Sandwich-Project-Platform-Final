-- Migration: Add contactAttemptsLog column to event_requests table
-- This enables structured storage of contact attempts with user attribution for editing/deleting

-- Add the new column
ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS contact_attempts_log JSONB DEFAULT '[]'::jsonb;

-- Add a comment to document the column
COMMENT ON COLUMN event_requests.contact_attempts_log IS 'Structured log of all contact attempts with metadata (attemptNumber, timestamp, method, outcome, notes, createdBy, createdByName) for editing/deleting';

-- Optional: Migrate existing unresponsiveNotes data to the new structured format
-- This migration attempts to parse existing unresponsive notes and convert them to structured format
-- Note: This is best-effort and may not capture all data perfectly

-- You can run this manually if you want to migrate existing data:
/*
UPDATE event_requests
SET contact_attempts_log = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'attemptNumber', attempt_num,
      'timestamp', attempt_time,
      'method', 'unknown',
      'outcome', 'unknown',
      'notes', attempt_line,
      'createdBy', 'system',
      'createdByName', 'Legacy Migration'
    )
  )
  FROM (
    SELECT
      ROW_NUMBER() OVER () as attempt_num,
      NOW() as attempt_time,
      unnest(string_to_array(unresponsive_notes, E'\n\n')) as attempt_line
    WHERE unresponsive_notes IS NOT NULL AND unresponsive_notes != ''
  ) subquery
)
WHERE unresponsive_notes IS NOT NULL
  AND unresponsive_notes != ''
  AND (contact_attempts_log IS NULL OR contact_attempts_log = '[]'::jsonb);
*/
