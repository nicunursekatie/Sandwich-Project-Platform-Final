-- ============================================================================
-- Reconcile the yearly sandwich totals -- ONE query, ONE result grid
--
-- READ ONLY. Changes nothing. Safe on production. Needs no analyst_* views.
--
-- Puts the two sources side by side for every year:
--   log_total     -- the live collections log, using the app's own formula
--                    (client/src/lib/analytics-utils.ts calculateTotalSandwiches)
--   archive_total -- Scott's authoritative_weekly_collections archive
--
-- Compare log_total against the Analytics tab. That tells us which number the
-- app is actually showing, and therefore where the discrepancy lives.
--
-- skipped_group_entries is the tell for a silent undercount: it counts group
-- entries whose count value is not plain digits -- e.g. "1,450" with a comma,
-- which JavaScript's Number() path treats differently than a SQL numeric cast.
-- Anything above 0 there means sandwiches are being dropped somewhere.
-- ============================================================================

WITH log_rows AS (
  SELECT
    LEFT(sc.collection_date, 4) AS year,
    COALESCE(sc.individual_sandwiches, 0)::numeric AS individual,
    CASE
      WHEN jsonb_typeof(sc.group_collections) = 'array'
           AND jsonb_array_length(sc.group_collections) > 0
        THEN (
          SELECT COALESCE(SUM(
            CASE WHEN COALESCE(g->>'count', g->>'sandwichCount', '') ~ '^\s*-?\d+(\.\d+)?\s*$'
                 THEN COALESCE(g->>'count', g->>'sandwichCount')::numeric
                 ELSE 0 END
          ), 0)
          FROM jsonb_array_elements(sc.group_collections) AS g
        )
      ELSE COALESCE(sc.group1_count, 0) + COALESCE(sc.group2_count, 0)
    END AS groups,
    CASE
      WHEN jsonb_typeof(sc.group_collections) = 'array'
           AND jsonb_array_length(sc.group_collections) > 0
        THEN (
          SELECT COUNT(*)
          FROM jsonb_array_elements(sc.group_collections) AS g
          WHERE COALESCE(g->>'count', g->>'sandwichCount', '') !~ '^\s*-?\d+(\.\d+)?\s*$'
        )
      ELSE 0
    END AS skipped
  FROM sandwich_collections sc
  WHERE sc.deleted_at IS NULL
),
log_by_year AS (
  SELECT
    year,
    COUNT(*)                  AS log_rows,
    SUM(individual)::bigint   AS log_individual,
    SUM(groups)::bigint       AS log_groups,
    SUM(individual + groups)::bigint AS log_total,
    SUM(skipped)::bigint      AS skipped_group_entries
  FROM log_rows
  GROUP BY year
),
archive_by_year AS (
  SELECT
    year::text                AS year,
    COUNT(*)                  AS archive_rows,
    SUM(sandwiches)::bigint   AS archive_total
  FROM authoritative_weekly_collections
  GROUP BY year
)
SELECT
  COALESCE(l.year, a.year)                    AS year,
  l.log_rows,
  l.log_individual,
  l.log_groups,
  l.log_total,
  l.skipped_group_entries,
  a.archive_rows,
  a.archive_total,
  COALESCE(l.log_total, 0) - COALESCE(a.archive_total, 0) AS log_minus_archive
FROM log_by_year l
FULL OUTER JOIN archive_by_year a ON l.year = a.year
ORDER BY year;
