-- Migration: Consolidate group sandwich data into group_collections JSONB column
-- This migration fixes the double-counting issue by moving all legacy group1/group2 data
-- into the new group_collections JSONB array and nullifying the legacy columns.

-- Step 1: Migrate data from group1/group2 fields to group_collections
-- Only migrate records where group_collections is empty or default ('[]')
-- and where at least one legacy group field has data

UPDATE sandwich_collections sc
SET group_collections = (
  -- Build array from group1 and group2, filtering out empty entries
  SELECT COALESCE(jsonb_agg(group_obj), '[]'::jsonb)
  FROM (
    -- Group 1 entry (if exists)
    SELECT jsonb_build_object(
      'name', COALESCE(sc.group1_name, 'Group 1'),
      'count', COALESCE(sc.group1_count, 0)
    ) as group_obj
    WHERE sc.group1_count > 0 OR sc.group1_name IS NOT NULL

    UNION ALL

    -- Group 2 entry (if exists)
    SELECT jsonb_build_object(
      'name', COALESCE(sc.group2_name, 'Group 2'),
      'count', COALESCE(sc.group2_count, 0)
    ) as group_obj
    WHERE sc.group2_count > 0 OR sc.group2_name IS NOT NULL
  ) groups
)
WHERE
  -- Only migrate if group_collections is empty or default
  (sc.group_collections = '[]'::jsonb OR sc.group_collections IS NULL OR sc.group_collections = 'null'::jsonb)
  -- And at least one legacy field has data
  AND (
    (sc.group1_count IS NOT NULL AND sc.group1_count > 0)
    OR (sc.group2_count IS NOT NULL AND sc.group2_count > 0)
    OR sc.group1_name IS NOT NULL
    OR sc.group2_name IS NOT NULL
  );
--> statement-breakpoint
-- Step 2: Set group_collections to default empty array for any remaining NULL values
UPDATE sandwich_collections
SET group_collections = '[]'::jsonb
WHERE group_collections IS NULL OR group_collections = 'null'::jsonb;
--> statement-breakpoint
-- Step 3: Now that data is migrated, set all legacy group fields to NULL
-- This prevents double-counting going forward
UPDATE sandwich_collections
SET
  group1_name = NULL,
  group1_count = NULL,
  group2_name = NULL,
  group2_count = NULL
WHERE
  group_collections IS NOT NULL
  AND group_collections != '[]'::jsonb
  AND (
    group1_count IS NOT NULL
    OR group2_count IS NOT NULL
    OR group1_name IS NOT NULL
    OR group2_name IS NOT NULL
  );
--> statement-breakpoint
-- Step 4: Add a comment to the table documenting this change
COMMENT ON COLUMN sandwich_collections.group1_name IS 'DEPRECATED: Use group_collections JSONB column instead. This field should remain NULL to prevent double-counting.';
--> statement-breakpoint
COMMENT ON COLUMN sandwich_collections.group1_count IS 'DEPRECATED: Use group_collections JSONB column instead. This field should remain NULL to prevent double-counting.';
--> statement-breakpoint
COMMENT ON COLUMN sandwich_collections.group2_name IS 'DEPRECATED: Use group_collections JSONB column instead. This field should remain NULL to prevent double-counting.';
--> statement-breakpoint
COMMENT ON COLUMN sandwich_collections.group2_count IS 'DEPRECATED: Use group_collections JSONB column instead. This field should remain NULL to prevent double-counting.';
