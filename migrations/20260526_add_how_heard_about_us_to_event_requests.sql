-- Add how-heard-about-us fields to event_requests.
-- Captured during the intake call: how the organizer found TSP (dropdown)
-- plus a free-text notes field (especially used when "other" is selected).
ALTER TABLE event_requests
  ADD COLUMN IF NOT EXISTS how_heard_about_us VARCHAR;
ALTER TABLE event_requests
  ADD COLUMN IF NOT EXISTS how_heard_about_us_notes TEXT;
