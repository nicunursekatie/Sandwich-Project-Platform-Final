-- Migration: Add event_reminder_snoozes table
-- Date: 2026-03-16
-- Description: Per-event-per-user snooze/pause state for check-in reminders.
--   Supports timed, until_date, and until_contact pause types.
--   Uses a partial unique index so only one *active* snooze exists per event+user,
--   while historical (cancelled) rows are preserved without uniqueness conflict.
-- Safe to run on existing database - uses IF NOT EXISTS

CREATE TABLE IF NOT EXISTS event_reminder_snoozes (
  id SERIAL PRIMARY KEY,
  event_request_id INTEGER NOT NULL,
  user_id VARCHAR NOT NULL,
  snooze_type VARCHAR NOT NULL,       -- 'timed' | 'until_date' | 'until_contact'
  snoozed_until TIMESTAMP,            -- null for 'until_contact' (open-ended)
  reason TEXT,                        -- optional user note
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMP              -- set when snooze is manually or auto-cancelled
);

-- Only one *active* snooze per event+user (partial unique index on active=true rows)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reminder_snoozes_active_event_user
  ON event_reminder_snoozes (event_request_id, user_id)
  WHERE active = true;

-- General index for querying active snoozes quickly
CREATE INDEX IF NOT EXISTS idx_reminder_snoozes_active
  ON event_reminder_snoozes (active);

-- Drop the old non-partial unique index if it was created by a previous schema push
DROP INDEX IF EXISTS idx_reminder_snoozes_event_user;
