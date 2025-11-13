-- Migration: Identify archived projects missing google_sheet_row_id
-- This diagnostic query helps identify archived projects that need manual review
-- Created: 2025-01-13

-- ============================================================================
-- STEP 1: Find archived projects without googleSheetRowId
-- ============================================================================
-- These are the problematic archived projects that could be recreated by sync

SELECT
  'Archived Projects Missing Row IDs' as report,
  ap.id as archived_id,
  ap.original_project_id,
  ap.title,
  ap.google_sheet_row_id,
  ap.archived_at,
  ap.archived_by_name,
  CASE
    WHEN ap.google_sheet_row_id IS NULL OR ap.google_sheet_row_id = '' THEN '⚠️ MISSING - At risk of recreation'
    ELSE '✅ Has Row ID - Protected'
  END as status
FROM archived_projects ap
WHERE ap.google_sheet_row_id IS NULL OR ap.google_sheet_row_id = ''
ORDER BY ap.archived_at DESC;

-- ============================================================================
-- STEP 2: Check for active projects that might be recreated duplicates
-- ============================================================================
-- Find active projects with same titles as archived projects missing row IDs

SELECT
  'Potential Duplicate Projects' as report,
  p.id as active_project_id,
  p.title,
  p.google_sheet_row_id as active_row_id,
  p.status as active_status,
  p.created_at as active_created_at,
  ap.id as archived_id,
  ap.original_project_id,
  ap.google_sheet_row_id as archived_row_id,
  ap.archived_at,
  CASE
    WHEN p.created_at > ap.archived_at THEN '🚨 LIKELY DUPLICATE - Active created after archive'
    WHEN LOWER(TRIM(p.title)) = LOWER(TRIM(ap.title)) THEN '⚠️ POSSIBLE DUPLICATE - Title match'
    ELSE '✅ Different projects'
  END as analysis
FROM archived_projects ap
INNER JOIN projects p ON LOWER(TRIM(p.title)) = LOWER(TRIM(ap.title))
WHERE ap.google_sheet_row_id IS NULL OR ap.google_sheet_row_id = ''
ORDER BY
  CASE WHEN p.created_at > ap.archived_at THEN 0 ELSE 1 END,
  ap.archived_at DESC;

-- ============================================================================
-- STEP 3: Find orphaned meeting notes from deleted/archived projects
-- ============================================================================
-- These meeting notes reference project IDs that no longer exist in the projects table

SELECT
  'Orphaned Meeting Notes' as report,
  mn.id as note_id,
  mn.project_id,
  mn.type,
  mn.content,
  mn.status,
  mn.created_at,
  mn.created_by_name,
  ap.title as archived_project_title,
  ap.archived_at,
  CASE
    WHEN ap.id IS NOT NULL THEN '📦 Project was archived'
    ELSE '🚨 Project deleted without archiving'
  END as project_status
FROM meeting_notes mn
LEFT JOIN projects p ON mn.project_id = p.id
LEFT JOIN archived_projects ap ON mn.project_id = ap.original_project_id
WHERE p.id IS NULL -- Project doesn't exist in active projects
ORDER BY mn.created_at DESC;

-- ============================================================================
-- STEP 4: Summary statistics
-- ============================================================================

SELECT
  'Summary Statistics' as report,
  (SELECT COUNT(*) FROM archived_projects WHERE google_sheet_row_id IS NULL OR google_sheet_row_id = '') as archived_missing_row_id,
  (SELECT COUNT(*) FROM archived_projects WHERE google_sheet_row_id IS NOT NULL AND google_sheet_row_id != '') as archived_with_row_id,
  (SELECT COUNT(DISTINCT mn.project_id) FROM meeting_notes mn LEFT JOIN projects p ON mn.project_id = p.id WHERE p.id IS NULL) as projects_with_orphaned_notes,
  (SELECT COUNT(*) FROM meeting_notes mn LEFT JOIN projects p ON mn.project_id = p.id WHERE p.id IS NULL) as total_orphaned_notes;

-- ============================================================================
-- NOTES FOR MANUAL REMEDIATION:
-- ============================================================================
--
-- If you find duplicates in STEP 2:
-- 1. Review each case to determine if the active project is a recreation
-- 2. If it is a duplicate, consider:
--    a. Migrating meeting_notes from old project ID to new project ID
--    b. Re-archiving the duplicate active project
--    c. Updating the archived_projects row with the googleSheetRowId from the active project
--
-- If you find orphaned meeting notes in STEP 3:
-- 1. Determine if there's a corresponding archived project
-- 2. If the project was recreated with a new ID, update meeting_notes.project_id
-- 3. If the project was permanently deleted, decide whether to:
--    a. Keep the notes for historical record
--    b. Delete the orphaned notes
--
-- Example remediation for duplicates:
--
-- -- Update meeting notes to point to new project ID
-- UPDATE meeting_notes
-- SET project_id = [new_project_id]
-- WHERE project_id = [old_project_id];
--
-- -- Update archived project with row ID
-- UPDATE archived_projects
-- SET google_sheet_row_id = '[row_id_from_active_project]'
-- WHERE original_project_id = [old_project_id];
--
-- -- Re-archive the duplicate
-- -- Use the application's archive endpoint or run archiveProject() function
--
