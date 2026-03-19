-- Migrate all postponed events to standby status
-- Preserve postponement context by copying reason and tentative date into standby fields
UPDATE event_requests
SET
  status = 'standby',
  standby_reason = COALESCE(standby_reason, postponement_reason),
  standby_expected_date = COALESCE(standby_expected_date, tentative_new_date),
  standby_marked_at = COALESCE(standby_marked_at, postponed_at, NOW()),
  standby_marked_by = COALESCE(standby_marked_by, postponed_by)
WHERE status = 'postponed';

-- NOTE: Postponement columns (postponement_reason, tentative_new_date, postponed_at,
-- postponed_by, was_postponed, postponement_count) are intentionally kept for historical data.
-- Do NOT drop these columns.
