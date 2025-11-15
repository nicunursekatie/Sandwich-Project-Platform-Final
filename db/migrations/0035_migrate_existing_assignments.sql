-- Migration: 0035_migrate_existing_assignments.sql
-- Purpose: Migrate existing assignment data to new junction tables
-- Date: 2025-11-15
-- Breaking: No (dual-write period - keeps old columns intact)

-- ============================================================================
-- MIGRATE PROJECT ASSIGNMENTS
-- ============================================================================

-- Step 1: Migrate single owner from assigneeId/assigneeName to owner_id/owner_name
UPDATE projects
SET
  owner_id = assignee_id,
  owner_name = assignee_name
WHERE assignee_id IS NOT NULL;

-- Step 2: Migrate single assignee to project_assignments as 'owner'
INSERT INTO project_assignments (project_id, user_id, user_name, role, added_at)
SELECT
  id as project_id,
  assignee_id as user_id,
  assignee_name as user_name,
  'owner' as role,
  created_at as added_at
FROM projects
WHERE assignee_id IS NOT NULL
ON CONFLICT (project_id, user_id) DO NOTHING;

-- Step 3: Migrate multi-assignees from assigneeIds JSONB array
-- This handles the new multi-assignee format
-- Note: This is PostgreSQL-specific for JSONB array handling
WITH multi_assignees AS (
  SELECT
    p.id as project_id,
    jsonb_array_elements_text(p.assignee_ids)::INTEGER as user_id,
    p.created_at
  FROM projects p
  WHERE p.assignee_ids IS NOT NULL
    AND jsonb_typeof(p.assignee_ids) = 'array'
    AND jsonb_array_length(p.assignee_ids) > 0
)
INSERT INTO project_assignments (project_id, user_id, user_name, role, added_at)
SELECT
  ma.project_id,
  ma.user_id,
  COALESCE(u.full_name, 'Unknown User') as user_name,
  'owner' as role,
  ma.created_at
FROM multi_assignees ma
LEFT JOIN users u ON u.id = ma.user_id
ON CONFLICT (project_id, user_id) DO NOTHING;

-- Step 4: Migrate support people from supportPeopleIds JSONB array
WITH support_people AS (
  SELECT
    p.id as project_id,
    jsonb_array_elements_text(p.support_people_ids)::INTEGER as user_id,
    p.created_at
  FROM projects p
  WHERE p.support_people_ids IS NOT NULL
    AND jsonb_typeof(p.support_people_ids) = 'array'
    AND jsonb_array_length(p.support_people_ids) > 0
)
INSERT INTO project_assignments (project_id, user_id, user_name, role, added_at)
SELECT
  sp.project_id,
  sp.user_id,
  COALESCE(u.full_name, 'Unknown User') as user_name,
  'support' as role,
  sp.created_at
FROM support_people sp
LEFT JOIN users u ON u.id = sp.user_id
ON CONFLICT (project_id, user_id) DO NOTHING;

-- ============================================================================
-- MIGRATE TASK ASSIGNMENTS
-- ============================================================================

-- Step 1: Migrate single assignee from assigneeId/assigneeName
INSERT INTO task_assignments (task_id, user_id, user_name, role, added_at)
SELECT
  id as task_id,
  assignee_id::INTEGER as user_id,
  assignee_name as user_name,
  'assignee' as role,
  created_at as added_at
FROM project_tasks
WHERE assignee_id IS NOT NULL
  AND assignee_id != ''
ON CONFLICT (task_id, user_id) DO NOTHING;

-- Step 2: Migrate multi-assignees from assigneeIds array
-- Note: assigneeIds in project_tasks is defined as text[] (array of text)
WITH task_multi_assignees AS (
  SELECT
    pt.id as task_id,
    unnest(pt.assignee_ids)::INTEGER as user_id,
    pt.created_at
  FROM project_tasks pt
  WHERE pt.assignee_ids IS NOT NULL
    AND array_length(pt.assignee_ids, 1) > 0
)
INSERT INTO task_assignments (task_id, user_id, user_name, role, added_at)
SELECT
  tma.task_id,
  tma.user_id,
  COALESCE(u.full_name, 'Unknown User') as user_name,
  'assignee' as role,
  tma.created_at
FROM task_multi_assignees tma
LEFT JOIN users u ON u.id = tma.user_id
ON CONFLICT (task_id, user_id) DO NOTHING;

-- ============================================================================
-- MIGRATE TEAM BOARD ASSIGNMENTS
-- ============================================================================

-- Migrate from assignedTo array (text array of user IDs)
WITH team_board_assignees AS (
  SELECT
    tbi.id as item_id,
    unnest(tbi.assigned_to)::INTEGER as user_id,
    tbi.created_at
  FROM team_board_items tbi
  WHERE tbi.assigned_to IS NOT NULL
    AND array_length(tbi.assigned_to, 1) > 0
)
INSERT INTO team_board_assignments (item_id, user_id, user_name, added_at)
SELECT
  tba.item_id,
  tba.user_id,
  COALESCE(u.full_name, 'Unknown User') as user_name,
  tba.created_at
FROM team_board_assignees tba
LEFT JOIN users u ON u.id = tba.user_id
ON CONFLICT (item_id, user_id) DO NOTHING;

-- ============================================================================
-- MIGRATE MEETING-PROJECT RELATIONSHIPS
-- ============================================================================

-- For projects that have reviewInNextMeeting = true, add them to the most recent meeting
-- This is a best-effort migration - may need manual adjustment
INSERT INTO meeting_projects (
  meeting_id,
  project_id,
  discussion_points,
  status,
  include_in_agenda,
  added_at
)
SELECT
  (SELECT id FROM meetings WHERE status != 'completed' ORDER BY date DESC, time DESC LIMIT 1) as meeting_id,
  p.id as project_id,
  p.meeting_discussion_points as discussion_points,
  CASE
    WHEN p.status = 'tabled' THEN 'tabled'
    ELSE 'planned'
  END as status,
  p.review_in_next_meeting as include_in_agenda,
  NOW() as added_at
FROM projects p
WHERE p.review_in_next_meeting = true
  AND EXISTS (SELECT 1 FROM meetings WHERE status != 'completed')
ON CONFLICT (meeting_id, project_id) DO NOTHING;

-- ============================================================================
-- VALIDATION QUERIES
-- ============================================================================
-- Run these to verify migration success:

-- Check project assignments were migrated
-- SELECT COUNT(*) as migrated_project_assignments FROM project_assignments;

-- Check task assignments were migrated
-- SELECT COUNT(*) as migrated_task_assignments FROM task_assignments;

-- Check team board assignments were migrated
-- SELECT COUNT(*) as migrated_team_board_assignments FROM team_board_assignments;

-- Check meeting-project relationships were created
-- SELECT COUNT(*) as migrated_meeting_projects FROM meeting_projects;

-- Find projects with old data but no new assignments (potential issues)
-- SELECT id, title FROM projects
-- WHERE (assignee_id IS NOT NULL OR assignee_ids IS NOT NULL OR support_people_ids IS NOT NULL)
--   AND NOT EXISTS (SELECT 1 FROM project_assignments WHERE project_id = projects.id);
