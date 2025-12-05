-- Ensure drivers table has speaking/weekly flags
ALTER TABLE "drivers"
  ADD COLUMN IF NOT EXISTS "willing_to_speak" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_weekly_driver" boolean NOT NULL DEFAULT false;
