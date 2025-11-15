-- Migration: 0033_add_meeting_projects_junction.sql
-- Purpose: Create junction table to track which projects are in which meetings
-- Date: 2025-11-15
-- Breaking: No (additive only)

-- ============================================================================
-- MEETING PROJECTS JUNCTION
-- ============================================================================
-- Replaces the boolean "reviewInNextMeeting" and text fields on projects
-- with a proper many-to-many relationship that tracks:
-- - Which projects are in which meetings
-- - Pre-meeting discussion points and questions
-- - Post-meeting discussion summary and decisions
-- - Agenda ordering and selection

CREATE TABLE IF NOT EXISTS meeting_projects (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Pre-meeting planning
  discussion_points TEXT,
  questions_to_address TEXT,

  -- Post-meeting outcomes
  discussion_summary TEXT,
  decisions_reached TEXT,

  -- Status and agenda control
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'discussed', 'tabled', 'deferred')),
  include_in_agenda BOOLEAN NOT NULL DEFAULT true,

  -- Ordering and categorization
  agenda_order INTEGER,
  section TEXT CHECK (section IN ('urgent', 'old_business', 'new_business', 'housekeeping')),

  -- Audit trail
  added_at TIMESTAMP NOT NULL DEFAULT NOW(),
  added_by VARCHAR,
  discussed_at TIMESTAMP,

  UNIQUE(meeting_id, project_id)
);

CREATE INDEX idx_meeting_projects_meeting ON meeting_projects(meeting_id);
CREATE INDEX idx_meeting_projects_project ON meeting_projects(project_id);
CREATE INDEX idx_meeting_projects_status ON meeting_projects(status);
CREATE INDEX idx_meeting_projects_include ON meeting_projects(include_in_agenda);

COMMENT ON TABLE meeting_projects IS 'Junction table tracking which projects are in which meeting agendas';
COMMENT ON COLUMN meeting_projects.discussion_points IS 'Pre-meeting thoughts and ideas to discuss';
COMMENT ON COLUMN meeting_projects.questions_to_address IS 'Specific questions team wants to address';
COMMENT ON COLUMN meeting_projects.discussion_summary IS 'What was discussed during the meeting';
COMMENT ON COLUMN meeting_projects.decisions_reached IS 'Decisions made about this project';
COMMENT ON COLUMN meeting_projects.status IS 'planned: not yet discussed, discussed: completed, tabled: postponed this meeting, deferred: moved to future';
COMMENT ON COLUMN meeting_projects.include_in_agenda IS 'Whether to include in the final agenda (for filtering out tabled items)';
COMMENT ON COLUMN meeting_projects.agenda_order IS 'Sort order within the meeting agenda';
