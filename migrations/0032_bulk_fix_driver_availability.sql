-- Migration: Bulk Fix Driver Availability Status
-- Date: 2026-01-25
-- Description: Reset all drivers to 'available' EXCEPT those with explicit unavailability notes AND check-in dates
--
-- Problem: Most drivers are incorrectly marked as unavailable when they should be available.
-- Only drivers with BOTH an unavailable_note AND a check_in_date (or unavailable_until) 
-- should be marked as temporarily unavailable.

-- Step 1: First, let's reset ALL active drivers to 'available'
-- and clear their unavailability flags
UPDATE drivers
SET 
    availability_status = 'available',
    temporarily_unavailable = false,
    unavailable_start_date = NULL,
    unavailable_reason = NULL
WHERE is_active = true;

-- Step 2: Now mark drivers who SHOULD be unavailable back to unavailable
-- These are drivers who have BOTH:
-- - An unavailable_note (explanation of why they're unavailable)
-- - AND either a check_in_date OR unavailable_until (when to follow up)
UPDATE drivers
SET 
    availability_status = 'pending_checkin',
    temporarily_unavailable = true
WHERE is_active = true
  AND unavailable_note IS NOT NULL 
  AND unavailable_note != ''
  AND (
    check_in_date IS NOT NULL 
    OR unavailable_until IS NOT NULL
  );

-- Step 3: Make sure inactive drivers are marked as 'inactive'
UPDATE drivers
SET availability_status = 'inactive'
WHERE is_active = false;

-- Log summary (these comments help understand what happened)
-- After this migration:
-- - All active drivers WITHOUT notes+dates = 'available'
-- - Active drivers WITH notes AND check-in/until dates = 'pending_checkin' (temporarily unavailable)
-- - Inactive drivers = 'inactive'
