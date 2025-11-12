-- Migration: Convert legacy unresponsiveNotes to structured contactAttemptsLog
-- Run this SQL script in your production database
-- This will parse legacy contact attempts and convert them to structured JSONB format

-- ============================================================================
-- STEP 1: PREVIEW (Run this first to see what will be migrated)
-- ============================================================================
-- Uncomment to preview:
/*
SELECT 
  id,
  organization_name,
  LENGTH(unresponsive_notes) as notes_length,
  CASE 
    WHEN contact_attempts_log IS NULL OR contact_attempts_log = '[]'::jsonb THEN 'NEEDS_MIGRATION'
    ELSE 'ALREADY_MIGRATED'
  END as status,
  LEFT(unresponsive_notes, 100) as notes_preview
FROM event_requests
WHERE unresponsive_notes IS NOT NULL 
  AND unresponsive_notes != ''
  AND (contact_attempts_log IS NULL OR contact_attempts_log = '[]'::jsonb)
ORDER BY id
LIMIT 20;
*/

-- ============================================================================
-- STEP 2: MIGRATION (Run this to migrate the data)
-- ============================================================================
-- This migration uses a PostgreSQL function to parse the legacy format
-- and convert it to structured JSONB format

-- First, create a helper function to parse dates
CREATE OR REPLACE FUNCTION parse_legacy_date(date_str TEXT)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
  -- Try various date formats
  BEGIN
    RETURN date_str::TIMESTAMP WITH TIME ZONE;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      RETURN TO_TIMESTAMP(date_str, 'Mon DD, YYYY, HH:MI AM');
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        RETURN TO_TIMESTAMP(date_str, 'Mon DD, YYYY HH:MI AM');
      EXCEPTION WHEN OTHERS THEN
        RETURN NOW();
      END;
    END;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Now run the migration
