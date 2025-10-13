-- Add adult/children breakdown fields for event attendees
-- This allows optionally tracking adults vs children, or just using the general total

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS adult_count INTEGER,
ADD COLUMN IF NOT EXISTS children_count INTEGER;

-- The existing volunteer_count field will serve as the "general total" option
-- If adult_count and children_count are both null, volunteer_count represents the total
-- If adult_count and/or children_count are specified, they provide the breakdown
