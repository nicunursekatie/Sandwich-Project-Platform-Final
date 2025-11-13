-- Check if recently archived projects still exist in projects table
-- Based on the archived projects shown in the CSV

-- STEP 1: Check if these specific archived projects still exist in projects table
-- If this returns ANY rows, those projects were NOT properly deleted - BAD!
SELECT 
  '⚠️ PROBLEM: These archived projects still exist in projects table!' as warning,
  p.id,
  p.title,
  p.status,
  p.google_sheet_row_id,
  ap.archived_at,
  ap.archived_by_name,
  ap.original_project_id as archived_project_id
FROM projects p
INNER JOIN archived_projects ap ON p.id = ap.original_project_id
WHERE ap.original_project_id IN (113, 107, 109, 110, 86, 106, 105, 104)
ORDER BY ap.archived_at DESC;

-- STEP 2: Show all projects with the same titles as recently archived ones
-- This helps identify if duplicates are being recreated
SELECT 
  'Active Projects with Same Titles as Archived' as info,
  p.id,
  p.title,
  p.status,
  p.google_sheet_row_id,
  p.updated_at as last_updated,
  (SELECT COUNT(*) FROM archived_projects WHERE title = p.title) as archived_versions_count
FROM projects p
WHERE p.title IN (
  SELECT DISTINCT title FROM archived_projects 
  WHERE original_project_id IN (113, 107, 109, 110, 86, 106, 105, 104)
)
ORDER BY p.title, p.id;

-- STEP 3: Count how many "Whole Foods Grant" projects exist (active)
SELECT 
  'Whole Foods Grant Duplicate Check' as info,
  COUNT(*) as active_versions,
  STRING_AGG(id::text, ', ') as project_ids,
  STRING_AGG(google_sheet_row_id::text, ', ') as google_sheet_row_ids
FROM projects
WHERE title = 'Whole Foods Grant';

-- STEP 4: Show archived "Whole Foods Grant" projects
SELECT 
  'Archived Whole Foods Grant Projects' as info,
  original_project_id as project_id,
  archived_at,
  archived_by_name,
  google_sheet_row_id
FROM archived_projects
WHERE title = 'Whole Foods Grant'
ORDER BY archived_at DESC;

