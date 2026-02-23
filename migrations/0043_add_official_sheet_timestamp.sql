-- Migration: Add addedToOfficialSheetAt timestamp to event_requests
-- Date: 2026-02-22
-- Description: Track when an event was added to the official Google Sheet

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS added_to_official_sheet_at TIMESTAMP;
