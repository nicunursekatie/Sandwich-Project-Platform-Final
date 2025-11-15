-- Migration: 0032_add_assignment_junction_tables_FIXED.sql
-- Purpose: Create junction tables for project, task, and team board assignments
-- Date: 2025-11-15
-- Breaking: No (additive only)
-- FIXED: Changed user_id from INTEGER to TEXT to match users.id type

-- ============================================================================
-- PROJECT ASSIGNMENTS
-- ============================================================================
DROP TABLE IF EXISTS project_assignments CASCADE;

CREATE TABLE project_assignments (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,  -- CHANGED FROM INTEGER TO TEXT
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
DROP TABLE IF EXISTS task_assignments CASCADE;

CREATE TABLE task_assignments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES project_tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,  -- CHANGED FROM INTEGER TO TEXT
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
DROP TABLE IF EXISTS team_board_assignments CASCADE;

CREATE TABLE team_board_assignments (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES team_board_items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,  -- CHANGED FROM INTEGER TO TEXT
  user_name TEXT NOT NULL,
  added_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(item_id, user_id)
);

CREATE INDEX idx_team_board_assignments_item ON team_board_assignments(item_id);
CREATE INDEX idx_team_board_assignments_user ON team_board_assignments(user_id);

COMMENT ON TABLE team_board_assignments IS 'Tracks all people assigned to team board items';
