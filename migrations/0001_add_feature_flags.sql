-- Migration: Add feature_flags table for gradual feature rollout
-- Phase 0 of Unified Task + Communication System
-- Generated: 2025-10-26
-- Safe to run: Yes (additive only, no destructive changes)

-- Create feature_flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  id SERIAL PRIMARY KEY,
  flag_name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  enabled_for_users JSONB DEFAULT '[]'::jsonb,
  enabled_for_roles JSONB DEFAULT '[]'::jsonb,
  enabled_percentage INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by VARCHAR,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);
CREATE INDEX IF NOT EXISTS idx_feature_flags_flag_name ON feature_flags(flag_name);

-- Insert default feature flags for unified activities migration
INSERT INTO feature_flags (flag_name, description, enabled)
VALUES
  ('unified-activities-schema', 'Phase 1: Activities table schema is created', false),
  ('unified-activities-read', 'Phase 2: Read operations from activities table', false),
  ('unified-activities-write', 'Phase 3: Write operations to activities table', false),
  ('unified-activities-migration', 'Phase 4: Historical data migration running', false),
  ('unified-activities-ui', 'Phase 5-6: Frontend thread UI components', false),
  ('unified-activities', 'Phase 7: Master toggle for complete unified system', false)
ON CONFLICT (flag_name) DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Feature flags table created successfully';
  RAISE NOTICE '✅ Phase 0 complete: Feature flag infrastructure is ready';
  RAISE NOTICE 'Next step: Apply with npm run db:push or manually run this SQL';
END $$;
