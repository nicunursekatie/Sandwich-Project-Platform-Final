-- Add alternate_for_contact_id to host_contacts table
-- Tracks which host contact this alternate is standing in for
ALTER TABLE host_contacts ADD COLUMN IF NOT EXISTS alternate_for_contact_id INTEGER;
