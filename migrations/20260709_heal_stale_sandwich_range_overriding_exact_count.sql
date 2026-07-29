-- Heal events whose displayed "planned sandwiches" reverts to a stale range midpoint.
--
-- Background
-- ----------
-- getReportableSandwichCount() (shared/sandwich-count-utils.ts) resolves a range
-- midpoint (estimated_sandwich_count_min / _max) BEFORE it looks at the exact
-- estimated_sandwich_count. A prior client bug let a leftover range survive in
-- the DB after a user switched to "Exact Count", so the display kept showing the
-- old range midpoint (e.g. entered 500, showed 498). The client fix stops NEW
-- saves from leaving that stale range behind, but existing rows are still broken
-- until someone reopens and re-saves them. This migration heals them in place.
--
-- What we heal (the bug signature)
-- --------------------------------
-- Rows that carry BOTH an exact estimated_sandwich_count AND a range whose
-- effective display value DIFFERS from that exact count. When they differ, the
-- exact count is the value the user entered and the range is stale, so we clear
-- the range and let the exact count win.
--
-- What we intentionally leave alone
-- ---------------------------------
--   * Pure range events (exact count is NULL) — legitimately range-mode.
--   * Imported/derived ranges where estimated_sandwich_count already equals the
--     range midpoint (e.g. a "500-700" import stored count=600, min=500, max=700).
--     Clearing those would lose a legitimate range display, and the shown value
--     wouldn't change anyway, so we skip them.
--
-- The effective range display value mirrors getRangeMidpoint():
--   * both min>0 and max>0  -> round((min+max)/2)
--   * only one of them >0   -> that value
--   * (values <= 0 are treated as absent, matching toFiniteCount())
--
-- RUN THIS ON BOTH the dev and production Neon branches (verify you are on the
-- intended branch first — see CLAUDE.md "Database branch confusion"). Run the
-- PREVIEW query first and eyeball the rows before running the UPDATE.
--
-- Neon SQL Console note: the console auto-wraps whatever you select-and-run in a
-- single transaction, so there is no explicit BEGIN/COMMIT below (the console
-- rejects manual transaction control). Run the PREVIEW on its own first; when
-- the rows look right, select and run the UPDATE.

-- ── PREVIEW (safe, read-only) ────────────────────────────────────────────────
-- Shows exactly which rows the UPDATE below will touch and how the displayed
-- number will change (range_display -> exact count).
--
-- SELECT
--   id,
--   organization_name,
--   status,
--   estimated_sandwich_count                                   AS exact_count,
--   estimated_sandwich_count_min                               AS range_min,
--   estimated_sandwich_count_max                               AS range_max,
--   COALESCE(
--     CASE
--       WHEN estimated_sandwich_count_min > 0
--        AND estimated_sandwich_count_max > 0
--       THEN round((estimated_sandwich_count_min + estimated_sandwich_count_max) / 2.0)
--     END,
--     NULLIF(GREATEST(estimated_sandwich_count_min, 0), 0),
--     NULLIF(GREATEST(estimated_sandwich_count_max, 0), 0)
--   )::int                                                     AS range_display_now
-- FROM event_requests
-- WHERE estimated_sandwich_count IS NOT NULL
--   AND estimated_sandwich_count > 0
--   AND (COALESCE(estimated_sandwich_count_min, 0) > 0
--        OR COALESCE(estimated_sandwich_count_max, 0) > 0)
--   AND estimated_sandwich_count <> COALESCE(
--     CASE
--       WHEN estimated_sandwich_count_min > 0
--        AND estimated_sandwich_count_max > 0
--       THEN round((estimated_sandwich_count_min + estimated_sandwich_count_max) / 2.0)
--     END,
--     NULLIF(GREATEST(estimated_sandwich_count_min, 0), 0),
--     NULLIF(GREATEST(estimated_sandwich_count_max, 0), 0)
--   )::int
-- ORDER BY id;

-- ── HEAL ─────────────────────────────────────────────────────────────────────
UPDATE event_requests
SET
  estimated_sandwich_count_min = NULL,
  estimated_sandwich_count_max = NULL,
  estimated_sandwich_range_type = NULL
WHERE estimated_sandwich_count IS NOT NULL
  AND estimated_sandwich_count > 0
  AND (COALESCE(estimated_sandwich_count_min, 0) > 0
       OR COALESCE(estimated_sandwich_count_max, 0) > 0)
  AND estimated_sandwich_count <> COALESCE(
    CASE
      WHEN estimated_sandwich_count_min > 0
       AND estimated_sandwich_count_max > 0
      THEN round((estimated_sandwich_count_min + estimated_sandwich_count_max) / 2.0)
    END,
    NULLIF(GREATEST(estimated_sandwich_count_min, 0), 0),
    NULLIF(GREATEST(estimated_sandwich_count_max, 0), 0)
  )::int;
