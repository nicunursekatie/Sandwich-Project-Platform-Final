-- Migration 0041: Add all missing tables and columns
-- Comprehensive fix for schema drift detected between shared/schema.ts and the database
-- Missing: 7 tables and 11 columns
--
-- MISSING TABLES:
--   1. api_keys
--   2. instant_messages
--   3. instant_message_likes
--   4. team_board_item_categories
--   5. ambassador_candidates
--   6. password_reset_tokens
--   7. tsp_contact_followups
--
-- MISSING COLUMNS:
--   1. users.needs_password_setup
--   2. project_tasks.parent_task_id
--   3. project_tasks.promoted_to_todo
--   4. host_contacts.driver_agreement_signed
--   5. team_board_items.parent_item_id
--   6. team_board_items.is_canvas
--   7. team_board_items.canvas_sections
--   8. team_board_items.canvas_status
--   9. team_board_items.canvas_published_snapshot
--  10. team_board_items.canvas_published_at
--  11. team_board_items.canvas_published_by

-- ============================================================================
-- PART 1: Missing columns on existing tables
-- ============================================================================

-- 1. users.needs_password_setup
ALTER TABLE users
ADD COLUMN IF NOT EXISTS needs_password_setup BOOLEAN DEFAULT false;
--> statement-breakpoint
-- 2. project_tasks.parent_task_id
ALTER TABLE project_tasks
ADD COLUMN IF NOT EXISTS parent_task_id INTEGER;
--> statement-breakpoint
-- 3. project_tasks.promoted_to_todo
ALTER TABLE project_tasks
ADD COLUMN IF NOT EXISTS promoted_to_todo BOOLEAN NOT NULL DEFAULT false;
--> statement-breakpoint
-- 4. host_contacts.driver_agreement_signed
ALTER TABLE host_contacts
ADD COLUMN IF NOT EXISTS driver_agreement_signed BOOLEAN DEFAULT false;
--> statement-breakpoint
-- 5. team_board_items.parent_item_id (self-referencing FK added separately)
ALTER TABLE team_board_items
ADD COLUMN IF NOT EXISTS parent_item_id INTEGER;
--> statement-breakpoint
-- 6. team_board_items.is_canvas
ALTER TABLE team_board_items
ADD COLUMN IF NOT EXISTS is_canvas BOOLEAN NOT NULL DEFAULT false;
--> statement-breakpoint
-- 7. team_board_items.canvas_sections
ALTER TABLE team_board_items
ADD COLUMN IF NOT EXISTS canvas_sections JSONB;
--> statement-breakpoint
-- 8. team_board_items.canvas_status
ALTER TABLE team_board_items
ADD COLUMN IF NOT EXISTS canvas_status VARCHAR DEFAULT 'draft';
--> statement-breakpoint
-- 9. team_board_items.canvas_published_snapshot
ALTER TABLE team_board_items
ADD COLUMN IF NOT EXISTS canvas_published_snapshot JSONB;
--> statement-breakpoint
-- 10. team_board_items.canvas_published_at
ALTER TABLE team_board_items
ADD COLUMN IF NOT EXISTS canvas_published_at TIMESTAMP;
--> statement-breakpoint
-- 11. team_board_items.canvas_published_by
ALTER TABLE team_board_items
ADD COLUMN IF NOT EXISTS canvas_published_by VARCHAR;
--> statement-breakpoint
-- Add self-referencing FK for parent_item_id (ignore if already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'team_board_items_parent_item_id_fkey'
      AND table_name = 'team_board_items'
  ) THEN
    ALTER TABLE team_board_items
    ADD CONSTRAINT team_board_items_parent_item_id_fkey
    FOREIGN KEY (parent_item_id) REFERENCES team_board_items(id) ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
-- ============================================================================
-- PART 2: Missing tables
-- ============================================================================

-- 1. api_keys
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  key_hash VARCHAR NOT NULL UNIQUE,
  key_prefix VARCHAR NOT NULL,
  permissions JSONB DEFAULT '["EVENT_REQUESTS_VIEW"]',
  created_by VARCHAR NOT NULL,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
