-- STEP 2: Check if duplicates are being recreated
-- Run this separately to see if Google Sheets sync is recreating archived projects

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

