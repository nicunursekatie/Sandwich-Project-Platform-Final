-- Volunteer readiness tracking.
--
-- The organization is retiring the separate "Speaker" role and treating everyone
-- as a volunteer, categorized by readiness:
--   * experience_level = 'new'         -> not yet cleared to attend an event alone;
--                                         must be paired with an experienced volunteer.
--   * experience_level = 'experienced' -> cleared to attend any event solo.
--
-- training_completed records whether the volunteer has been through the onboarding
-- training we're implementing. It is kept independent of experience_level so we can
-- record that someone finished training separately from clearing them to solo.
--
-- Both default to the "not ready" side so existing rows are conservative until an
-- admin reviews them.

ALTER TABLE volunteers
  ADD COLUMN IF NOT EXISTS experience_level text NOT NULL DEFAULT 'new';

ALTER TABLE volunteers
  ADD COLUMN IF NOT EXISTS training_completed boolean NOT NULL DEFAULT false;
