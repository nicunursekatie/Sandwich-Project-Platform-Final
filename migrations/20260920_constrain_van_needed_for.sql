-- Restrict van_needed_for to the two declared purposes (or NULL).
-- Run this on BOTH Neon branches (dev and production).
--
-- Wipe any leftover values that are not the lowercase enum first so the
-- CHECK can be added without failing on existing rows.

UPDATE event_requests
SET van_needed_for = NULL
WHERE van_needed_for IS NOT NULL
  AND van_needed_for NOT IN ('transport', 'refrigeration');

ALTER TABLE event_requests
  DROP CONSTRAINT IF EXISTS event_requests_van_needed_for_check;

ALTER TABLE event_requests
  ADD CONSTRAINT event_requests_van_needed_for_check
  CHECK (van_needed_for IS NULL OR van_needed_for IN ('transport', 'refrigeration'));