UPDATE event_requests
SET contact_attempts_log = (
  WITH attempt_lines AS (
    -- Split by double newlines to get individual attempts
    SELECT 
      id,
      unnest(string_to_array(unresponsive_notes, E'\n\n')) as attempt_line,
      row_number() OVER (PARTITION BY id ORDER BY unnest(string_to_array(unresponsive_notes, E'\n\n'))) as line_num
    FROM event_requests
    WHERE id = event_requests.id
      AND unresponsive_notes IS NOT NULL
      AND unresponsive_notes != ''
  ),
  parsed_attempts AS (
    SELECT 
      id,
      attempt_line,
      line_num,
      -- Extract date from [Nov 7, 2025, 4:21 PM] format
      (regexp_match(attempt_line, '\[([^\]]+)\]'))[1] as date_str,
      -- Extract attempt number from "Attempt #1" or "Attempt#1"
      (regexp_match(attempt_line, 'Attempt\s*#(\d+)', 'i'))[1]::integer as attempt_num,
      -- Extract method (Email, Phone, etc.) from "Attempt #1 - Email:"
      TRIM(BOTH FROM COALESCE(
        (regexp_match(attempt_line, 'Attempt\s*#\d+\s*-\s*([^:]+):', 'i'))[1],
        ''
      )) as method_raw,
      -- Extract everything after the method colon
      TRIM(BOTH FROM COALESCE(
        (regexp_match(attempt_line, 'Attempt\s*#\d+\s*-\s*[^:]+:\s*(.+)', 'is'))[1],
        attempt_line
      )) as content_raw
    FROM attempt_lines
    WHERE attempt_line ~* 'Attempt\s*#\d+'
  ),
  normalized_attempts AS (
    SELECT 
      id,
      COALESCE(attempt_num, line_num) as attempt_num,
      -- Parse date or use current time
      COALESCE(
        parse_legacy_date(date_str),
        NOW()
      ) as attempt_timestamp,
      -- Normalize method
      CASE 
        WHEN LOWER(method_raw) LIKE '%phone%' AND LOWER(method_raw) LIKE '%email%' THEN 'both'
        WHEN LOWER(method_raw) LIKE '%phone%' THEN 'phone'
        WHEN LOWER(method_raw) LIKE '%email%' THEN 'email'
        WHEN LOWER(method_raw) LIKE '%both%' THEN 'both'
        ELSE 'unknown'
      END as method,
      -- Normalize outcome based on content
      CASE 
        WHEN LOWER(content_raw) LIKE '%successfully contacted%' 
          OR LOWER(content_raw) LIKE '%got response%' 
          OR LOWER(content_raw) LIKE '%responded%' THEN 'successful'
        WHEN LOWER(content_raw) LIKE '%no answer%' 
          OR LOWER(content_raw) LIKE '%no response%' 
          OR LOWER(content_raw) LIKE '%did not answer%' THEN 'no_answer'
        WHEN LOWER(content_raw) LIKE '%left%voicemail%' 
          OR LOWER(content_raw) LIKE '%left%message%' 
          OR LOWER(content_raw) LIKE '%voicemail%' THEN 'left_message'
        WHEN LOWER(content_raw) LIKE '%wrong%number%' 
          OR LOWER(content_raw) LIKE '%disconnected%' 
          OR LOWER(content_raw) LIKE '%invalid%' THEN 'wrong_number'
        WHEN LOWER(content_raw) LIKE '%email%bounced%' 
          OR LOWER(content_raw) LIKE '%email%failed%' 
          OR LOWER(content_raw) LIKE '%bounced%' THEN 'email_bounced'
        WHEN LOWER(content_raw) LIKE '%callback%' 
          OR LOWER(content_raw) LIKE '%follow-up%' 
          OR LOWER(content_raw) LIKE '%followup%' 
          OR LOWER(content_raw) LIKE '%requested%' THEN 'requested_callback'
        ELSE 'other'
      END as outcome,
      -- Extract notes (content after " - " if present, otherwise use content)
      CASE 
        WHEN content_raw LIKE '% - %' THEN
          TRIM(BOTH FROM SUBSTRING(content_raw FROM POSITION(' - ' IN content_raw) + 3))
        ELSE content_raw
      END as notes
    FROM parsed_attempts
    WHERE attempt_num IS NOT NULL OR attempt_line != ''
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'attemptNumber', attempt_num,
      'timestamp', attempt_timestamp,
      'method', method,
      'outcome', outcome,
      'notes', NULLIF(TRIM(notes), ''),
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
  AND unresponsive_notes ~* 'Attempt\s*#\d+';  -- Only migrate records with attempt pattern

-- Clean up the helper function
DROP FUNCTION IF EXISTS parse_legacy_date(TEXT);

-- ============================================================================
-- STEP 3: VERIFY MIGRATION (Run this to check results)
-- ============================================================================
/*
-- Count migrated records
SELECT 
  COUNT(*) as total_migrated_records,
  SUM(jsonb_array_length(contact_attempts_log)) as total_attempts_migrated,
  AVG(jsonb_array_length(contact_attempts_log)) as avg_attempts_per_record
FROM event_requests
WHERE contact_attempts_log IS NOT NULL
  AND contact_attempts_log != '[]'::jsonb
  AND contact_attempts_log @> '[{"createdByName": "Legacy Migration"}]'::jsonb;

-- Sample migrated records
SELECT 
  id,
  organization_name,
  jsonb_array_length(contact_attempts_log) as attempt_count,
  contact_attempts_log
FROM event_requests
WHERE contact_attempts_log IS NOT NULL
  AND contact_attempts_log != '[]'::jsonb
  AND contact_attempts_log @> '[{"createdByName": "Legacy Migration"}]'::jsonb
LIMIT 5;
*/

-- ============================================================================
-- STEP 4: CHECK FOR UNMIGRATED RECORDS (Optional)
-- ============================================================================
/*
-- Records that still need migration (might have unusual formats)
SELECT 
  id,
  organization_name,
  unresponsive_notes,
  LENGTH(unresponsive_notes) as notes_length
FROM event_requests
WHERE unresponsive_notes IS NOT NULL
  AND unresponsive_notes != ''
  AND (contact_attempts_log IS NULL OR contact_attempts_log = '[]'::jsonb)
ORDER BY id;
*/

-- ============================================================================
-- STEP 5: CLEAN UP (Optional - only after verifying migration is successful)
-- ============================================================================
-- WARNING: Only run this after verifying the migration is complete and correct!
-- This will clear the legacy unresponsive_notes field for migrated records
/*
UPDATE event_requests
SET unresponsive_notes = NULL
WHERE contact_attempts_log IS NOT NULL
  AND contact_attempts_log != '[]'::jsonb
  AND jsonb_array_length(contact_attempts_log) > 0
  AND unresponsive_notes IS NOT NULL;
*/
