-- Migration: Add sandwich range fields to event_requests table
-- This migration adds support for specifying sandwich count ranges (e.g., 500-700 deli sandwiches)
-- when the exact count isn't confirmed yet

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS estimated_sandwich_count_min INTEGER,
ADD COLUMN IF NOT EXISTS estimated_sandwich_count_max INTEGER,
ADD COLUMN IF NOT EXISTS estimated_sandwich_range_type VARCHAR(50);

-- Add comments to explain the fields
COMMENT ON COLUMN event_requests.estimated_sandwich_count_min IS 'Minimum sandwiches in range (optional, used when exact count not confirmed)';
COMMENT ON COLUMN event_requests.estimated_sandwich_count_max IS 'Maximum sandwiches in range (optional, used when exact count not confirmed)';
COMMENT ON COLUMN event_requests.estimated_sandwich_range_type IS 'Type of sandwich for range (optional, e.g., turkey, ham, deli, pbj)';
