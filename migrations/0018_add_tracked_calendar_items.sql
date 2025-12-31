CREATE TABLE IF NOT EXISTS tracked_calendar_items (
  id SERIAL PRIMARY KEY,
  external_id VARCHAR(255) UNIQUE,
  category VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tracked_calendar_category ON tracked_calendar_items(category);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tracked_calendar_dates ON tracked_calendar_items(start_date, end_date);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_tracked_calendar_external_id ON tracked_calendar_items(external_id);
