-- Migration: Add version column to event_requests for optimistic locking
-- Date: 2026-03-01
-- Description: Adds integer version column used for concurrent edit conflict detection.
-- IF NOT EXISTS makes this safe to run on databases that already have the column.

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
