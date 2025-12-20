-- Migration: Add next_action and next_action_updated_at columns to event_requests table
-- This migration is idempotent - it will not fail if columns already exist

-- Add next_action column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'event_requests' 
        AND column_name = 'next_action'
    ) THEN
        ALTER TABLE event_requests 
        ADD COLUMN next_action TEXT;
        
        RAISE NOTICE 'Added next_action column to event_requests table';
    ELSE
        RAISE NOTICE 'Column next_action already exists in event_requests table';
    END IF;
END $$;

-- Add next_action_updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'event_requests' 
        AND column_name = 'next_action_updated_at'
    ) THEN
        ALTER TABLE event_requests 
        ADD COLUMN next_action_updated_at TIMESTAMP;
        
        RAISE NOTICE 'Added next_action_updated_at column to event_requests table';
    ELSE
        RAISE NOTICE 'Column next_action_updated_at already exists in event_requests table';
    END IF;
END $$;
