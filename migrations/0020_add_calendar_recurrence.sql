-- Add recurrence_type field to yearly_calendar_items
-- Supports weekly, monthly, and yearly recurring items
ALTER TABLE yearly_calendar_items
ADD COLUMN IF NOT EXISTS recurrence_type VARCHAR DEFAULT 'none';
