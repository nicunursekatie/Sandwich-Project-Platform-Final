-- Adds two feature field groups to event_requests.
-- Run against BOTH Neon branches (dev + production). Idempotent.

-- Feature 1: "next follow-up date" suppression.
-- The next_follow_up_date column ALREADY EXISTS in event_requests (it was added
-- previously as "scheduled next attempt date"); Feature 1 reuses it. This
-- IF NOT EXISTS is a safe no-op / drift guard and will do nothing on a DB that
-- already has the column.
ALTER TABLE event_requests
  ADD COLUMN IF NOT EXISTS next_follow_up_date timestamp;

-- Feature 2: TSP-shopped events (TSP buys the supplies for the group for a fee).
ALTER TABLE event_requests
  ADD COLUMN IF NOT EXISTS is_tsp_shopped boolean DEFAULT false;
ALTER TABLE event_requests
  ADD COLUMN IF NOT EXISTS tsp_shop_fee_agreed boolean DEFAULT false;
ALTER TABLE event_requests
  ADD COLUMN IF NOT EXISTS tsp_shop_estimate_provided boolean DEFAULT false;
ALTER TABLE event_requests
  ADD COLUMN IF NOT EXISTS tsp_shop_estimate_amount numeric(10, 2);
ALTER TABLE event_requests
  ADD COLUMN IF NOT EXISTS tsp_shop_paid boolean DEFAULT false;
ALTER TABLE event_requests
  ADD COLUMN IF NOT EXISTS tsp_shop_amount_paid numeric(10, 2);
ALTER TABLE event_requests
  ADD COLUMN IF NOT EXISTS tsp_shop_plan_ready boolean DEFAULT false;
ALTER TABLE event_requests
  ADD COLUMN IF NOT EXISTS tsp_shopping_plan text;
