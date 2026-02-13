-- Migration: Fix Driver Availability Status
-- Date: 2026-01-25
-- Description: Clean up driver availability data to fix the bug where drivers were incorrectly marked as unavailable
--
-- This migration addresses:
-- 1. Drivers with NULL availability_status
-- 2. Old unavailable_start_date values that caused the cron job to incorrectly mark drivers as unavailable
-- 3. Ensures all active drivers have proper status set

-- Step 1: Set availability_status to 'available' for drivers where it's NULL
-- Only for active drivers who are not marked as temporarily unavailable
UPDATE drivers
SET availability_status = 'available'
WHERE availability_status IS NULL
  AND is_active = true
  AND (temporarily_unavailable = false OR temporarily_unavailable IS NULL);
--> statement-breakpoint
-- Step 2: Set availability_status to 'inactive' for drivers who are not active
UPDATE drivers
SET availability_status = 'inactive'
WHERE availability_status IS NULL
  AND is_active = false;
--> statement-breakpoint
-- Step 3: Set availability_status to 'unavailable' for drivers marked as temporarily_unavailable
-- but only if they don't have a future unavailable_start_date
UPDATE drivers
SET availability_status = 'unavailable'
WHERE availability_status IS NULL
  AND temporarily_unavailable = true
  AND (unavailable_start_date IS NULL OR unavailable_start_date <= NOW());
--> statement-breakpoint
-- Step 4: Clear old unavailable_start_date values that are in the past
-- for drivers who are currently marked as 'available'
-- These old dates were causing the cron job to incorrectly mark drivers as unavailable
UPDATE drivers
SET unavailable_start_date = NULL,
    check_in_date = NULL,
    unavailable_reason = NULL
WHERE availability_status = 'available'
  AND unavailable_start_date IS NOT NULL
  AND unavailable_start_date < NOW();
--> statement-breakpoint
-- Step 5: Clear unavailable_start_date for drivers who are already unavailable
-- (The date has already "happened", so it's no longer needed)
UPDATE drivers
SET unavailable_start_date = NULL
WHERE availability_status IN ('unavailable', 'pending_checkin')
  AND unavailable_start_date IS NOT NULL
  AND unavailable_start_date < NOW();
--> statement-breakpoint
-- Step 6: Ensure all drivers have a non-NULL availability_status
-- This catches any edge cases not covered above
UPDATE drivers
SET availability_status = 'available'
WHERE availability_status IS NULL;
--> statement-breakpoint
-- Add a check constraint to prevent NULL availability_status in the future
-- Use DO block to make it idempotent (skip if constraint already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'drivers' AND constraint_name = 'drivers_availability_status_not_null'
  ) THEN
    ALTER TABLE drivers ADD CONSTRAINT drivers_availability_status_not_null CHECK (availability_status IS NOT NULL);
  END IF;
END $$;
