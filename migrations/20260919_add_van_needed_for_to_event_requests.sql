-- Why the van is needed: transport only, or refrigeration during the event.
-- Written to planning-sheet column J ("Van needed for?"). Only meaningful when
-- van_driver_needed is true.
--
-- Run this on BOTH Neon branches (dev and production) BEFORE deploying the code
-- that declares vanNeededFor in shared/schema.ts.
ALTER TABLE event_requests
  ADD COLUMN IF NOT EXISTS van_needed_for VARCHAR;
