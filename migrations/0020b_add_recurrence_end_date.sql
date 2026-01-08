-- Add recurrence_end_date field to yearly_calendar_items
-- Optional end date for when the recurrence stops
ALTER TABLE yearly_calendar_items
ADD COLUMN IF NOT EXISTS recurrence_end_date DATE;
