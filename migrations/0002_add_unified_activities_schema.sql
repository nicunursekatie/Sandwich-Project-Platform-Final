-- Migration: Add Unified Activities System Schema (Phase 1)
-- Phase 1 of Unified Task + Communication System
-- Generated: 2025-10-26
-- Safe to run: Yes (additive only, no destructive changes)
-- Depends on: 0001_add_feature_flags.sql

-- ============================================================================
-- ACTIVITIES TABLE - Unified storage for tasks, events, messages, and more
-- ============================================================================

CREATE TABLE IF NOT EXISTS activities (
  id VARCHAR PRIMARY KEY NOT NULL,
  type VARCHAR(50) NOT NULL,  -- 'task', 'event', 'project', 'collection', 'message', 'kudos', 'system_log'
  title TEXT NOT NULL,  -- Main description or message preview
  content TEXT,  -- Detailed body - for messages or rich descriptions
  created_by VARCHAR NOT NULL,  -- FK to users.id
  assigned_to JSONB DEFAULT '[]'::jsonb,  -- Array of user IDs
  status VARCHAR(50),  -- 'open', 'in_progress', 'done', 'declined', 'postponed', NULL for messages
  priority VARCHAR(20),  -- 'low', 'medium', 'high', 'urgent', NULL for non-tasks
  parent_id VARCHAR,  -- Self-referential FK for threading (replies)
  root_id VARCHAR,  -- Denormalized root of thread for efficient queries
  context_type VARCHAR(50),  -- 'event_request', 'project', 'collection', 'kudos', 'direct', 'channel'
  context_id VARCHAR,  -- FK to eventRequests/projects/collections/etc
  metadata JSONB DEFAULT '{}'::jsonb,  -- Flexible field for type-specific data
  is_deleted BOOLEAN DEFAULT false,  -- Soft delete flag
  thread_count INTEGER DEFAULT 0,  -- Denormalized count of replies
  last_activity_at TIMESTAMP DEFAULT NOW(),  -- For sorting threads by recent activity
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE activities IS 'Unified table for tasks, events, projects, messages, and more with built-in threading';
COMMENT ON COLUMN activities.parent_id IS 'Points to parent activity for threaded replies. NULL = root activity';
COMMENT ON COLUMN activities.root_id IS 'Denormalized ID of root activity for efficient thread queries';
COMMENT ON COLUMN activities.thread_count IS 'Cached count of direct replies (updated by triggers or app logic)';
COMMENT ON COLUMN activities.last_activity_at IS 'Updated when activity or any reply is created/updated';

-- Performance indexes for activities
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_created_by ON activities(created_by);
CREATE INDEX IF NOT EXISTS idx_activities_parent_id ON activities(parent_id);
CREATE INDEX IF NOT EXISTS idx_activities_root_id ON activities(root_id);
CREATE INDEX IF NOT EXISTS idx_activities_context ON activities(context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_activities_last_activity ON activities(last_activity_at);
CREATE INDEX IF NOT EXISTS idx_activities_is_deleted ON activities(is_deleted);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at);

-- ============================================================================
-- ACTIVITY PARTICIPANTS - Track who's involved in each activity
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_participants (
  id SERIAL PRIMARY KEY,
  activity_id VARCHAR NOT NULL,  -- FK to activities.id
  user_id VARCHAR NOT NULL,  -- FK to users.id
  role VARCHAR(50) NOT NULL,  -- 'assignee', 'follower', 'mentioned', 'creator'
  last_read_at TIMESTAMP,  -- For unread tracking
  notifications_enabled BOOLEAN DEFAULT true,  -- Per-thread notification preference
  created_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_activity_user_role UNIQUE (activity_id, user_id, role)
);

COMMENT ON TABLE activity_participants IS 'Tracks who is involved in each activity for permissions, notifications, and unread status';
COMMENT ON COLUMN activity_participants.role IS 'User role: assignee (assigned to work), follower (watching), mentioned (tagged), creator (author)';
COMMENT ON COLUMN activity_participants.last_read_at IS 'Last time user viewed this activity thread (for unread badges)';

-- Performance indexes for participants
CREATE INDEX IF NOT EXISTS idx_activity_participants_activity ON activity_participants(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_participants_user ON activity_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_participants_activity_user ON activity_participants(activity_id, user_id);

-- ============================================================================
-- ACTIVITY REACTIONS - Likes, celebrates, helpful markers
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_reactions (
  id SERIAL PRIMARY KEY,
  activity_id VARCHAR NOT NULL,  -- FK to activities.id
  user_id VARCHAR NOT NULL,  -- FK to users.id
  reaction_type VARCHAR(50) NOT NULL,  -- 'like', 'celebrate', 'helpful', 'complete', 'question'
  created_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_activity_user_reaction UNIQUE (activity_id, user_id, reaction_type)
);

COMMENT ON TABLE activity_reactions IS 'Lightweight reactions (likes, celebrates, etc.) on activities and messages';
COMMENT ON COLUMN activity_reactions.reaction_type IS 'Reaction types: like, celebrate, helpful, complete, question';

-- Performance indexes for reactions
CREATE INDEX IF NOT EXISTS idx_activity_reactions_activity ON activity_reactions(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_reactions_user ON activity_reactions(user_id);

-- ============================================================================
-- ACTIVITY ATTACHMENTS - File uploads on threads
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_attachments (
  id SERIAL PRIMARY KEY,
  activity_id VARCHAR NOT NULL,  -- FK to activities.id
  file_url TEXT NOT NULL,  -- URL to file in storage (Google Cloud Storage)
  file_type VARCHAR(100),  -- MIME type (image/png, application/pdf, etc.)
  file_name TEXT NOT NULL,  -- Original filename
  file_size INTEGER,  -- Size in bytes
  uploaded_by VARCHAR NOT NULL,  -- FK to users.id
  uploaded_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE activity_attachments IS 'File attachments on activity threads (images, PDFs, documents)';
COMMENT ON COLUMN activity_attachments.file_url IS 'Full URL to file in Google Cloud Storage';

-- Performance indexes for attachments
CREATE INDEX IF NOT EXISTS idx_activity_attachments_activity ON activity_attachments(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_attachments_uploaded_by ON activity_attachments(uploaded_by);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS (Optional - Add after testing)
-- ============================================================================
-- Uncomment these after verifying the schema works in development:
--
-- ALTER TABLE activities
--   ADD CONSTRAINT fk_activities_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
--   ADD CONSTRAINT fk_activities_parent_id FOREIGN KEY (parent_id) REFERENCES activities(id) ON DELETE CASCADE,
--   ADD CONSTRAINT fk_activities_root_id FOREIGN KEY (root_id) REFERENCES activities(id) ON DELETE CASCADE;
--
-- ALTER TABLE activity_participants
--   ADD CONSTRAINT fk_activity_participants_activity FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
--   ADD CONSTRAINT fk_activity_participants_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
--
-- ALTER TABLE activity_reactions
--   ADD CONSTRAINT fk_activity_reactions_activity FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
--   ADD CONSTRAINT fk_activity_reactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
--
-- ALTER TABLE activity_attachments
--   ADD CONSTRAINT fk_activity_attachments_activity FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
--   ADD CONSTRAINT fk_activity_attachments_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- FEATURE FLAG: Enable Phase 1
-- ============================================================================

-- Update the feature flag to indicate schema is created
UPDATE feature_flags
SET enabled = false,  -- Keep disabled until Phase 2 (read operations)
    metadata = jsonb_set(
      metadata,
      '{schema_created_at}',
      to_jsonb(NOW())
    )
WHERE flag_name = 'unified-activities-schema';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Phase 1 complete: Unified Activities schema created';
  RAISE NOTICE '📋 Tables created:';
  RAISE NOTICE '   - activities (unified storage for tasks/events/messages)';
  RAISE NOTICE '   - activity_participants (who is involved)';
  RAISE NOTICE '   - activity_reactions (likes, celebrates, etc.)';
  RAISE NOTICE '   - activity_attachments (file uploads)';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 All tables are inactive until Phase 2 (no application code uses them yet)';
  RAISE NOTICE '📖 Next step: Phase 2 - Build backend services to read from these tables';
END $$;
