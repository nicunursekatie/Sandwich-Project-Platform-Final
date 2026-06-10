-- Add per-user opt-out for the Monday morning "Your Weekly Event Portfolio"
-- digest email. Default false (everyone receives by default, matching prior
-- behavior). Users with this flag set are filtered out in
-- weekly-digest-service.processWeeklyDigests.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS weekly_digest_opt_out boolean NOT NULL DEFAULT false;

-- Seed: opt Marcy out per request. Match by both email addresses on file,
-- case-insensitively so any stray casing in the row is still caught.
UPDATE users
SET weekly_digest_opt_out = true
WHERE LOWER(email) IN (
  'mdlouza@gmail.com',
  'marcy@thesandwichproject.org'
);
