-- Make event_requests.phone explicitly nullable.
--
-- Why this exists: the Drizzle schema has had `phone: varchar('phone')`
-- (no `.notNull()`) for some time, and the Zod insert schema and client
-- form both allow phone to be blank/null. But users keep reporting that
-- manual event entry fails when phone is empty.
--
-- The most likely cause: the column was created with NOT NULL very early
-- (before `varchar('phone')` was changed to be nullable in code) and was
-- never altered in the production database. Drizzle Studio / dev branches
-- may have been re-pushed and have the correct constraint; production
-- never got the change.
--
-- This statement is safe to run repeatedly: dropping NOT NULL on a column
-- that is already nullable is a no-op.
--
-- Run against BOTH Neon branches: dev AND production.

ALTER TABLE event_requests
  ALTER COLUMN phone DROP NOT NULL;

-- While we're here, do the same defensive check for the other contact
-- fields that have all explicitly been changed to nullable in code. If
-- any are still NOT NULL in prod, the same symptom would appear for any
-- of them (first name, last name, email, organization name).

ALTER TABLE event_requests
  ALTER COLUMN first_name DROP NOT NULL;

ALTER TABLE event_requests
  ALTER COLUMN last_name DROP NOT NULL;

ALTER TABLE event_requests
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE event_requests
  ALTER COLUMN organization_name DROP NOT NULL;
