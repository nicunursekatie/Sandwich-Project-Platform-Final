-- Add collaboration tables for event requests
-- These support team comments, field locking, and edit history

-- Event collaboration comments table
CREATE TABLE IF NOT EXISTS event_collaboration_comments (
    id SERIAL PRIMARY KEY,
    event_request_id INTEGER NOT NULL REFERENCES event_requests(id) ON DELETE CASCADE,
    user_id VARCHAR NOT NULL REFERENCES users(id),
    user_name VARCHAR NOT NULL,
    content TEXT NOT NULL,
    parent_comment_id INTEGER,
    edited_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_collab_comments_event_id ON event_collaboration_comments(event_request_id);
CREATE INDEX IF NOT EXISTS idx_event_collab_comments_user_id ON event_collaboration_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_event_collab_comments_created_at ON event_collaboration_comments(created_at);

-- Event collaboration comment likes table
CREATE TABLE IF NOT EXISTS event_collaboration_comment_likes (
    id SERIAL PRIMARY KEY,
    comment_id INTEGER NOT NULL REFERENCES event_collaboration_comments(id) ON DELETE CASCADE,
    user_id VARCHAR NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_collab_likes_comment_id ON event_collaboration_comment_likes(comment_id);

-- Event field locks table for preventing edit conflicts
CREATE TABLE IF NOT EXISTS event_field_locks (
    id SERIAL PRIMARY KEY,
    event_request_id INTEGER NOT NULL REFERENCES event_requests(id) ON DELETE CASCADE,
    field_name VARCHAR NOT NULL,
    locked_by VARCHAR NOT NULL REFERENCES users(id),
    locked_by_name VARCHAR NOT NULL,
    locked_at TIMESTAMP DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(event_request_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_event_field_locks_event_id ON event_field_locks(event_request_id);
CREATE INDEX IF NOT EXISTS idx_event_field_locks_expires_at ON event_field_locks(expires_at);

-- Event edit revisions table for tracking change history
CREATE TABLE IF NOT EXISTS event_edit_revisions (
    id SERIAL PRIMARY KEY,
    event_request_id INTEGER NOT NULL REFERENCES event_requests(id) ON DELETE CASCADE,
    field_name VARCHAR NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by VARCHAR NOT NULL REFERENCES users(id),
    changed_by_name VARCHAR NOT NULL,
    change_type VARCHAR NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_edit_revisions_event_id ON event_edit_revisions(event_request_id);
CREATE INDEX IF NOT EXISTS idx_event_edit_revisions_field_name ON event_edit_revisions(field_name);
CREATE INDEX IF NOT EXISTS idx_event_edit_revisions_created_at ON event_edit_revisions(created_at);

-- Holding zone collaboration tables (similar structure)
CREATE TABLE IF NOT EXISTS holding_zone_collaboration_comments (
    id SERIAL PRIMARY KEY,
    holding_zone_id VARCHAR NOT NULL,
    user_id VARCHAR NOT NULL REFERENCES users(id),
    user_name VARCHAR NOT NULL,
    content TEXT NOT NULL,
    parent_comment_id INTEGER,
    edited_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hz_collab_comments_zone_id ON holding_zone_collaboration_comments(holding_zone_id);

CREATE TABLE IF NOT EXISTS holding_zone_field_locks (
    id SERIAL PRIMARY KEY,
    holding_zone_id VARCHAR NOT NULL,
    field_name VARCHAR NOT NULL,
    locked_by VARCHAR NOT NULL REFERENCES users(id),
    locked_by_name VARCHAR NOT NULL,
    locked_at TIMESTAMP DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(holding_zone_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_hz_field_locks_zone_id ON holding_zone_field_locks(holding_zone_id);
