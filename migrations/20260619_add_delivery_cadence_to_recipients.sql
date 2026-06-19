-- Add delivery cadence (tier) + optional note to recipients.
--
-- Cadence is about HOW OFTEN we serve the org, independent of the
-- estimated sandwich count. Allowed values:
--   'weekly_priority'  -- regular committed orgs
--   'when_extras'      -- leftover-driven; served when we have surplus
--   'as_needed'        -- irregular / special-circumstance orgs
-- NULL = not categorized yet.
--
-- Run against BOTH Neon branches: dev AND production.

ALTER TABLE recipients
  ADD COLUMN IF NOT EXISTS delivery_cadence TEXT,
  ADD COLUMN IF NOT EXISTS delivery_cadence_note TEXT;
