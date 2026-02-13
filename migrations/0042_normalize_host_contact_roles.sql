-- Migration 0042: Normalize host_contacts.role values
-- Cleans up legacy freeform role values to standardized lowercase values:
--   lead, host, primary, alternate, volunteer
-- This matches the CONTACT_ROLES constant in hosts-management-consolidated.tsx

-- Map all host-like variants to 'host'
UPDATE host_contacts SET role = 'host' WHERE lower(trim(role)) LIKE '%host%' AND lower(trim(role)) NOT IN ('host');

-- Map 'Primary Contact' to 'primary'
UPDATE host_contacts SET role = 'primary' WHERE lower(trim(role)) IN ('primary contact', 'primary');
-- Fix: 'primary' is already correct, but 'Primary Contact' and 'Primary' need normalization
UPDATE host_contacts SET role = 'primary' WHERE role != 'primary' AND lower(trim(role)) = 'primary';

-- Map 'Alternate Contact' to 'alternate'
UPDATE host_contacts SET role = 'alternate' WHERE lower(trim(role)) IN ('alternate contact', 'alternate') AND role NOT IN ('alternate');

-- Map 'Lead' to 'lead'
UPDATE host_contacts SET role = 'lead' WHERE lower(trim(role)) = 'lead' AND role != 'lead';

-- Map 'Volunteer' to 'volunteer'
UPDATE host_contacts SET role = 'volunteer' WHERE lower(trim(role)) = 'volunteer' AND role != 'volunteer';

-- Catch-all: anything remaining that doesn't match a known role becomes 'host'
-- (these are contacts on host locations, so host is the safest default)
UPDATE host_contacts SET role = 'host' WHERE role NOT IN ('lead', 'host', 'primary', 'alternate', 'volunteer');
