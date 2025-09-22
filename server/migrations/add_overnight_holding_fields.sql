-- Migration: Add overnight holding location fields to event_requests table
-- This migration adds support for two-part destinations where sandwiches can be
-- stored overnight before final delivery

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS overnight_holding_location TEXT,
ADD COLUMN IF NOT EXISTS overnight_pickup_time TIME;

-- Add comments to explain the fields
COMMENT ON COLUMN event_requests.overnight_holding_location IS 'Location where sandwiches will be stored overnight before final delivery';
COMMENT ON COLUMN event_requests.overnight_pickup_time IS 'Time to pick up sandwiches from overnight location for final delivery';
COMMENT ON COLUMN event_requests.delivery_destination IS 'Final destination where sandwiches will be delivered (organization/host location)';