-- Add recurrence pattern fields to yearly_calendar_items
-- Supports weekly, monthly, and yearly recurring items

-- recurrence_type: 'none', 'weekly', 'monthly', 'yearly'
ALTER TABLE yearly_calendar_items
ADD COLUMN IF NOT EXISTS recurrence_type VARCHAR DEFAULT 'none';

-- recurrence_pattern: JSON object containing pattern details
-- For weekly: { "dayOfWeek": 0-6 } (0 = Sunday, 6 = Saturday)
-- For monthly: { "dayOfMonth": 1-31 } OR { "weekOfMonth": 1-5, "dayOfWeek": 0-6 }
-- For yearly: { "month": 1-12, "dayOfMonth": 1-31 }
ALTER TABLE yearly_calendar_items
ADD COLUMN IF NOT EXISTS recurrence_pattern JSONB;

-- recurrence_end_date: Optional end date for when the recurrence stops
ALTER TABLE yearly_calendar_items
ADD COLUMN IF NOT EXISTS recurrence_end_date DATE;

-- Migrate existing isRecurring=true items to recurrence_type='yearly'
UPDATE yearly_calendar_items
SET recurrence_type = 'yearly'
WHERE is_recurring = true AND recurrence_type = 'none';
