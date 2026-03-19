-- Add opt-in visibility flag for the Volunteer Event Hub
-- Events only appear on the hub when coordinators explicitly toggle this on
ALTER TABLE event_requests ADD COLUMN IF NOT EXISTS show_on_volunteer_hub BOOLEAN NOT NULL DEFAULT false;
