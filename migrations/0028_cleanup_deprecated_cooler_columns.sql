-- Cleanup deprecated cooler boolean columns
-- These were replaced by the cooler_status text field in migration 0016
-- The data shows 0 drivers using these boolean fields - all use cooler_status instead

ALTER TABLE "drivers" DROP COLUMN IF EXISTS "holds_tsp_coolers";

--> statement-breakpoint

ALTER TABLE "drivers" DROP COLUMN IF EXISTS "will_purchase_coolers";
