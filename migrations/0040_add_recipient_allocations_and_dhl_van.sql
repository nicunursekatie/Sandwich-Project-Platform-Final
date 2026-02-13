-- Migration: Add missing columns to event_requests table
-- These columns exist in the Drizzle schema (shared/schema.ts) but were never migrated
-- recipient_allocations: JSONB storing per-recipient sandwich allocations
-- is_dhl_van: Boolean flag when DHL is providing the van/driver

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS recipient_allocations JSONB;

ALTER TABLE event_requests
ADD COLUMN IF NOT EXISTS is_dhl_van BOOLEAN NOT NULL DEFAULT false;
