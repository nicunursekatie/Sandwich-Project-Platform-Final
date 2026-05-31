-- Migration: Backfill show_on_volunteer_hub for already-scheduled events
-- Date: 2026-05-31
-- Description:
--   Going forward, events automatically get show_on_volunteer_hub = true when they
--   transition to a scheduled/rescheduled status (see PATCH /api/event-requests/:id).
--   This one-time backfill surfaces events that were ALREADY scheduled before that
--   change shipped, so they appear on the Volunteer Hub without needing a manual edit.
--
--   Scope intentionally limited to show_on_volunteer_hub. We do NOT touch is_confirmed
--   here, since some existing scheduled events may legitimately still have a pending date.
--   Only flips events that are currently false, so any you've deliberately turned off and
--   left scheduled will be turned back on too — re-hide those individually if needed.

UPDATE event_requests
SET show_on_volunteer_hub = true,
    updated_at = NOW()
WHERE status IN ('scheduled', 'rescheduled')
  AND show_on_volunteer_hub = false
  AND deleted_at IS NULL;

-- Verify (optional - for manual verification):
-- SELECT id, organization_name, status, show_on_volunteer_hub
-- FROM event_requests
-- WHERE status IN ('scheduled', 'rescheduled') AND deleted_at IS NULL
-- ORDER BY scheduled_event_date;
