-- Add an upper bound for the single-number estimated sandwiches so the
-- value can be a range (e.g., 200-250) without requiring a per-type
-- breakdown. The existing `estimated_sandwiches` column becomes the MIN;
-- the new `estimated_sandwiches_max` is the upper bound.
--
-- A NULL max means the value is a single number (treat as min === max).
--
-- Run against BOTH Neon branches: dev AND production.

ALTER TABLE recipients
  ADD COLUMN IF NOT EXISTS estimated_sandwiches_max INTEGER;
