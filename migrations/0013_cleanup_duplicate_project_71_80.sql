-- Migration: Clean up duplicate project "Getting identified partners to add TSP to website/social media"
-- IDs: 71 (completed) and 80 (in_progress)
-- Created: 2025-01-XX

-- ============================================================================
-- STEP 1: INSPECT BOTH PROJECTS (Run this first to see the details)
-- ============================================================================
-- Compare the two projects to decide which to keep:

SELECT 
  id,
  title,
  status,
  description,
  priority,
  category,
  assignee_name,
  assignee_ids,
  support_people,
  due_date,
  completion_date,
  progress_percentage,
  notes,
  meeting_discussion_points,
  meeting_decision_items,
  google_sheet_row_id,
  created_at,
  updated_at,
  -- Check which has more recent updates
  CASE 
    WHEN id = 80 THEN 'KEEP - in_progress status'
    WHEN id = 71 THEN 'ARCHIVE - completed status'
  END as recommendation
FROM projects
WHERE id IN (71, 80)
ORDER BY id;

-- Check which project has associated tasks/comments
SELECT 'Tasks for project 71' as type, COUNT(*) as count
FROM project_tasks WHERE project_id = 71
UNION ALL
SELECT 'Tasks for project 80' as type, COUNT(*) as count
FROM project_tasks WHERE project_id = 80
UNION ALL
SELECT 'Comments for project 71' as type, COUNT(*) as count
FROM project_comments WHERE project_id = 71
UNION ALL
SELECT 'Comments for project 80' as type, COUNT(*) as count
FROM project_comments WHERE project_id = 80;

-- ============================================================================
-- STEP 2: MOVE TASKS FROM PROJECT 71 TO PROJECT 80
-- ============================================================================
-- Move all tasks from the completed duplicate (ID 71) to the active project (ID 80)
-- This preserves all task history with the active project

UPDATE project_tasks
SET project_id = 80,
    updated_at = NOW()
WHERE project_id = 71;

-- Also update task_completions if any exist
-- (Task completions are linked via task_id, not project_id, so they'll move automatically)

-- ============================================================================
-- STEP 3: ARCHIVE THE COMPLETED DUPLICATE (ID 71)
-- ============================================================================
-- Archive the completed version (ID 71) since ID 80 is still in_progress

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
WHERE id = 71
  AND NOT EXISTS (
    SELECT 1 FROM archived_projects 
    WHERE original_project_id = 71
  );

-- ============================================================================
-- STEP 4: DELETE THE COMPLETED DUPLICATE (ID 71)
-- ============================================================================
-- Delete the completed duplicate from projects table
-- Keep ID 80 (in_progress) as the active project

DELETE FROM projects
WHERE id = 71;

-- ============================================================================
-- STEP 5: VERIFY (Run this to confirm cleanup was successful)
-- ============================================================================
-- Should show only ID 80 with in_progress status
SELECT 
  id,
  title,
  status,
  created_at,
  updated_at
FROM projects
WHERE title = 'Getting identified partners to add TSP to website/social media';

-- Should show ID 71 in archived_projects
SELECT 
  id,
  original_project_id,
  title,
  category,
  priority,
  archived_at,
  completed_at
FROM archived_projects
WHERE original_project_id = 71;

-- Verify all tasks are now under project 80 (should show 8 tasks total)
SELECT 
  project_id,
  COUNT(*) as task_count
FROM project_tasks
WHERE project_id IN (71, 80)
GROUP BY project_id;

-- Should show 0 tasks for project 71, 8 tasks for project 80

