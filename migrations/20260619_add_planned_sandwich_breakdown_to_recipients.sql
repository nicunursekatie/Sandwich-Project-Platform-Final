-- Add a planned per-type sandwich breakdown to recipients.
--
-- Captures the PLANNED distribution per org by sandwich type, with a min/max
-- so ranged plans ("150-200 deli, 50 PB&J") can be stored directly. This is
-- separate from the existing single-number `estimated_sandwiches` column,
-- which is kept for backwards compatibility and simple cases.
--
-- IMPORTANT: This represents PLANNED amounts only. Actual delivered counts
-- continue to live in the sandwich_collections table (the source of truth
-- for grant metrics + dashboard totals).
--
-- Run against BOTH Neon branches: dev AND production.

ALTER TABLE recipients
  ADD COLUMN IF NOT EXISTS planned_sandwich_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE recipients
SET planned_sandwich_breakdown = '[]'::jsonb
WHERE planned_sandwich_breakdown IS NULL;
