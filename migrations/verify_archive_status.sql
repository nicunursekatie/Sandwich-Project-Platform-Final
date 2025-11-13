-- Quick verification script to check archive status
-- Run this after archiving projects to verify it worked
-- No need to know specific project IDs - shows recent activity

-- STEP 1: Show recently archived projects (last 24 hours)
-- These should NOT exist in the projects table
SELECT 
  'Recently Archived Projects' as info,
  original_project_id as project_id,
  title,
  archived_at,
  archived_by_name,
  google_sheet_row_id
FROM archived_projects
WHERE archived_at >= NOW() - INTERVAL '24 hours'
ORDER BY archived_at DESC;

-- STEP 2: Check if recently archived projects still exist in projects table (BAD - they shouldn't!)
-- If this returns any rows, archiving didn't work properly
SELECT 
  '⚠️ PROBLEM: These archived projects still exist in projects table!' as warning,
  p.id,
  p.title,
  p.status,
  ap.archived_at,
  ap.archived_by_name
FROM projects p
INNER JOIN archived_projects ap ON p.id = ap.original_project_id
WHERE ap.archived_at >= NOW() - INTERVAL '24 hours'
ORDER BY ap.archived_at DESC;

-- STEP 3: Summary - Overall archive status
SELECT 
  'Summary' as category,
  CASE 
    WHEN category = 'active' THEN 'Active Projects'
    WHEN category = 'archived' THEN 'Archived Projects'
    WHEN category = 'orphaned' THEN '⚠️ Projects with status=archived (should be 0)'
  END as description,
  count
FROM (
  SELECT 
    'active' as category,
    COUNT(*) as count
  FROM projects
  WHERE status NOT IN ('completed', 'archived')
  
  UNION ALL
  
  SELECT 
    'archived' as category,
    COUNT(*) as count
  FROM archived_projects
  
  UNION ALL
  
  SELECT 
    'orphaned' as category,
    COUNT(*) as count
  FROM projects
  WHERE status = 'archived'
) summary
ORDER BY category;

-- STEP 4: Show last 10 archived projects with their details
SELECT 
  'Recent Archive History' as info,
  original_project_id as project_id,
  title,
  archived_at as archived_when,
  archived_by_name as archived_by,
  google_sheet_row_id,
  -- Check if project still exists (should be NULL/empty if properly archived)
  (SELECT COUNT(*) FROM projects WHERE id = archived_projects.original_project_id) as still_exists_in_projects
FROM archived_projects
ORDER BY archived_at DESC
LIMIT 10;

