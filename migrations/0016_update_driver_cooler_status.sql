-- Add cooler_status column
ALTER TABLE "drivers" ADD COLUMN "cooler_status" text;

-- Migrate existing data from boolean fields to new status field
UPDATE "drivers" SET "cooler_status" =
  CASE
    WHEN "holds_tsp_coolers" = true THEN 'has_tsp_coolers'
    WHEN "will_purchase_coolers" = true THEN 'would_buy_coolers'
    ELSE NULL
  END;

-- Drop old boolean columns
ALTER TABLE "drivers" DROP COLUMN "holds_tsp_coolers";
ALTER TABLE "drivers" DROP COLUMN "will_purchase_coolers";
