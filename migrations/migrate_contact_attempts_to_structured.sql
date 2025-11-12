-- Migration: Convert legacy unresponsiveNotes to structured contactAttemptsLog
-- This SQL script migrates legacy contact attempts from text format to JSONB format
-- Run this in your production database after verifying the schema has contact_attempts_log column

-- Step 1: Preview what will be migrated (run this first to see what will be updated)
-- Uncomment and run to preview:
/*
SELECT 
  id,
  organization_name,
  LENGTH(unresponsive_notes) as notes_length,
  CASE 
    WHEN contact_attempts_log IS NULL THEN 'NULL'
    WHEN contact_attempts_log = '[]'::jsonb THEN 'EMPTY'
    ELSE 'HAS_DATA'
  END as log_status,
  unresponsive_notes
FROM event_requests
WHERE unresponsive_notes IS NOT NULL 
  AND unresponsive_notes != ''
  AND (contact_attempts_log IS NULL OR contact_attempts_log = '[]'::jsonb)
ORDER BY id;
*/

-- Step 2: Migrate the data
-- This will parse legacy unresponsiveNotes and convert to structured contactAttemptsLog
-- WARNING: Test this on a backup or staging environment first!

UPDATE event_requests
SET contact_attempts_log = (
  WITH attempts AS (
    SELECT 
      id,
      unresponsive_notes,
      -- Split by double newlines to get individual attempts
      unnest(string_to_array(unresponsive_notes, E'\n\n')) as attempt_text
    FROM event_requests
    WHERE id = event_requests.id
      AND unresponsive_notes IS NOT NULL
      AND unresponsive_notes != ''
  ),
  parsed_attempts AS (
    SELECT 
      id,
      attempt_text,
      -- Extract date from [Nov 7, 2025, 4:21 PM] format
      (regexp_match(attempt_text, '\[([^\]]+)\]'))[1] as date_str,
      -- Extract attempt number
      (regexp_match(attempt_text, 'Attempt\s*#(\d+)', 'i'))[1]::integer as attempt_num,
      -- Extract method (Email, Phone, etc.)
      TRIM((regexp_match(attempt_text, 'Attempt\s*#\d+\s*-\s*([^:]+):', 'i'))[1]) as method_raw,
      -- Extract content after method
      TRIM((regexp_match(attempt_text, 'Attempt\s*#\d+\s*-\s*[^:]+:\s*(.+)', 'i'))[1]) as content_raw
    FROM attempts
    WHERE attempt_text ~* 'Attempt\s*#\d+'
  ),
  normalized_attempts AS (
    SELECT 
      id,
      attempt_num,
      -- Parse date, fallback to NOW() if can't parse
      CASE 
        WHEN date_str IS NOT NULL THEN
          COALESCE(
            (date_str::timestamptz),  -- Try direct cast
            (to_timestamp(date_str, 'Mon DD, YYYY, HH:MI AM')),  -- Try "Nov 7, 2025, 4:21 PM"
            (to_timestamp(date_str, 'Mon DD, YYYY HH:MI AM')),   -- Try "Nov 7, 2025 4:21 PM"
            (to_timestamp(date_str, 'MM/DD/YYYY HH:MI AM')),     -- Try "11/7/2025 4:21 PM"
            NOW()  -- Fallback
          )
        ELSE NOW()
      END as attempt_timestamp,
      -- Normalize method
      CASE 
        WHEN LOWER(method_raw) LIKE '%phone%' THEN 'phone'
        WHEN LOWER(method_raw) LIKE '%email%' THEN 'email'
        WHEN LOWER(method_raw) LIKE '%both%' OR LOWER(method_raw) LIKE '%phone%email%' THEN 'both'
        ELSE 'unknown'
      END as method,
      -- Extract outcome and notes from content
      CASE 
        WHEN content_raw LIKE '%Successfully contacted%' OR content_raw LIKE '%Got response%' THEN 'successful'
        WHEN content_raw LIKE '%No answer%' OR content_raw LIKE '%No response%' THEN 'no_answer'
        WHEN content_raw LIKE '%Left%' OR content_raw LIKE '%voicemail%' OR content_raw LIKE '%message%' THEN 'left_message'
        WHEN content_raw LIKE '%Wrong%' OR content_raw LIKE '%disconnected%' THEN 'wrong_number'
        WHEN content_raw LIKE '%bounced%' OR content_raw LIKE '%failed%' THEN 'email_bounced'
        WHEN content_raw LIKE '%callback%' OR content_raw LIKE '%follow-up%' OR content_raw LIKE '%followup%' THEN 'requested_callback'
        ELSE 'other'
      END as outcome,
      -- Extract notes (content after " - " if present)
      CASE 
        WHEN content_raw LIKE '% - %' THEN
          TRIM(SUBSTRING(content_raw FROM POSITION(' - ' IN content_raw) + 3))
        ELSE NULL
      END as notes
    FROM parsed_attempts
    WHERE attempt_num IS NOT NULL
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'attemptNumber', attempt_num,
      'timestamp', attempt_timestamp::text,
      'method', method,
      'outcome', outcome,
      'notes', notes,
      'createdBy', 'system',
      'createdByName', 'Legacy Migration'
    )
    ORDER BY attempt_num
  )
  FROM normalized_attempts
  WHERE id = event_requests.id
)
WHERE unresponsive_notes IS NOT NULL
  AND unresponsive_notes != ''
  AND (contact_attempts_log IS NULL OR contact_attempts_log = '[]'::jsonb)
  AND unresponsive_notes ~* 'Attempt\s*#\d+';  -- Only update if contains attempt pattern

-- Step 3: Verify the migration
-- Run this to see how many records were migrated:
/*
SELECT 
  COUNT(*) as total_migrated,
  SUM(jsonb_array_length(contact_attempts_log)) as total_attempts_migrated
FROM event_requests
WHERE contact_attempts_log IS NOT NULL
  AND contact_attempts_log != '[]'::jsonb
  AND contact_attempts_log @> '[{"createdByName": "Legacy Migration"}]'::jsonb;
*/

-- Step 4: Check for any records that couldn't be migrated
-- These might need manual review:
/*
SELECT 
  id,
  organization_name,
  unresponsive_notes
FROM event_requests
WHERE unresponsive_notes IS NOT NULL
  AND unresponsive_notes != ''
  AND (contact_attempts_log IS NULL OR contact_attempts_log = '[]'::jsonb)
  AND NOT (unresponsive_notes ~* 'Attempt\s*#\d+');  -- Records that don't match the pattern
*/

-- Notes:
-- 1. This migration preserves the original unresponsive_notes field (doesn't delete it)
-- 2. Only records with the "Attempt #" pattern are migrated
-- 3. Records that don't match the pattern are left unchanged
-- 4. You can run this multiple times safely (it only updates records that haven't been migrated)
-- 5. After verifying the migration, you can optionally clear unresponsive_notes:
--    UPDATE event_requests 
--    SET unresponsive_notes = NULL 
--    WHERE contact_attempts_log IS NOT NULL 
--      AND jsonb_array_length(contact_attempts_log) > 0;

