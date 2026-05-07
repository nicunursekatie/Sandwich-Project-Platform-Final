-- Add EIN (Employer Identification Number) field to recipients table
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS ein TEXT;
