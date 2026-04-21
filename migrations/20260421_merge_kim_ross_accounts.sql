-- Merge Kim Ross's old account into her new account.
--
-- OLD: user_1756855307041_by1nnrlif  (Kim,      ross.kimberly.a@gmail.com)
-- NEW: user_1776738304424_0y0pdrlpi  (Kimberly, ross.Kimberly.a@gmail.com)
--
-- Strategy: Dynamically discover every column in public schema whose name looks like
-- a user-id reference (user_id, *_user_id, created_by, submitted_by, *_marked_by,
-- etc.) and rewrite old -> new. This is resilient to schema drift: missing tables
-- or renamed columns simply aren't in information_schema, so they're skipped.
--
-- Display-name columns (*_name, *_by_name) and snapshot text fields are intentionally
-- excluded -- those are historical text, not FKs.
--
-- HOW TO RUN (Neon SQL editor):
--   Neon's SQL Console doesn't allow manual BEGIN/COMMIT -- it auto-wraps
--   a selection in a transaction. Recommended flow:
--     1. In Neon, create a branch from production (e.g. "kim-merge-test").
--     2. Point the SQL Console at that branch.
--     3. Paste this whole file and run. Read the NOTICES panel -- each UPDATE
--        prints its table/column and row count, then "TOTAL rows updated: N"
--        and "Total lingering references to old id: 0".
--     4. If the numbers look right, point the Console at the PRODUCTION branch
--        and run the file again.
--     5. Delete the test branch.
--     6. Ask Kim to log out and log back in.
--
--   Running as `psql` instead? This file does work with explicit BEGIN/COMMIT,
--   but Neon's web console rejects those. The DO blocks below are each
--   auto-transactional on their own, so running them top-to-bottom is safe.

DO $$
DECLARE
    v_old_id  TEXT := 'user_1756855307041_by1nnrlif';
    v_new_id  TEXT := 'user_1776738304424_0y0pdrlpi';
    r         RECORD;
    v_sql     TEXT;
    v_rows    INT;
    v_total   INT := 0;
BEGIN
    -- ============================================================
    -- 1. SCALAR COLUMNS (varchar/text holding a user id)
    -- ============================================================
    -- Pattern reasoning: every column in this prod schema that holds a user id
    -- ends in `_by`, matches `user_id`/`*_user_id`, or is named `assigned_to`.
    -- Verified against information_schema on 2026-04-21 -- no false positives.
    FOR r IN
        SELECT table_schema, table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type IN ('character varying', 'text')
          AND (
                 column_name  = 'user_id'
              OR column_name LIKE '%\_user\_id' ESCAPE '\'
              OR column_name LIKE '%\_by'       ESCAPE '\'
              OR column_name  = 'assigned_to'
          )
          -- Exclude display-name snapshot columns (created_by_name, etc.)
          AND column_name NOT LIKE '%\_name' ESCAPE '\'
          -- Don't rewrite users.id itself
          AND NOT (table_name = 'users' AND column_name = 'id')
        ORDER BY table_name, column_name
    LOOP
        v_sql := format(
            'UPDATE %I.%I SET %I = %L WHERE %I = %L',
            r.table_schema, r.table_name, r.column_name, v_new_id,
            r.column_name, v_old_id
        );
        BEGIN
            EXECUTE v_sql;
            GET DIAGNOSTICS v_rows = ROW_COUNT;
            IF v_rows > 0 THEN
                RAISE NOTICE '  %.% -> % rows', r.table_name, r.column_name, v_rows;
                v_total := v_total + v_rows;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  SKIPPED %.%  (%)', r.table_name, r.column_name, SQLERRM;
        END;
    END LOOP;

    -- ============================================================
    -- 2. ARRAY COLUMNS (text[] holding user ids, e.g. team_board_items.assigned_to)
    -- ============================================================
    FOR r IN
        SELECT table_schema, table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type = 'ARRAY'
          AND (column_name = 'assigned_to' OR column_name LIKE '%\_user\_ids' ESCAPE '\')
        ORDER BY table_name, column_name
    LOOP
        v_sql := format(
            'UPDATE %I.%I SET %I = array_replace(%I, %L, %L) WHERE %L = ANY(%I)',
            r.table_schema, r.table_name, r.column_name, r.column_name,
            v_old_id, v_new_id, v_old_id, r.column_name
        );
        BEGIN
            EXECUTE v_sql;
            GET DIAGNOSTICS v_rows = ROW_COUNT;
            IF v_rows > 0 THEN
                RAISE NOTICE '  %.%  (array) -> % rows', r.table_name, r.column_name, v_rows;
                v_total := v_total + v_rows;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  SKIPPED %.%  (%)', r.table_name, r.column_name, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE '--------------------------------------------------';
    RAISE NOTICE 'TOTAL rows updated: %', v_total;
    RAISE NOTICE '--------------------------------------------------';

    -- ============================================================
    -- 3. DEACTIVATE OLD ACCOUNT
    -- ============================================================
    UPDATE users
    SET is_active  = false,
        email      = email || '.merged_into_' || v_new_id,
        updated_at = NOW()
    WHERE id = v_old_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RAISE NOTICE 'Deactivated old user: % row(s)', v_rows;
END $$;

-- ============================================================
-- 4. VERIFICATION (should show the old user is deactivated and
--    no rows reference the old id anywhere we can see)
-- ============================================================
SELECT id, email, is_active, updated_at
FROM users
WHERE id IN ('user_1756855307041_by1nnrlif', 'user_1776738304424_0y0pdrlpi');

-- Scan public schema for any remaining refs to the old id across every
-- varchar/text column. Should return zero rows after the merge.
DO $$
DECLARE
    r       RECORD;
    v_sql   TEXT;
    v_found INT;
    v_total INT := 0;
BEGIN
    FOR r IN
        SELECT table_schema, table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type IN ('character varying', 'text')
          AND NOT (table_name = 'users' AND column_name IN ('id', 'email'))
    LOOP
        v_sql := format(
            'SELECT COUNT(*) FROM %I.%I WHERE %I = %L',
            r.table_schema, r.table_name, r.column_name, 'user_1756855307041_by1nnrlif'
        );
        BEGIN
            EXECUTE v_sql INTO v_found;
            IF v_found > 0 THEN
                RAISE NOTICE '  REMAINING: %.% -> % rows', r.table_name, r.column_name, v_found;
                v_total := v_total + v_found;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;  -- ignore columns we can't scan
        END;
    END LOOP;
    RAISE NOTICE 'Total lingering references to old id: %', v_total;
END $$;

-- ============================================================
-- (No explicit COMMIT needed -- each DO block above auto-commits in Neon.)
-- ============================================================
