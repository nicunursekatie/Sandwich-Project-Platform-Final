-- Consolidate legacy attendance fields into new standardized fields
-- Old: adultCount, childrenCount
-- New: attendanceAdults, attendanceTeens, attendanceKids
-- See: docs/event-requests-schema-audit.md

-- Step 1: Migrate data from legacy columns to new columns (only where new columns are empty)
UPDATE event_requests
SET attendance_adults = adult_count
WHERE adult_count IS NOT NULL
  AND adult_count > 0
  AND (attendance_adults IS NULL OR attendance_adults = 0);

--> statement-breakpoint

UPDATE event_requests
SET attendance_kids = children_count
WHERE children_count IS NOT NULL
  AND children_count > 0
  AND (attendance_kids IS NULL OR attendance_kids = 0);

--> statement-breakpoint

-- Step 2: Add a comment to document the migration
-- Note: We're keeping the legacy columns for now to ensure backward compatibility
-- They can be removed in a future migration once all code has been updated

-- Step 3: Create a view to help track which records still have data in legacy fields only
-- This can be used to verify migration completeness
-- CREATE VIEW _attendance_migration_status AS
-- SELECT
--   id,
--   organization_name,
--   adult_count as legacy_adults,
--   children_count as legacy_children,
--   attendance_adults as new_adults,
--   attendance_teens as new_teens,
--   attendance_kids as new_kids,
--   CASE
--     WHEN (adult_count IS NOT NULL OR children_count IS NOT NULL)
--          AND (attendance_adults IS NULL AND attendance_kids IS NULL)
--     THEN 'needs_migration'
--     WHEN (adult_count IS NOT NULL OR children_count IS NOT NULL)
--          AND (attendance_adults IS NOT NULL OR attendance_kids IS NOT NULL)
--     THEN 'migrated_with_legacy'
--     ELSE 'clean'
--   END as migration_status
-- FROM event_requests
-- WHERE adult_count IS NOT NULL OR children_count IS NOT NULL
--    OR attendance_adults IS NOT NULL OR attendance_kids IS NOT NULL;
