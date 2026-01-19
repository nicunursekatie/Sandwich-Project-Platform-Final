-- Migrate additionalTspContacts (JSON array) to additionalContact1/additionalContact2 (structured fields)
-- The legacy field stores a JSON array like: ["userId1", "userId2"]
-- See: docs/event-requests-schema-audit.md

-- Step 1: Migrate first element of JSON array to additionalContact1 (only if empty)
UPDATE event_requests
SET additional_contact_1 = (additional_tsp_contacts::jsonb)->>0
WHERE additional_tsp_contacts IS NOT NULL
  AND additional_tsp_contacts != ''
  AND additional_tsp_contacts != '[]'
  AND (additional_contact_1 IS NULL OR additional_contact_1 = '')
  AND jsonb_array_length(additional_tsp_contacts::jsonb) >= 1;

--> statement-breakpoint

-- Step 2: Migrate second element of JSON array to additionalContact2 (only if empty)
UPDATE event_requests
SET additional_contact_2 = (additional_tsp_contacts::jsonb)->>1
WHERE additional_tsp_contacts IS NOT NULL
  AND additional_tsp_contacts != ''
  AND additional_tsp_contacts != '[]'
  AND (additional_contact_2 IS NULL OR additional_contact_2 = '')
  AND jsonb_array_length(additional_tsp_contacts::jsonb) >= 2;

--> statement-breakpoint

-- Step 3: For records with more than 2 additional contacts, log them for manual review
-- (We only have 2 structured fields, so any extras need attention)
-- This creates a temporary view to identify records needing manual review
-- CREATE VIEW _additional_contacts_overflow AS
-- SELECT
--   id,
--   organization_name,
--   additional_tsp_contacts,
--   jsonb_array_length(additional_tsp_contacts::jsonb) as contact_count,
--   additional_contact_1,
--   additional_contact_2
-- FROM event_requests
-- WHERE additional_tsp_contacts IS NOT NULL
--   AND additional_tsp_contacts != ''
--   AND additional_tsp_contacts != '[]'
--   AND jsonb_array_length(additional_tsp_contacts::jsonb) > 2;

-- NOTE: The legacy column (additional_tsp_contacts) is kept for now for backward compatibility
-- It can be removed in a future migration once all code is updated to use additionalContact1/2
