-- Migration: Add notification_action_history table
-- Created: 2025-11-02
-- Purpose: Track when users execute actions from notifications (approve, decline, complete, etc.)

CREATE TABLE IF NOT EXISTS notification_action_history (
  id SERIAL PRIMARY KEY,

  -- Links to notification and user
  notification_id INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Action details
  action_type VARCHAR NOT NULL, -- 'approve', 'decline', 'mark_complete', 'assign', etc.
  action_status VARCHAR NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed'

  -- Execution tracking
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT,

  -- Related entity changes
  related_type VARCHAR, -- 'event_request', 'task', 'project', etc.
  related_id INTEGER,

  -- Undo support (for future enhancement)
  undone_at TIMESTAMP,
  undone_by VARCHAR REFERENCES users(id),

  -- Additional context
  metadata JSONB DEFAULT '{}'
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_notif_action_history_notif
  ON notification_action_history(notification_id);

CREATE INDEX IF NOT EXISTS idx_notif_action_history_user
  ON notification_action_history(user_id, action_type);

CREATE INDEX IF NOT EXISTS idx_notif_action_history_status
  ON notification_action_history(action_status);

-- Add comment
COMMENT ON TABLE notification_action_history IS 'Tracks execution of notification actions for audit trail and undo functionality';
