3-- Convert existing "speaker" assignments into volunteer assignments.
--
-- The Speaker event role has been retired: the scheduling form and scheduled
-- event cards no longer expose any way to view or manage speakers. That leaves
-- people who were already assigned as speakers on NON-completed events orphaned
-- in the speaker columns with no UI to surface them. This migration folds those
-- assignments into the volunteer columns so nobody is lost, then clears the
-- speaker assignment fields on the rows it converts.
--
-- Scope (per product decision):
--   * Only NON-completed events are converted. Completed events keep their
--     speaker records intact so the historical "who spoke" display on completed
--     cards (and past "my assignments") continues to work.
--   * speakers_needed is ROLLED INTO volunteers_needed so the staffing target is
--     preserved (a "needed 1 speaker" becomes a needed volunteer).
--   * The converted speaker ASSIGNMENT fields (ids, tentative ids, details,
--     needed) are cleared. The free-text speaker planning fields
--     (speaker_instructions / speaker_audience_type / speaker_duration) are left
--     as-is — they are dormant, no longer displayed, and clearing them would
--     destroy notes with no benefit.
--
-- Safe to re-run: after conversion a row has no speaker data, so the WHERE
-- clause below no longer matches it (idempotent). Run against BOTH Neon
-- branches (dev + production).

UPDATE event_requests
SET
  -- Merge assigned speakers into assigned volunteers (deduped), only when there
  -- are speakers to merge — otherwise leave the volunteer array untouched
  -- (preserves NULL vs empty distinctions on rows without speaker assignments).
  assigned_volunteer_ids = CASE
    WHEN assigned_speaker_ids IS NOT NULL AND array_length(assigned_speaker_ids, 1) > 0 THEN (
      SELECT ARRAY(
        SELECT DISTINCT e
        FROM unnest(
          COALESCE(assigned_volunteer_ids, ARRAY[]::text[]) || assigned_speaker_ids
        ) AS t(e)
        WHERE e IS NOT NULL AND e <> ''
      )
    )
    ELSE assigned_volunteer_ids
  END,
  tentative_volunteer_ids = CASE
    WHEN tentative_speaker_ids IS NOT NULL AND array_length(tentative_speaker_ids, 1) > 0 THEN (
      SELECT ARRAY(
        SELECT DISTINCT e
        FROM unnest(
          COALESCE(tentative_volunteer_ids, ARRAY[]::text[]) || tentative_speaker_ids
        ) AS t(e)
        WHERE e IS NOT NULL AND e <> ''
      )
    )
    ELSE tentative_volunteer_ids
  END,
  -- Merge the per-person detail maps. `||` on jsonb makes the right operand win
  -- on key conflicts, so an existing volunteer_details entry is preserved when a
  -- person was assigned as BOTH a speaker and a volunteer on the same event.
  volunteer_details = CASE
    WHEN speaker_details IS NOT NULL
         AND speaker_details <> '{}'::jsonb
         AND speaker_details <> 'null'::jsonb THEN
      COALESCE(speaker_details, '{}'::jsonb) || COALESCE(volunteer_details, '{}'::jsonb)
    ELSE volunteer_details
  END,
  -- Roll the speaker headcount need into the volunteer need.
  volunteers_needed = COALESCE(volunteers_needed, 0) + COALESCE(speakers_needed, 0),
  -- Clear the converted speaker assignment fields.
  assigned_speaker_ids = NULL,
  tentative_speaker_ids = NULL,
  speaker_details = NULL,
  speakers_needed = 0,
  updated_at = now()
WHERE status IS DISTINCT FROM 'completed'
  AND (
    (assigned_speaker_ids IS NOT NULL AND array_length(assigned_speaker_ids, 1) > 0)
    OR (tentative_speaker_ids IS NOT NULL AND array_length(tentative_speaker_ids, 1) > 0)
    OR (speaker_details IS NOT NULL AND speaker_details <> '{}'::jsonb AND speaker_details <> 'null'::jsonb)
    OR COALESCE(speakers_needed, 0) > 0
  );
