-- Add cooler_status column if it doesn't exist
ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "cooler_status" text;
