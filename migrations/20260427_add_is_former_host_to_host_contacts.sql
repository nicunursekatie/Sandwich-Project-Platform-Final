-- Migration: Add is_former_host flag to host_contacts
-- Date: 2026-04-27
-- Description:
--   Adds a soft-deactivation flag to mark hosts who've left the organization.
--   This is intentionally separate from:
--     * hosts.status              -- location-level (collection log dropdown)
--     * host_contacts.weeklyActive -- weekly rotation for the external host finder
--   This new column is purely about "is this person still part of TSP?".
--
--   Default false so existing data stays in the active set. UI labels it
--   "Former Host" rather than "inactive" to avoid colliding with the other
--   two notions of active/inactive in the system.
--
-- Safe to run on existing database -- IF NOT EXISTS check via DO block.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'host_contacts'
      AND column_name = 'is_former_host'
  ) THEN
    ALTER TABLE host_contacts
      ADD COLUMN is_former_host BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE 'Added host_contacts.is_former_host';
  ELSE
    RAISE NOTICE 'host_contacts.is_former_host already exists -- skipping';
  END IF;
END $$;

-- Verification: count of former vs active
SELECT
  COUNT(*) FILTER (WHERE is_former_host = false) AS active_hosts,
  COUNT(*) FILTER (WHERE is_former_host = true)  AS former_hosts,
  COUNT(*)                                       AS total
FROM host_contacts;
