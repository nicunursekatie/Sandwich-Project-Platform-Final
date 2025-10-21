-- Migration: Add weekly driver field to drivers table
-- Created: 2025-01-21

-- Add is_weekly_driver column to drivers table
ALTER TABLE drivers
ADD COLUMN IF NOT EXISTS is_weekly_driver BOOLEAN NOT NULL DEFAULT false;

-- Add comment to explain the field
COMMENT ON COLUMN drivers.is_weekly_driver IS 'Indicates if this driver is a recurring weekly driver';
