-- Migration: Add event collaboration tables
-- Description: Creates tables for team comments, field locking, and edit revision tracking

-- Event Collaboration Comments Table
CREATE TABLE IF NOT EXISTS event_collaboration_comments (
  id SERIAL PRIMARY KEY,
  event_request_id INTEGER NOT NULL REFERENCES event_requests(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  user_name VARCHAR NOT NULL,
  content TEXT NOT NULL,
  parent_comment_id INTEGER REFERENCES event_collaboration_comments(id) ON DELETE CASCADE,
  edited_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for event collaboration comments
CREATE INDEX IF NOT EXISTS idx_event_collab_comments_event_id ON event_collaboration_comments(event_request_id);
CREATE INDEX IF NOT EXISTS idx_event_collab_comments_user_id ON event_collaboration_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_event_collab_comments_created_at ON event_collaboration_comments(created_at);

-- Event Field Locks Table (for preventing edit conflicts)
CREATE TABLE IF NOT EXISTS event_field_locks (
  id SERIAL PRIMARY KEY,
  event_request_id INTEGER NOT NULL REFERENCES event_requests(id) ON DELETE CASCADE,
  field_name VARCHAR NOT NULL,
  locked_by VARCHAR NOT NULL REFERENCES users(id),
  locked_by_name VARCHAR NOT NULL,
  locked_at TIMESTAMP DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP NOT NULL
);

-- Indexes for field locks
CREATE INDEX IF NOT EXISTS idx_event_field_locks_event_id ON event_field_locks(event_request_id);
CREATE INDEX IF NOT EXISTS idx_event_field_locks_field_name ON event_field_locks(field_name);
CREATE INDEX IF NOT EXISTS idx_event_field_locks_expires_at ON event_field_locks(expires_at);

-- Unique constraint: one lock per event/field combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_field_locks_unique ON event_field_locks(event_request_id, field_name);

-- Event Edit Revisions Table (for tracking field changes)
CREATE TABLE IF NOT EXISTS event_edit_revisions (
  id SERIAL PRIMARY KEY,
  event_request_id INTEGER NOT NULL REFERENCES event_requests(id) ON DELETE CASCADE,
  field_name VARCHAR NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by VARCHAR NOT NULL REFERENCES users(id),
  changed_by_name VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for edit revisions
CREATE INDEX IF NOT EXISTS idx_event_edit_revisions_event_id ON event_edit_revisions(event_request_id);
CREATE INDEX IF NOT EXISTS idx_event_edit_revisions_field_name ON event_edit_revisions(field_name);
CREATE INDEX IF NOT EXISTS idx_event_edit_revisions_created_at ON event_edit_revisions(created_at);

-- Comments
COMMENT ON TABLE event_collaboration_comments IS 'Team comments on event requests for internal collaboration';
COMMENT ON TABLE event_field_locks IS 'Field-level locks to prevent concurrent editing conflicts';
COMMENT ON TABLE event_edit_revisions IS 'Audit trail of all field changes on event requests';
