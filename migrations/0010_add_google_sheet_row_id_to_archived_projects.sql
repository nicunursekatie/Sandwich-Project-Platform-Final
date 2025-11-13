-- Migration: Add google_sheet_row_id column to archived_projects table
-- This prevents Google Sheets sync from re-importing archived projects
-- Created: 2025-01-XX

-- Add the new column to archived_projects table
ALTER TABLE archived_projects
ADD COLUMN IF NOT EXISTS google_sheet_row_id TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN archived_projects.google_sheet_row_id IS 'Google Sheet row ID of the original project, used to prevent re-importing archived projects during sync';

-- Create an index to improve lookup performance during Google Sheets sync
CREATE INDEX IF NOT EXISTS idx_archived_projects_google_sheet_row_id 
ON archived_projects(google_sheet_row_id) 
WHERE google_sheet_row_id IS NOT NULL;

-- Note: Existing archived projects will have NULL for this column, which is fine.
-- The Google Sheets sync logic will fall back to title matching for those cases.

