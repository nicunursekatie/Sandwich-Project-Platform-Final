-- Add the social media post LINK column to event_requests.
--
-- This column was referenced in application code (CompletedCard, the PATCH
-- handler, and the event-list projection) but was never actually present in the
-- database, so social-media post links silently never persisted. Adding it makes
-- the column real so the value saves and renders.
--
-- Run this on BOTH Neon branches (dev and production) BEFORE deploying the code
-- that declares socialMediaPostLink in shared/schema.ts — otherwise event
-- queries would SELECT a column that does not exist yet.
ALTER TABLE event_requests
  ADD COLUMN IF NOT EXISTS social_media_post_link TEXT;
