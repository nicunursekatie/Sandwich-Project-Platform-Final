---
name: sandwich_collections group_collections encoding quirk
description: Some prod rows store group_collections as a string-encoded jsonb, not a jsonb array
---
In the prod Neon DB, ~50 `sandwich_collections` rows have `group_collections` where `jsonb_typeof = 'string'` (a JSON string containing JSON), not an array. Correct totals per row: `individual_sandwiches` + (sum of `group_collections[].count` if a non-empty array; if `jsonb_typeof='string'`, parse `(col #>> '{}')::jsonb` first; else fall back to `group1_count + group2_count`). Never sum both jsonb and legacy columns (double-counts). Filter `deleted_at IS NULL`; `collection_date` is TEXT but all ISO.

**Why:** naive `jsonb_array_elements` queries error or silently skip the string-encoded rows, undercounting totals.

**How to apply:** any script computing sandwich totals against the app's Neon DB (via DATABASE_URL script, never executeSql) must handle the string-encoded case.
