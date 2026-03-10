-- Migration: Expand event_check_in_reminders to support multiple rule types per event
-- Adds rule_type and threshold_days columns, updates unique index

-- Add new columns
ALTER TABLE event_check_in_reminders ADD COLUMN IF NOT EXISTS rule_type VARCHAR DEFAULT 'general_checkin' NOT NULL;
ALTER TABLE event_check_in_reminders ADD COLUMN IF NOT EXISTS threshold_days INTEGER DEFAULT 7;

-- Drop old unique index (event_request_id, user_id) to allow multiple rules per event per user
DROP INDEX IF EXISTS idx_checkin_reminders_event_user;

-- Create new unique index (event_request_id, user_id, rule_type) - one rule of each type per event per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkin_reminders_event_user_rule
  ON event_check_in_reminders(event_request_id, user_id, rule_type);

-- Add index on rule_type for filtering
CREATE INDEX IF NOT EXISTS idx_checkin_reminders_rule_type
  ON event_check_in_reminders(rule_type);
