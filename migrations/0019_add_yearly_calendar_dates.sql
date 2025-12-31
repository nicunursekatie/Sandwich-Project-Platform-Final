-- Add optional date fields to yearly_calendar_items for calendar grid display
ALTER TABLE "yearly_calendar_items" ADD COLUMN IF NOT EXISTS "start_date" date;
ALTER TABLE "yearly_calendar_items" ADD COLUMN IF NOT EXISTS "end_date" date;

-- Add index for date range queries
CREATE INDEX IF NOT EXISTS "idx_yearly_calendar_dates" ON "yearly_calendar_items" ("start_date", "end_date");
