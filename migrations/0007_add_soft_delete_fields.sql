-- Migration: Add soft delete fields to event_requests and sandwich_collections tables
-- This allows undo functionality by using deletedAt/deletedBy instead of hard deletes

-- Add soft delete columns to event_requests table
ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deleted_by VARCHAR;

-- Add soft delete columns to sandwich_collections table
ALTER TABLE sandwich_collections
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deleted_by TEXT;

-- Add index on deletedAt for efficient filtering
CREATE INDEX IF NOT EXISTS idx_event_requests_deleted_at ON event_requests(deleted_at);
CREATE INDEX IF NOT EXISTS idx_sandwich_collections_deleted_at ON sandwich_collections(deleted_at);
