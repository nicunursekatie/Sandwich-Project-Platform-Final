-- Add van_approved column to host_contacts table
ALTER TABLE host_contacts ADD COLUMN IF NOT EXISTS van_approved BOOLEAN DEFAULT FALSE;

-- Add van_approved column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS van_approved BOOLEAN DEFAULT FALSE;
