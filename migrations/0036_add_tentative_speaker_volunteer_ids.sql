-- Add tentative speaker and volunteer assignment fields
-- These allow marking speakers/volunteers as tentative (shown with ? badge) like tentative_driver_ids

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS tentative_speaker_ids TEXT[];

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS tentative_volunteer_ids TEXT[];

-- Add comments for documentation
COMMENT ON COLUMN event_requests.tentative_speaker_ids IS 'Array of speaker IDs that are tentatively assigned (shown with ? badge)';
COMMENT ON COLUMN event_requests.tentative_volunteer_ids IS 'Array of volunteer IDs that are tentatively assigned (shown with ? badge)';