-- 2. instant_messages
CREATE TABLE IF NOT EXISTS instant_messages (
  id SERIAL PRIMARY KEY,
  sender_id VARCHAR NOT NULL,
  sender_name VARCHAR NOT NULL,
  recipient_id VARCHAR NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_instant_messages_sender ON instant_messages(sender_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_instant_messages_recipient ON instant_messages(recipient_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_instant_messages_conversation ON instant_messages(sender_id, recipient_id);
--> statement-breakpoint
-- 3. instant_message_likes
CREATE TABLE IF NOT EXISTS instant_message_likes (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL,
  user_id VARCHAR NOT NULL,
  user_name VARCHAR NOT NULL,
  emoji VARCHAR NOT NULL DEFAULT '❤️',
  created_at TIMESTAMP DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_instant_message_likes_message ON instant_message_likes(message_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_instant_message_likes_user ON instant_message_likes(user_id);
--> statement-breakpoint
-- Add unique constraint (message_id, user_id, emoji) if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'instant_message_likes_message_id_user_id_emoji_unique'
      AND table_name = 'instant_message_likes'
  ) THEN
    ALTER TABLE instant_message_likes
    ADD CONSTRAINT instant_message_likes_message_id_user_id_emoji_unique
    UNIQUE (message_id, user_id, emoji);
  END IF;
END $$;
--> statement-breakpoint
-- 4. team_board_item_categories
CREATE TABLE IF NOT EXISTS team_board_item_categories (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES team_board_items(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES holding_zone_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
-- Add unique constraint (item_id, category_id) if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'team_board_item_categories_item_id_category_id_unique'
      AND table_name = 'team_board_item_categories'
  ) THEN
    ALTER TABLE team_board_item_categories
    ADD CONSTRAINT team_board_item_categories_item_id_category_id_unique
    UNIQUE (item_id, category_id);
  END IF;
END $$;
--> statement-breakpoint
-- 5. ambassador_candidates
CREATE TABLE IF NOT EXISTS ambassador_candidates (
  id SERIAL PRIMARY KEY,
  organization_name VARCHAR NOT NULL,
  canonical_name VARCHAR NOT NULL UNIQUE,
  category VARCHAR,
  status VARCHAR NOT NULL DEFAULT 'identified',
  priority VARCHAR DEFAULT 'normal',
  added_by VARCHAR REFERENCES users(id),
  added_at TIMESTAMP NOT NULL DEFAULT NOW(),
  added_reason TEXT,
  last_contacted_at TIMESTAMP,
  last_contacted_by VARCHAR REFERENCES users(id),
  contact_method VARCHAR,
  next_follow_up_date TIMESTAMP,
  notes TEXT,
  contact_info JSONB,
  engagement_score_at_add NUMERIC(5,2),
  total_events_at_add INTEGER,
  total_sandwiches_at_add INTEGER,
  outcome_notes TEXT,
  confirmed_at TIMESTAMP,
  declined_at TIMESTAMP,
  decline_reason TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_ambassador_canonical ON ambassador_candidates(canonical_name);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_ambassador_status ON ambassador_candidates(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_ambassador_priority ON ambassador_candidates(priority);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_ambassador_next_followup ON ambassador_candidates(next_follow_up_date);
--> statement-breakpoint
-- 6. password_reset_tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  token VARCHAR(64) NOT NULL UNIQUE,
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR NOT NULL,
  token_type VARCHAR(32) NOT NULL DEFAULT 'password_reset',
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);
--> statement-breakpoint
-- 7. tsp_contact_followups
CREATE TABLE IF NOT EXISTS tsp_contact_followups (
  id SERIAL PRIMARY KEY,
  event_request_id INTEGER NOT NULL REFERENCES event_requests(id) ON DELETE CASCADE,
  tsp_contact_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminder_type VARCHAR NOT NULL,
  delivery_channel VARCHAR NOT NULL,
  sent_at TIMESTAMP NOT NULL DEFAULT NOW(),
  delivery_status VARCHAR DEFAULT 'sent',
  event_organization VARCHAR,
  event_date TIMESTAMP,
  message_preview TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tsp_followup_event ON tsp_contact_followups(event_request_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tsp_followup_contact ON tsp_contact_followups(tsp_contact_user_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tsp_followup_type ON tsp_contact_followups(reminder_type);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tsp_followup_sent ON tsp_contact_followups(sent_at);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_tsp_followup_unique
ON tsp_contact_followups(event_request_id, tsp_contact_user_id, reminder_type);
