-- Migration 0045: Add shared_with_user_id to team_board_items for two-level privacy
-- Level 1: Private = only creator (and admins) see
-- Level 2: Private + shared with = only creator, shared user, and admins see

ALTER TABLE team_board_items ADD COLUMN IF NOT EXISTS shared_with_user_id VARCHAR;
