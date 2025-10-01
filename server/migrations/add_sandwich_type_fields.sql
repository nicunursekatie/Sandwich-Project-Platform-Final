-- Migration: Add sandwich type breakdown fields to sandwich_collections table
-- This migration adds support for tracking deli vs PBJ sandwiches for both
-- individual and group collections

ALTER TABLE sandwich_collections
ADD COLUMN IF NOT EXISTS individual_deli INTEGER,
ADD COLUMN IF NOT EXISTS individual_pbj INTEGER;

-- Add comments to explain the fields
COMMENT ON COLUMN sandwich_collections.individual_deli IS 'Optional: Number of deli sandwiches in individual collection';
COMMENT ON COLUMN sandwich_collections.individual_pbj IS 'Optional: Number of PBJ sandwiches in individual collection';
COMMENT ON COLUMN sandwich_collections.group_collections IS 'JSONB array of group collections. Each object can include: name (required), count (required), deli (optional), pbj (optional)';
