-- Add optional start_date field to yearly_calendar_items for calendar grid display
ALTER TABLE "yearly_calendar_items" ADD COLUMN IF NOT EXISTS "start_date" date;
