-- Add performance indexes for event_requests table
-- These indexes improve query performance for sorting and filtering

-- Index on created_at for sorting by newest/oldest
CREATE INDEX IF NOT EXISTS idx_event_requests_created_at ON event_requests(created_at DESC);

-- Index on scheduled_event_date for calendar and date-based queries
CREATE INDEX IF NOT EXISTS idx_event_requests_scheduled_date ON event_requests(scheduled_event_date);

-- Composite index on status and created_at for filtering and sorting together
CREATE INDEX IF NOT EXISTS idx_event_requests_status_created_at ON event_requests(status, created_at DESC);

-- Composite index on status and scheduled_event_date for scheduled events queries
CREATE INDEX IF NOT EXISTS idx_event_requests_status_scheduled_date ON event_requests(status, scheduled_event_date);
