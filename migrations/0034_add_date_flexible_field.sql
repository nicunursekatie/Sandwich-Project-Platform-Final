-- Add date_flexible field to event_requests
-- This indicates whether the organizer is flexible on their event date
-- false = inflexible (they have a pre-planned event, cannot move the date)
-- true/null = flexible (they picked a random date and can adjust)

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS date_flexible BOOLEAN DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN event_requests.date_flexible IS 'Whether the organizer is flexible on the event date. False means they have a pre-planned event and cannot change the date.';
