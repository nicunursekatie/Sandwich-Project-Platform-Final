-- ============================================================================
-- Where does the rest of the app's yearly total come from?
--
-- READ ONLY. Changes nothing. Safe on production.
--
-- The collections table has been exhausted. Computed six different ways --
-- including variants that deliberately double-count -- its 2026 maximum is
-- 125,352 against the app's 340,671. No formula over sandwich_collections
-- reaches that figure, so the remainder comes from another table.
--
-- Amount unaccounted for, per year, against the documented collections total:
--   2022  +11,519    2023  +22,055    2024  +64,641
--   2025  +24,077    2026 +251,362
--
-- Every other table holding a sandwich count is listed below. Whichever column
-- lines up with those amounts is the source being folded in.
--
-- The 2026 shape matters: collections stopped on 2026-02-27, yet the app shows
-- a large 2026 figure. A source containing PLANNED or SCHEDULED counts for
-- events later in the year would behave exactly like that -- and CLAUDE.md is
-- explicit that event counts must never be used for reporting totals.
-- ============================================================================

-- A. EVENT REQUESTS -- estimated vs actual, by effective event date
-- effectiveDate follows the app rule: scheduled first, then desired.
SELECT
  'A. events' AS source,
  TO_CHAR(COALESCE(e.scheduled_event_date, e.desired_event_date), 'YYYY') AS year,
  COUNT(*)                                                    AS rows,
  COALESCE(SUM(e.estimated_sandwich_count), 0)::bigint        AS estimated_sandwiches,
  COALESCE(SUM(e.actual_sandwich_count), 0)::bigint           AS actual_sandwiches,
  COALESCE(SUM(COALESCE(e.actual_sandwich_count, e.estimated_sandwich_count)), 0)::bigint
                                                              AS actual_else_estimated
FROM event_requests e
WHERE e.deleted_at IS NULL
  AND COALESCE(e.scheduled_event_date, e.desired_event_date) IS NOT NULL
GROUP BY 2
ORDER BY 2;

-- B. SANDWICH DISTRIBUTIONS
SELECT
  'B. distributions' AS source,
  LEFT(d.distribution_date, 4)                      AS year,
  COUNT(*)                                          AS rows,
  COALESCE(SUM(d.sandwich_count), 0)::bigint        AS sandwiches
FROM sandwich_distributions d
GROUP BY 2
ORDER BY 2;

-- C. WEEKLY REPORTS
SELECT
  'C. weekly_reports' AS source,
  COUNT(*)                                          AS rows,
  COALESCE(SUM(w.sandwich_count), 0)::bigint        AS sandwiches
FROM weekly_reports w;
