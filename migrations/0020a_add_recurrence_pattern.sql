-- Add recurrence_pattern field to yearly_calendar_items
-- For weekly: { "dayOfWeek": 0-6 } (0 = Sunday, 6 = Saturday)
-- For monthly: { "dayOfMonth": 1-31 } OR { "weekOfMonth": 1-5, "dayOfWeek": 0-6 }
-- For yearly: { "month": 1-12, "dayOfMonth": 1-31 }
ALTER TABLE yearly_calendar_items
ADD COLUMN IF NOT EXISTS recurrence_pattern JSONB;
