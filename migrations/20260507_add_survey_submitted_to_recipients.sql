-- Add survey_submitted + survey_submitted_date fields to recipients table
-- Tracks whether a recipient has submitted their recipient survey, and
-- optionally when they submitted it.
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS survey_submitted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS survey_submitted_date TIMESTAMP;
