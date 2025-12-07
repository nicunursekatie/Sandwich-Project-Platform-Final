-- Migration: Add partner_organizations column to event_requests
-- This is a focused migration for just the partner_organizations field
-- Run this if 0009 fails due to existing tables/columns

ALTER TABLE "event_requests" ADD COLUMN IF NOT EXISTS "partner_organizations" jsonb;
