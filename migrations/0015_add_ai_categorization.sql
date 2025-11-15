-- Migration: Add AI categorization columns to event_requests table
-- Created: 2025-11-14
-- Purpose: Support AI-powered event categorization feature

-- Add auto_categories JSONB column to store AI-generated categorization
ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS auto_categories JSONB;

-- Add timestamp for when categorization was performed
ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS categorized_at TIMESTAMP;

-- Add field to track who/what performed categorization ('ai' or user ID)
ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS categorized_by VARCHAR(255);

-- Create index on auto_categories for faster queries
CREATE INDEX IF NOT EXISTS idx_event_requests_auto_categories
ON event_requests USING GIN (auto_categories);

-- Add comment to describe the column structure
COMMENT ON COLUMN event_requests.auto_categories IS 'AI-generated event categorization: {eventType, eventSize, specialNeeds, targetAudience, confidence, reasoning, suggestedTags}';
