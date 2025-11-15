-- Migration: 0032_add_assignment_junction_tables.sql
-- Purpose: Create junction tables for project, task, and team board assignments
-- Date: 2025-11-15
-- Breaking: No (additive only)

-- ============================================================================
-- PROJECT ASSIGNMENTS
-- ============================================================================
-- Replaces the multiple assignee fields (assigneeId, assigneeIds, supportPeopleIds, etc.)
-- with a clean junction table that supports role-based assignments

CREATE TABLE IF NOT EXISTS project_assignments (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  user_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'support')),
  added_at TIMESTAMP NOT NULL DEFAULT NOW(),
  added_by VARCHAR,
  UNIQUE(project_id, user_id)
);

CREATE INDEX idx_project_assignments_project ON project_assignments(project_id);
CREATE INDEX idx_project_assignments_user ON project_assignments(user_id);
CREATE INDEX idx_project_assignments_role ON project_assignments(role);

COMMENT ON TABLE project_assignments IS 'Tracks all people assigned to projects with owner/support roles';
COMMENT ON COLUMN project_assignments.role IS 'Either owner (primary responsible) or support (helping)';

-- ============================================================================
-- TASK ASSIGNMENTS
-- ============================================================================
-- Replaces task assignee fields with consistent junction table approach

CREATE TABLE IF NOT EXISTS task_assignments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  user_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'assignee' CHECK (role IN ('assignee', 'reviewer')),
  added_at TIMESTAMP NOT NULL DEFAULT NOW(),
  added_by VARCHAR,
  UNIQUE(task_id, user_id)
);

CREATE INDEX idx_task_assignments_task ON task_assignments(task_id);
CREATE INDEX idx_task_assignments_user ON task_assignments(user_id);

COMMENT ON TABLE task_assignments IS 'Tracks all people assigned to project tasks';

-- ============================================================================
-- TEAM BOARD ASSIGNMENTS
-- ============================================================================
-- Replaces the array fields in team_board_items for consistent assignment tracking

CREATE TABLE IF NOT EXISTS team_board_assignments (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES team_board_items(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  user_name TEXT NOT NULL,
  added_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(item_id, user_id)
);

CREATE INDEX idx_team_board_assignments_item ON team_board_assignments(item_id);
CREATE INDEX idx_team_board_assignments_user ON team_board_assignments(user_id);

COMMENT ON TABLE team_board_assignments IS 'Tracks all people assigned to team board items';
