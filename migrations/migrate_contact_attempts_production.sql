-- ============================================================================
-- PRODUCTION MIGRATION: Convert legacy unresponsiveNotes to contactAttemptsLog
-- Run this SQL directly in your production database
-- ============================================================================

-- STEP 1: BACKUP FIRST (recommended)
-- Run this to create a backup of records that will be migrated:
/*
CREATE TABLE event_requests_backup_contact_attempts AS
SELECT id, unresponsive_notes, contact_attempts_log
FROM event_requests
WHERE unresponsive_notes IS NOT NULL
  AND unresponsive_notes != '';
*/

-- STEP 2: PREVIEW (optional - see what will be migrated)
/*
SELECT 
  id,
  organization_name,
  LEFT(unresponsive_notes, 100) as notes_preview,
  CASE 
    WHEN contact_attempts_log IS NULL OR contact_attempts_log = '[]'::jsonb THEN 'WILL_MIGRATE'
    ELSE 'ALREADY_HAS_DATA'
  END as status
FROM event_requests
WHERE unresponsive_notes IS NOT NULL 
  AND unresponsive_notes != ''
  AND (contact_attempts_log IS NULL OR contact_attempts_log = '[]'::jsonb)
ORDER BY id
LIMIT 20;
*/

-- STEP 3: RUN MIGRATION
-- This is the main migration query - run this to migrate the data
-- WARNING: Test on a backup first!
UPDATE event_requests
SET contact_attempts_log = (
  WITH attempt_lines AS (
    SELECT 
      unnest(string_to_array(event_requests.unresponsive_notes, E'\n\n')) as line,
      row_number() OVER () as line_num
  ),
  parsed_attempts AS (
    SELECT 
      line,
      line_num,
      -- Extract attempt number
      COALESCE(
        NULLIF((regexp_match(line, 'Attempt\s*#(\d+)', 'i'))[1], '')::integer,
        line_num
      ) as attempt_num,
      -- Extract date string (keep as text, app will parse it)
      (regexp_match(line, '\[([^\]]+)\]'))[1] as date_str,
      -- Determine method
      CASE 
        WHEN LOWER(line) LIKE '%phone%email%' OR LOWER(line) LIKE '%email%phone%' THEN 'both'
        WHEN LOWER(line) LIKE '%phone%' THEN 'phone'
        WHEN LOWER(line) LIKE '%email%' THEN 'email'
        ELSE 'unknown'
      END as method,
      -- Determine outcome
      CASE 
        WHEN LOWER(line) LIKE '%successfully contacted%' 
          OR LOWER(line) LIKE '%got response%' 
          OR LOWER(line) LIKE '%responded%' THEN 'successful'
        WHEN LOWER(line) LIKE '%no answer%' 
          OR LOWER(line) LIKE '%no response%' THEN 'no_answer'
        WHEN LOWER(line) LIKE '%left%voicemail%' 
          OR LOWER(line) LIKE '%left%message%' THEN 'left_message'
        WHEN LOWER(line) LIKE '%wrong%number%' 
          OR LOWER(line) LIKE '%disconnected%' THEN 'wrong_number'
        WHEN LOWER(line) LIKE '%bounced%' THEN 'email_bounced'
        WHEN LOWER(line) LIKE '%callback%' 
          OR LOWER(line) LIKE '%follow-up%' 
          OR LOWER(line) LIKE '%followup%' THEN 'requested_callback'
        ELSE 'other'
      END as outcome,
      -- Extract notes (content after " - " or after method colon)
      CASE 
        WHEN line LIKE '% - %' THEN
          TRIM(SUBSTRING(line FROM POSITION(' - ' IN line) + 3))
        WHEN line ~* ':\s+(.+)$' THEN
          TRIM((regexp_match(line, ':\s+(.+)$'))[1])
        ELSE NULL
      END as notes
    FROM attempt_lines
    WHERE line ~* 'Attempt\s*#\d+'
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'attemptNumber', attempt_num,
      'timestamp', NOW()::text,  -- Use current time for migrated records (original date preserved in notes)
      'method', method,
      'outcome', outcome,
      'notes', 
      -- Include original date in notes if it exists, along with other notes
      CASE 
        WHEN date_str IS NOT NULL AND notes IS NOT NULL THEN
          '[' || date_str || '] ' || TRIM(notes)
        WHEN date_str IS NOT NULL THEN
          '[' || date_str || ']'
        WHEN notes IS NOT NULL THEN
          TRIM(notes)
        ELSE NULL
      END,
      'createdBy', 'system',
      'createdByName', 'Legacy Migration'
    )
    ORDER BY attempt_num
  )
  FROM parsed_attempts
)
WHERE unresponsive_notes IS NOT NULL
  AND unresponsive_notes != ''
  AND (contact_attempts_log IS NULL OR contact_attempts_log = '[]'::jsonb)
  AND unresponsive_notes ~* 'Attempt\s*#\d+';

-- STEP 4: VERIFY MIGRATION
-- Run this to see migration statistics:
/*
SELECT 
  COUNT(*) as total_migrated_records,
  SUM(jsonb_array_length(contact_attempts_log)) as total_attempts_migrated,
  AVG(jsonb_array_length(contact_attempts_log))::numeric(10,2) as avg_attempts_per_record
FROM event_requests
WHERE contact_attempts_log IS NOT NULL
  AND contact_attempts_log != '[]'::jsonb
  AND contact_attempts_log @> '[{"createdByName": "Legacy Migration"}]'::jsonb;
*/

-- STEP 5: SAMPLE MIGRATED DATA
-- Run this to see examples of migrated records:
/*
SELECT 
  id,
  organization_name,
  jsonb_array_length(contact_attempts_log) as attempt_count,
  contact_attempts_log->0 as first_attempt_example
FROM event_requests
WHERE contact_attempts_log IS NOT NULL
  AND contact_attempts_log != '[]'::jsonb
  AND contact_attempts_log @> '[{"createdByName": "Legacy Migration"}]'::jsonb
ORDER BY id
LIMIT 10;
*/

-- STEP 6: CHECK FOR UNMIGRATED RECORDS
-- Run this to see if any records still need migration:
/*
SELECT 
  id,
  organization_name,
  LEFT(unresponsive_notes, 200) as notes_preview
FROM event_requests
WHERE unresponsive_notes IS NOT NULL
  AND unresponsive_notes != ''
  AND (contact_attempts_log IS NULL OR contact_attempts_log = '[]'::jsonb);
*/

-- NOTES:
-- 1. This migration preserves the original unresponsive_notes field
-- 2. Only records with "Attempt #" pattern are migrated
-- 3. Date parsing may not be perfect - timestamps will be ISO strings
-- 4. You can run this multiple times safely (only updates records that haven't been migrated)
-- 5. After verifying, you can optionally clear unresponsive_notes (see below)

-- OPTIONAL: Clean up legacy data after verifying migration (uncomment to run)
-- WARNING: Only run this after verifying migration is successful!
/*
UPDATE event_requests
SET unresponsive_notes = NULL
WHERE contact_attempts_log IS NOT NULL
  AND contact_attempts_log != '[]'::jsonb
  AND jsonb_array_length(contact_attempts_log) > 0
  AND contact_attempts_log @> '[{"createdByName": "Legacy Migration"}]'::jsonb;
*/

