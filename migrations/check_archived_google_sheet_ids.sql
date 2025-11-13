-- Check if archived projects have google_sheet_row_id stored
-- This is critical for the sync prevention logic

SELECT 
  'Archived Projects - Google Sheet Row ID Check' as info,
  original_project_id,
  title,
  google_sheet_row_id,
  archived_at,
  CASE 
    WHEN google_sheet_row_id IS NULL OR google_sheet_row_id = '' THEN '⚠️ MISSING - Sync will recreate!'
    ELSE '✅ Has ID - Should be protected'
  END as status
FROM archived_projects
WHERE original_project_id IN (113, 107, 109, 110, 86, 106, 105, 104)
ORDER BY archived_at DESC;

-- Check which active projects match archived projects by row ID
SELECT 
  'Active vs Archived Match by Row ID' as info,
  p.id as active_project_id,
  p.title,
  p.google_sheet_row_id,
  p.status,
  ap.original_project_id as archived_project_id,
  ap.archived_at,
  ap.google_sheet_row_id as archived_row_id,
  CASE 
    WHEN ap.google_sheet_row_id IS NULL OR ap.google_sheet_row_id = '' THEN '⚠️ Archived project missing row ID'
    WHEN p.google_sheet_row_id = ap.google_sheet_row_id THEN '⚠️ MATCH - Should have been blocked!'
    ELSE '✅ Different row IDs'
  END as match_status
FROM projects p
INNER JOIN archived_projects ap ON 
  (p.google_sheet_row_id IS NOT NULL AND p.google_sheet_row_id = ap.google_sheet_row_id) OR
  (p.google_sheet_row_id IS NULL AND LOWER(TRIM(p.title)) = LOWER(TRIM(ap.title)))
WHERE p.title IN ('Catchafire Video Creation', 'Cox Grant App', 'Whole Foods Grant', 'Zero Waste grant app')
ORDER BY p.id;

