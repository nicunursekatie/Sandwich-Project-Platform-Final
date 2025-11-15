-- Migration: 0034_add_tracking_columns.sql
-- Purpose: Add lifecycle tracking columns to existing tables
-- Date: 2025-11-15
-- Breaking: No (additive only)

-- ============================================================================
-- MEETING NOTES: Add conversion and selection tracking
-- ============================================================================

-- Track when a note is converted to a task
ALTER TABLE meeting_notes
  ADD COLUMN IF NOT EXISTS converted_to_task_id INTEGER REFERENCES project_tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS selected_for_agenda BOOLEAN NOT NULL DEFAULT false;

-- Index for finding converted notes
CREATE INDEX IF NOT EXISTS idx_meeting_notes_task ON meeting_notes(converted_to_task_id);

COMMENT ON COLUMN meeting_notes.converted_to_task_id IS 'If this note was converted to a task, references that task';
COMMENT ON COLUMN meeting_notes.converted_at IS 'Timestamp when note was converted to task';
COMMENT ON COLUMN meeting_notes.selected_for_agenda IS 'Whether this note should appear in the upcoming meeting agenda';

-- ============================================================================
-- PROJECT TASKS: Add origin tracking and agenda selection
-- ============================================================================

-- Track where the task came from
ALTER TABLE project_tasks
  ADD COLUMN IF NOT EXISTS origin_type TEXT NOT NULL DEFAULT 'manual' CHECK (origin_type IN ('manual', 'converted_from_note', 'team_board')),
  ADD COLUMN IF NOT EXISTS source_note_id INTEGER REFERENCES meeting_notes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_meeting_id INTEGER REFERENCES meetings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_team_board_id INTEGER REFERENCES team_board_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS selected_for_agenda BOOLEAN NOT NULL DEFAULT false;

-- Indexes for origin tracking
CREATE INDEX IF NOT EXISTS idx_project_tasks_note ON project_tasks(source_note_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_meeting ON project_tasks(source_meeting_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_team_board ON project_tasks(source_team_board_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_origin ON project_tasks(origin_type);

COMMENT ON COLUMN project_tasks.origin_type IS 'How this task was created: manual, converted_from_note, or team_board';
COMMENT ON COLUMN project_tasks.source_note_id IS 'If converted from note, references the source meeting note';
COMMENT ON COLUMN project_tasks.source_meeting_id IS 'If created in a meeting context, references that meeting';
COMMENT ON COLUMN project_tasks.source_team_board_id IS 'If promoted from team board, references the team board item';
COMMENT ON COLUMN project_tasks.selected_for_agenda IS 'Whether this task should appear in the upcoming meeting agenda';

-- ============================================================================
-- TEAM BOARD ITEMS: Add project linking and promotion tracking
-- ============================================================================

-- Allow team board items to optionally link to projects
ALTER TABLE team_board_items
  ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promoted_to_task_id INTEGER REFERENCES project_tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promoted_at TIMESTAMP;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_team_board_project ON team_board_items(project_id);
CREATE INDEX IF NOT EXISTS idx_team_board_promoted ON team_board_items(promoted_to_task_id);

COMMENT ON COLUMN team_board_items.project_id IS 'Optional link to a project for context';
COMMENT ON COLUMN team_board_items.promoted_to_task_id IS 'If promoted to project task, references that task';
COMMENT ON COLUMN team_board_items.promoted_at IS 'Timestamp when promoted to project task';

-- ============================================================================
-- PROJECTS: Add owner field (primary owner separate from multi-assignee)
-- ============================================================================

-- Add single owner field (will be populated from migration script)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS owner_id INTEGER,
  ADD COLUMN IF NOT EXISTS owner_name TEXT;

CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id);

COMMENT ON COLUMN projects.owner_id IS 'Primary owner of the project (single person ultimately responsible)';
COMMENT ON COLUMN projects.owner_name IS 'Display name of primary owner (denormalized for performance)';

-- ============================================================================
-- MEETING NOTES: Fix relationship priority (meetingId should be required)
-- ============================================================================

-- Make meeting_id NOT NULL (it should always be required)
-- First, update any null values to a default meeting or delete orphans
UPDATE meeting_notes SET meeting_id = (SELECT id FROM meetings ORDER BY created_at DESC LIMIT 1) WHERE meeting_id IS NULL;

-- Now make it NOT NULL
ALTER TABLE meeting_notes
  ALTER COLUMN meeting_id SET NOT NULL;

-- Make project_id nullable (notes don't always need a project)
ALTER TABLE meeting_notes
  ALTER COLUMN project_id DROP NOT NULL;

COMMENT ON COLUMN meeting_notes.meeting_id IS 'Meeting this note belongs to (required - notes always belong to a meeting)';
COMMENT ON COLUMN meeting_notes.project_id IS 'Optional project this note is about';
