-- Add an `addresses` jsonb column to the recipients table to support
-- multiple labeled addresses per organization (e.g., "main", "warehouse",
-- "north site", "summer location"). The existing single `address` column
-- remains authoritative for geocoding + map pins; this list captures
-- additional addresses for reference and operational visibility.
--
-- Run against both Neon branches: dev AND production.

ALTER TABLE recipients
  ADD COLUMN IF NOT EXISTS addresses JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Sanity check: ensure all rows now have a JSON array default.
-- (No-op for fresh rows; backfills any prior NULLs from older runs.)
UPDATE recipients
SET addresses = '[]'::jsonb
WHERE addresses IS NULL;
