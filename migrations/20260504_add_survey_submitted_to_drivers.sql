-- Add survey_submitted field to drivers table
-- Tracks whether a driver has submitted the driver survey
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS survey_submitted BOOLEAN NOT NULL DEFAULT false;
