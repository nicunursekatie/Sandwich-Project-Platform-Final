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

-- Constrain experience_level to the known readiness values. The create-path Zod
-- schema already enforces this, but PATCH /api/volunteers/:id forwards arbitrary
-- bodies, so a DB-level CHECK is defense-in-depth. Idempotent: only add the
-- constraint if it isn't already present (ADD CONSTRAINT has no IF NOT EXISTS).
DO $$
BEGIN
  -- Scope the existence check to a CHECK constraint on the volunteers table
  -- specifically, so a same-named constraint on a different table can't cause
  -- this to skip and leave experience_level unconstrained.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'volunteers_experience_level_check'
      AND conrelid = 'volunteers'::regclass
      AND contype = 'c'
  ) THEN
    ALTER TABLE volunteers
      ADD CONSTRAINT volunteers_experience_level_check
      CHECK (experience_level IN ('new', 'experienced'));
  END IF;
END $$;
