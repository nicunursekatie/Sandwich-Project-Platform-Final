-- Add event instructions columns to event_requests table
-- These fields store special instructions for drivers, volunteers, and speakers
-- that will be included in automated text and email alerts

ALTER TABLE event_requests 
ADD COLUMN IF NOT EXISTS driver_instructions TEXT;

--> statement-breakpoint

ALTER TABLE event_requests 
ADD COLUMN IF NOT EXISTS volunteer_instructions TEXT;

--> statement-breakpoint

ALTER TABLE event_requests 
ADD COLUMN IF NOT EXISTS speaker_instructions TEXT;

--> statement-breakpoint

ALTER TABLE event_requests 
ADD COLUMN IF NOT EXISTS instructions_last_updated_at TIMESTAMP;

--> statement-breakpoint

ALTER TABLE event_requests 
ADD COLUMN IF NOT EXISTS instructions_last_updated_by VARCHAR(255);
