-- Migration: 0036_rollback_instructions.sql
-- Purpose: Instructions and SQL for rolling back migrations 0032-0035 if needed
-- Date: 2025-11-15
-- NOTE: DO NOT RUN THIS unless you need to rollback!

-- ============================================================================
-- ROLLBACK INSTRUCTIONS
-- ============================================================================
-- If you need to rollback these migrations, run the following commands IN ORDER:
--
-- 1. First, ensure your application code is still reading from old columns
-- 2. Stop the application server
-- 3. Run this rollback script
-- 4. Restart the application with old code
--
-- WARNING: This will delete all data in the new tables!
-- Only rollback if absolutely necessary and you have a backup!
-- ============================================================================

-- Step 1: Remove new columns from existing tables
ALTER TABLE meeting_notes
  DROP COLUMN IF EXISTS converted_to_task_id,
  DROP COLUMN IF EXISTS converted_at,
  DROP COLUMN IF EXISTS selected_for_agenda;

ALTER TABLE project_tasks
  DROP COLUMN IF EXISTS origin_type,
  DROP COLUMN IF EXISTS source_note_id,
  DROP COLUMN IF EXISTS source_meeting_id,
  DROP COLUMN IF EXISTS source_team_board_id,
  DROP COLUMN IF EXISTS selected_for_agenda;

ALTER TABLE team_board_items
  DROP COLUMN IF EXISTS project_id,
  DROP COLUMN IF EXISTS promoted_to_task_id,
  DROP COLUMN IF EXISTS promoted_at;

ALTER TABLE projects
  DROP COLUMN IF EXISTS owner_id,
  DROP COLUMN IF EXISTS owner_name;

-- Revert meeting_notes constraints
ALTER TABLE meeting_notes
  ALTER COLUMN meeting_id DROP NOT NULL;

-- Step 2: Drop new junction tables
DROP TABLE IF EXISTS meeting_projects CASCADE;
DROP TABLE IF EXISTS task_assignments CASCADE;
DROP TABLE IF EXISTS team_board_assignments CASCADE;
DROP TABLE IF EXISTS project_assignments CASCADE;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After rollback, verify old columns still have data:

-- SELECT COUNT(*) FROM projects WHERE assignee_id IS NOT NULL;
-- SELECT COUNT(*) FROM projects WHERE assignee_ids IS NOT NULL;
-- SELECT COUNT(*) FROM projects WHERE support_people_ids IS NOT NULL;
-- SELECT COUNT(*) FROM project_tasks WHERE assignee_id IS NOT NULL;
-- SELECT COUNT(*) FROM team_board_items WHERE assigned_to IS NOT NULL;
