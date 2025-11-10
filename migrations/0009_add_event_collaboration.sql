-- Migration: Add event collaboration tables for real-time collaborative editing
-- Created: 2025-11-10

-- Add version column to event_requests table for optimistic concurrency control
ALTER TABLE event_requests ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Create event_collaboration_comments table for internal team collaboration
CREATE TABLE IF NOT EXISTS event_collaboration_comments (
  id SERIAL PRIMARY KEY,
  event_request_id INTEGER NOT NULL REFERENCES event_requests(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id),
  user_name VARCHAR NOT NULL,
  content TEXT NOT NULL,
  parent_comment_id INTEGER, -- For threaded replies
  edited_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
  updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

-- Create indexes for event_collaboration_comments
CREATE INDEX IF NOT EXISTS idx_event_collab_comments_event_id ON event_collaboration_comments(event_request_id);
CREATE INDEX IF NOT EXISTS idx_event_collab_comments_user_id ON event_collaboration_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_event_collab_comments_created_at ON event_collaboration_comments(created_at);

-- Create event_field_locks table for preventing edit conflicts
CREATE TABLE IF NOT EXISTS event_field_locks (
  id SERIAL PRIMARY KEY,
  event_request_id INTEGER NOT NULL REFERENCES event_requests(id) ON DELETE CASCADE,
  field_name VARCHAR NOT NULL,
  locked_by VARCHAR NOT NULL REFERENCES users(id),
  locked_by_name VARCHAR NOT NULL,
  locked_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
  expires_at TIMESTAMP NOT NULL
);

-- Create unique constraint for event_field_locks (one lock per field per event)
CREATE UNIQUE INDEX IF NOT EXISTS event_field_locks_event_request_id_field_name_key ON event_field_locks(event_request_id, field_name);

-- Create indexes for event_field_locks
CREATE INDEX IF NOT EXISTS idx_event_field_locks_event_id ON event_field_locks(event_request_id);
CREATE INDEX IF NOT EXISTS idx_event_field_locks_expires_at ON event_field_locks(expires_at);

-- Create event_edit_revisions table for tracking change history
CREATE TABLE IF NOT EXISTS event_edit_revisions (
  id SERIAL PRIMARY KEY,
  event_request_id INTEGER NOT NULL REFERENCES event_requests(id) ON DELETE CASCADE,
  field_name VARCHAR NOT NULL,
  old_value TEXT, -- JSON-stringified for complex types
  new_value TEXT, -- JSON-stringified for complex types
  changed_by VARCHAR NOT NULL REFERENCES users(id),
  changed_by_name VARCHAR NOT NULL,
  change_type VARCHAR NOT NULL, -- 'create', 'update', 'delete'
  created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);

-- Create indexes for event_edit_revisions
CREATE INDEX IF NOT EXISTS idx_event_edit_revisions_event_id ON event_edit_revisions(event_request_id);
CREATE INDEX IF NOT EXISTS idx_event_edit_revisions_field_name ON event_edit_revisions(field_name);
CREATE INDEX IF NOT EXISTS idx_event_edit_revisions_created_at ON event_edit_revisions(created_at);
