-- Add kids_age_range field to event_requests
-- This stores the age range of kids when children are participating in the event
-- Example values: "5-12", "8-15", "Elementary (5-10)", "Middle School (11-14)"

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS kids_age_range VARCHAR(100);

-- Add comment for documentation
COMMENT ON COLUMN event_requests.kids_age_range IS 'Age range of kids participating in the event (e.g., "5-12", "Elementary school")';
