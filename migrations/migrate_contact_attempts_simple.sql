-- ============================================================================
-- SIMPLE MIGRATION: Convert legacy unresponsiveNotes to structured contactAttemptsLog
-- This is a simpler version that handles the most common patterns
-- Run this in your production database
-- ============================================================================

-- STEP 1: Preview what will be migrated (uncomment to run)
/*
SELECT 
  id,
  organization_name,
  CASE 
    WHEN contact_attempts_log IS NULL OR contact_attempts_log = '[]'::jsonb THEN 'NEEDS_MIGRATION'
    ELSE 'ALREADY_MIGRATED'
  END as status,
  LEFT(unresponsive_notes, 150) as notes_preview
FROM event_requests
WHERE unresponsive_notes IS NOT NULL 
  AND unresponsive_notes != ''
  AND (contact_attempts_log IS NULL OR contact_attempts_log = '[]'::jsonb)
ORDER BY id;
*/

-- STEP 2: Run the migration
-- This creates structured contact attempts from legacy text format
WITH migrated_data AS (
  SELECT 
    er.id,
    -- Build JSONB array of attempts by parsing the text
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'attemptNumber', 
          COALESCE(
            (regexp_match(attempt_line, 'Attempt\s*#(\d+)', 'i'))[1]::integer,
            row_number() OVER (PARTITION BY er.id ORDER BY attempt_line)
          ),
          'timestamp',
          COALESCE(
            -- Try to parse date from [Nov 7, 2025, 4:21 PM] format
            CASE 
              WHEN (regexp_match(attempt_line, '\[([^\]]+)\]'))[1] IS NOT NULL THEN
                (regexp_match(attempt_line, '\[([^\]]+)\]'))[1]::timestamptz
              ELSE NULL
            END,
            NOW()  -- Fallback to current time
          ),
          'method',
          CASE 
            WHEN LOWER(attempt_line) LIKE '%phone%' AND LOWER(attempt_line) LIKE '%email%' THEN 'both'
            WHEN LOWER(attempt_line) LIKE '%phone%' THEN 'phone'
            WHEN LOWER(attempt_line) LIKE '%email%' THEN 'email'
            ELSE 'unknown'
          END,
          'outcome',
          CASE 
            WHEN LOWER(attempt_line) LIKE '%successfully contacted%' 
              OR LOWER(attempt_line) LIKE '%got response%' THEN 'successful'
            WHEN LOWER(attempt_line) LIKE '%no answer%' 
              OR LOWER(attempt_line) LIKE '%no response%' THEN 'no_answer'
            WHEN LOWER(attempt_line) LIKE '%left%voicemail%' 
              OR LOWER(attempt_line) LIKE '%left%message%' THEN 'left_message'
            WHEN LOWER(attempt_line) LIKE '%wrong%' 
              OR LOWER(attempt_line) LIKE '%disconnected%' THEN 'wrong_number'
            WHEN LOWER(attempt_line) LIKE '%bounced%' THEN 'email_bounced'
            WHEN LOWER(attempt_line) LIKE '%callback%' 
              OR LOWER(attempt_line) LIKE '%follow-up%' THEN 'requested_callback'
            ELSE 'other'
          END,
          'notes',
          CASE 
            -- Extract notes after " - " if present
            WHEN attempt_line LIKE '% - %' THEN
              TRIM(SUBSTRING(attempt_line FROM POSITION(' - ' IN attempt_line) + 3))
            -- Or extract content after method colon
            WHEN attempt_line ~* 'Attempt\s*#\d+\s*-\s*[^:]+:\s*(.+)' THEN
              TRIM((regexp_match(attempt_line, 'Attempt\s*#\d+\s*-\s*[^:]+:\s*(.+)', 'is'))[1])
            ELSE NULL
          END,
          'createdBy', 'system',
          'createdByName', 'Legacy Migration'
        )
        ORDER BY 
          COALESCE(
            (regexp_match(attempt_line, 'Attempt\s*#(\d+)', 'i'))[1]::integer,
            row_number() OVER (PARTITION BY er.id ORDER BY attempt_line)
          )
      )
      FROM unnest(string_to_array(er.unresponsive_notes, E'\n\n')) as attempt_line
      WHERE attempt_line ~* 'Attempt\s*#\d+'  -- Only process lines with attempt pattern
    ) as migrated_log
  FROM event_requests er
  WHERE er.unresponsive_notes IS NOT NULL
    AND er.unresponsive_notes != ''
    AND (er.contact_attempts_log IS NULL OR er.contact_attempts_log = '[]'::jsonb)
    AND er.unresponsive_notes ~* 'Attempt\s*#\d+'  -- Only migrate records with attempt pattern
)
UPDATE event_requests er
SET contact_attempts_log = md.migrated_log
FROM migrated_data md
WHERE er.id = md.id
  AND md.migrated_log IS NOT NULL;

-- STEP 3: Verify migration results
/*
SELECT 
  COUNT(*) as total_migrated,
  SUM(jsonb_array_length(contact_attempts_log)) as total_attempts,
  MIN(jsonb_array_length(contact_attempts_log)) as min_attempts,
  MAX(jsonb_array_length(contact_attempts_log)) as max_attempts,
  AVG(jsonb_array_length(contact_attempts_log))::numeric(10,2) as avg_attempts
FROM event_requests
WHERE contact_attempts_log IS NOT NULL
  AND contact_attempts_log != '[]'::jsonb
  AND contact_attempts_log @> '[{"createdByName": "Legacy Migration"}]'::jsonb;
*/

-- STEP 4: Sample migrated records (to verify format)
/*
SELECT 
  id,
  organization_name,
  jsonb_array_length(contact_attempts_log) as attempt_count,
  contact_attempts_log->0 as first_attempt
FROM event_requests
WHERE contact_attempts_log IS NOT NULL
  AND contact_attempts_log != '[]'::jsonb
  AND contact_attempts_log @> '[{"createdByName": "Legacy Migration"}]'::jsonb
LIMIT 10;
*/

-- STEP 5: Check for records that still need migration
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

