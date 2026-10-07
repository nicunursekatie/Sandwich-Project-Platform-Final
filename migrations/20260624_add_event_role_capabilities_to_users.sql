-- Add event-role capabilities to users so the Volunteer Hub can tailor what
-- each person sees and signs up for. Two axes per role (see
-- shared/event-role-eligibility.ts):
--   - willing_*   = self-declared by the user (what they want to do)
--   - *_approved  = coordinator-granted vetting for roles with responsibility
-- A user is offered a role when they're willing AND (where required) approved.
-- General volunteering is the baseline everyone can do, so willing_to_volunteer
-- defaults to true. The other flags default to false (opt-in / must be vetted).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS willing_to_volunteer boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS willing_to_speak boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS willing_to_drive boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS speaker_approved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS driver_approved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS event_roles_modified_at timestamp,
  ADD COLUMN IF NOT EXISTS event_roles_modified_by varchar;

-- Backfill: anyone already approved to drive the van clearly drives, so seed
-- their driving willingness + approval. Safe to re-run.
UPDATE users
SET willing_to_drive = true,
    driver_approved = true
WHERE van_approved = true
  AND (willing_to_drive IS DISTINCT FROM true OR driver_approved IS DISTINCT FROM true);
