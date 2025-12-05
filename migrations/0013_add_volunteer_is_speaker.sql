-- Add is_speaker column to volunteers table
-- This column indicates whether a volunteer can speak at events

ALTER TABLE "volunteers"
  ADD COLUMN IF NOT EXISTS "is_speaker" boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN "volunteers"."is_speaker" IS 'Whether this volunteer can speak at events';

