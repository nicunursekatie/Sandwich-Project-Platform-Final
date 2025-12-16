-- Add flag to mark events that use a DHL-provided van/driver
ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS is_dhl_van BOOLEAN NOT NULL DEFAULT FALSE;
