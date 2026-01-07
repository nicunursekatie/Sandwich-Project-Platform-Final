-- Migrate existing isRecurring=true items to recurrence_type='yearly'
UPDATE yearly_calendar_items
SET recurrence_type = 'yearly'
WHERE is_recurring = true AND recurrence_type = 'none';
