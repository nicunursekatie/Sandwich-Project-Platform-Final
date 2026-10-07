-- Backfill: events created by the Planning Sheet import came FROM the official
-- planning sheet, so they are by definition already on it. Earlier versions of
-- the import left added_to_official_sheet = false, which made these events show
-- the misleading amber "Not on Calendar" badge. Idempotent: only touches
-- planning-sheet-imported rows (external_id fingerprint convention) that are
-- not already flagged. Events created any other way are untouched.
UPDATE event_requests
SET added_to_official_sheet = TRUE,
    added_to_official_sheet_at = COALESCE(added_to_official_sheet_at, created_at, NOW())
WHERE external_id LIKE 'planning-sheet:%'
  AND (added_to_official_sheet IS DISTINCT FROM TRUE);
