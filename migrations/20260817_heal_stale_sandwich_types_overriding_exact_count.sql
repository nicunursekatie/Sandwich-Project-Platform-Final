-- Heal events whose planned sandwich count reverts to a stale TYPES breakdown.
--
-- Background
-- ----------
-- Companion to 20260709_heal_stale_sandwich_range_overriding_exact_count.sql.
-- That migration healed the range half of the "entered 500, shows 498" bug
-- (a leftover 490-506 whose midpoint won over the exact count). The same defect
-- existed in the sandwich_types half and is what kept the bug coming back:
--
--   * The Scheduled tab's inline sandwich editor opened in "Specify Types" mode
--     whenever ANY breakdown was stored, with no check that it agreed with the
--     exact count. Saving re-summed the leftover breakdown over the count the
--     user had typed (exact 500 + stale [250 turkey, 248 PBJ] -> saved as 498).
--   * The edit form's diff-based save dropped its own `sandwichTypes = NULL`
--     clear whenever the baseline resolved to the same mode being saved, so the
--     stale breakdown was never cleaned up and the cycle repeated.
--   * Card/list displays rendered the breakdown in place of the exact count.
--
-- The client fixes stop NEW saves from leaving a disagreeing breakdown behind
-- and stop existing ones from being summed back over the exact count, but the
-- rows themselves stay double-valued until someone reopens and re-saves them.
-- This migration heals them in place.
--
-- What we heal (the bug signature)
-- --------------------------------
-- Rows that carry BOTH an exact estimated_sandwich_count AND a sandwich_types
-- breakdown whose quantities sum to a DIFFERENT number. When they differ, the
-- exact count is the value the user entered, so we clear the breakdown and let
-- the exact count win.
--
-- What we intentionally leave alone
-- ---------------------------------
--   * Pure breakdown events (exact count is NULL) — legitimately types-mode.
--   * Breakdowns that already sum to estimated_sandwich_count (e.g. 250 turkey
--     + 250 PBJ stored alongside count 500). Those agree, so the displayed
--     number wouldn't change and the type labels are worth keeping.
--   * Rows with no breakdown at all.
--
-- NOTE: clearing sandwich_types discards the per-type labels on those rows
-- (which type the leftover quantities were assigned to). That breakdown is
-- already contradicted by the exact count, so it is not trustworthy — but run
-- the PREVIEW first and export it if you want a record of what was dropped.
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
-- number will change (types_total -> exact count).
--
-- SELECT
--   id,
--   organization_name,
--   status,
--   estimated_sandwich_count AS exact_count,
--   sandwich_types,
--   (
--     SELECT COALESCE(SUM(
--       CASE
--         WHEN elem->>'quantity' ~ '^-?[0-9]+(\.[0-9]+)?$'
--         THEN (elem->>'quantity')::numeric
--         ELSE 0
--       END
--     ), 0)
--     FROM jsonb_array_elements(sandwich_types) AS elem
--   )::int AS types_total_now
-- FROM event_requests
-- WHERE estimated_sandwich_count IS NOT NULL
--   AND estimated_sandwich_count > 0
--   AND sandwich_types IS NOT NULL
--   AND jsonb_typeof(sandwich_types) = 'array'
--   AND jsonb_array_length(sandwich_types) > 0
--   AND estimated_sandwich_count <> (
--     SELECT COALESCE(SUM(
--       CASE
--         WHEN elem->>'quantity' ~ '^-?[0-9]+(\.[0-9]+)?$'
--         THEN (elem->>'quantity')::numeric
--         ELSE 0
--       END
--     ), 0)
--     FROM jsonb_array_elements(sandwich_types) AS elem
--   )::int
-- ORDER BY id;

-- ── HEAL ─────────────────────────────────────────────────────────────────────
UPDATE event_requests
SET sandwich_types = NULL
WHERE estimated_sandwich_count IS NOT NULL
  AND estimated_sandwich_count > 0
  AND sandwich_types IS NOT NULL
  AND jsonb_typeof(sandwich_types) = 'array'
  AND jsonb_array_length(sandwich_types) > 0
  AND estimated_sandwich_count <> (
    SELECT COALESCE(SUM(
      CASE
        WHEN elem->>'quantity' ~ '^-?[0-9]+(\.[0-9]+)?$'
        THEN (elem->>'quantity')::numeric
        ELSE 0
      END
    ), 0)
    FROM jsonb_array_elements(sandwich_types) AS elem
  )::int;

-- ── OPTIONAL: the same heal for the ACTUAL (post-event) count ────────────────
-- actual_sandwich_types / actual_sandwich_count have the identical defect. Per
-- CLAUDE.md, actual_sandwich_count is a manual for-reference field and official
-- totals live in sandwich_collections, so this is lower stakes — but a stale
-- actual breakdown will misreport the same way on completed-event cards.
-- Preview it the same way before running.
--
-- UPDATE event_requests
-- SET actual_sandwich_types = NULL
-- WHERE actual_sandwich_count IS NOT NULL
--   AND actual_sandwich_count > 0
--   AND actual_sandwich_types IS NOT NULL
--   AND jsonb_typeof(actual_sandwich_types) = 'array'
--   AND jsonb_array_length(actual_sandwich_types) > 0
--   AND actual_sandwich_count <> (
--     SELECT COALESCE(SUM(
--       CASE
--         WHEN elem->>'quantity' ~ '^-?[0-9]+(\.[0-9]+)?$'
--         THEN (elem->>'quantity')::numeric
--         ELSE 0
--       END
--     ), 0)
--     FROM jsonb_array_elements(actual_sandwich_types) AS elem
--   )::int;
