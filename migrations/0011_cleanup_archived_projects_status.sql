-- Migration: Clean up projects with status='archived' in the projects table
-- These should have been moved to archived_projects table instead
-- Created: 2025-01-XX

-- ============================================================================
-- STEP 1: PREVIEW (Run this first to see what will be cleaned up)
-- ============================================================================
-- Uncomment to preview:
/*
SELECT 
  id,
  title,
  status,
  created_at,
  updated_at,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM archived_projects 
      WHERE original_project_id = projects.id 
      OR title = projects.title
    ) THEN 'ALREADY_ARCHIVED'
    ELSE 'NEEDS_ARCHIVING'
  END as action_needed
FROM projects
WHERE status = 'archived'
ORDER BY id;
*/

-- ============================================================================
-- STEP 2: ARCHIVE PROJECTS WITH status='archived' (Run this to fix the issue)
-- ============================================================================
-- For projects with status='archived' that don't exist in archived_projects,
-- create the archived record and then delete from projects table

-- First, archive projects that have status='archived' but aren't in archived_projects
INSERT INTO archived_projects (
  original_project_id,
  title,
  description,
  priority,
  category,
  assignee_id,
  assignee_name,
  assignee_ids,
  assignee_names,
  due_date,
  start_date,
  completion_date,
  progress_percentage,
  notes,
  requirements,
  deliverables,
  resources,
  blockers,
  tags,
  estimated_hours,
  actual_hours,
  budget,
  created_by,
  created_by_name,
  created_at,
  completed_at,
  archived_at,
  google_sheet_row_id
)
SELECT 
  id as original_project_id,
  title,
  description,
  COALESCE(priority, 'medium') as priority,
  COALESCE(category, 'general') as category,
  assignee_id,
  assignee_name,
  assignee_ids,
  assignee_names,
  due_date,
  start_date,
  COALESCE(completion_date, TO_CHAR(NOW(), 'YYYY-MM-DD')) as completion_date,
  COALESCE(progress_percentage, 100) as progress_percentage,
  notes,
  requirements,
  deliverables,
  resources,
  blockers,
  tags,
  estimated_hours,
  actual_hours,
  budget,
  created_by,
  created_by_name,
  created_at,
  COALESCE(completion_date::timestamp, NOW()) as completed_at,
  updated_at as archived_at,
  google_sheet_row_id
FROM projects
WHERE status = 'archived'
  AND NOT EXISTS (
    SELECT 1 FROM archived_projects 
    WHERE original_project_id = projects.id
  );

-- Now delete projects with status='archived' from the projects table
-- (This is safe because we've just copied them to archived_projects)
DELETE FROM projects
WHERE status = 'archived';
-- ============================================================================
-- STEP 3: VERIFY (Run this to confirm cleanup was successful)
-- ============================================================================
-- Uncomment to verify:
/*
-- Should return 0 rows (no projects with status='archived' in projects table)
SELECT COUNT(*) as remaining_archived_in_projects
FROM projects
WHERE status = 'archived';

-- Should show all archived projects in the archived_projects table
SELECT COUNT(*) as total_archived_projects
FROM archived_projects;
*/

