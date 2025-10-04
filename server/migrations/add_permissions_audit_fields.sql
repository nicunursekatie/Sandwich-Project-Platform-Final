ALTER TABLE users
  ADD COLUMN IF NOT EXISTS permissions_modified_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS permissions_modified_by VARCHAR;
