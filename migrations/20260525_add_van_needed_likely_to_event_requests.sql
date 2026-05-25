-- Add van_needed_likely flag to event_requests.
-- Soft companion to van_driver_needed; set during in-process to mark events
-- that probably need a van so the team is prompted to confirm/clear it when
-- moving the event to scheduled.
ALTER TABLE event_requests
  ADD COLUMN IF NOT EXISTS van_needed_likely BOOLEAN NOT NULL DEFAULT false;
