-- ============================================================================
-- Which calculation produces the number the app is showing?
--
-- READ ONLY. Changes nothing. Safe on production.
--
-- The collections log for 2026 totals 89,309 by the documented formula
-- (individual + group counts). The app reports 340,671. Rather than guess at
-- the cause again, this computes every plausible variant per year. Whichever
-- column reproduces the app's figure identifies the calculation it is using.
--
-- Variants, left to right:
--   a_documented      individual + group count        <- the documented formula
--   b_with_deleted    the same, but including soft-deleted rows
--   c_plus_group_type ALSO adds the per-filling keys inside each group entry
--                     (deli/pbj/ham/turkey/generic). These are a BREAKDOWN of
--                     count, so adding them double-counts.
--   d_plus_indiv_type ALSO adds the individual_* filling columns, which are
--                     likewise a breakdown of individual_sandwiches.
--   e_everything      both double-counts at once
--   f_individual_only individual only, ignoring groups entirely
-- ============================================================================

WITH per_row AS (
  SELECT
    LEFT(sc.collection_date, 4) AS year,
    sc.deleted_at,
    COALESCE(sc.individual_sandwiches, 0)::numeric AS individual,
    COALESCE(sc.individual_deli, 0) + COALESCE(sc.individual_turkey, 0)
      + COALESCE(sc.individual_ham, 0) + COALESCE(sc.individual_pbj, 0)
      + COALESCE(sc.individual_generic, 0)                    AS individual_types,
    CASE
      WHEN jsonb_typeof(sc.group_collections) = 'array'
           AND jsonb_array_length(sc.group_collections) > 0
        THEN (
          SELECT COALESCE(SUM(
            CASE WHEN g->>'count' ~ '^\s*-?\d+(\.\d+)?\s*$'
                 THEN (g->>'count')::numeric ELSE 0 END), 0)
          FROM jsonb_array_elements(sc.group_collections) AS g
        )
      ELSE COALESCE(sc.group1_count, 0) + COALESCE(sc.group2_count, 0)
    END                                                        AS group_count,
    CASE
      WHEN jsonb_typeof(sc.group_collections) = 'array'
           AND jsonb_array_length(sc.group_collections) > 0
        THEN (
          SELECT COALESCE(SUM(
            CASE WHEN g->>'deli'    ~ '^\d+$' THEN (g->>'deli')::numeric    ELSE 0 END +
            CASE WHEN g->>'turkey'  ~ '^\d+$' THEN (g->>'turkey')::numeric  ELSE 0 END +
            CASE WHEN g->>'ham'     ~ '^\d+$' THEN (g->>'ham')::numeric     ELSE 0 END +
            CASE WHEN g->>'pbj'     ~ '^\d+$' THEN (g->>'pbj')::numeric     ELSE 0 END +
            CASE WHEN g->>'generic' ~ '^\d+$' THEN (g->>'generic')::numeric ELSE 0 END
          ), 0)
          FROM jsonb_array_elements(sc.group_collections) AS g
        )
      ELSE 0
    END                                                        AS group_types
  FROM sandwich_collections sc
)
SELECT
  year,
  COUNT(*) FILTER (WHERE deleted_at IS NULL)                                  AS rows,
  SUM(individual + group_count) FILTER (WHERE deleted_at IS NULL)::bigint     AS a_documented,
  SUM(individual + group_count)::bigint                                       AS b_with_deleted,
  SUM(individual + group_count + group_types) FILTER (WHERE deleted_at IS NULL)::bigint
                                                                              AS c_plus_group_type,
  SUM(individual + individual_types + group_count) FILTER (WHERE deleted_at IS NULL)::bigint
                                                                              AS d_plus_indiv_type,
  SUM(individual + individual_types + group_count + group_types) FILTER (WHERE deleted_at IS NULL)::bigint
                                                                              AS e_everything,
  SUM(individual) FILTER (WHERE deleted_at IS NULL)::bigint                   AS f_individual_only
FROM per_row
GROUP BY year
ORDER BY year;
