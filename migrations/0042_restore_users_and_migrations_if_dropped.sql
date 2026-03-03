-- Migration 0042: Restore users columns and _migrations table if they were dropped by db:push
-- Run this ONLY if a previous drizzle-kit push removed these (schema was fixed so future push won't drop them).
-- Safe to run multiple times: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.

-- ============================================================================
-- 1. Ensure _migrations table exists (used by run-migrations.ts and migrate.ts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "_migrations" (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  executed_at TIMESTAMP DEFAULT NOW()
);
--> statement-breakpoint
-- ============================================================================
-- 2. Restore users columns if missing (do not fail if already present)
-- ============================================================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status VARCHAR;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by VARCHAR;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_user_id VARCHAR;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_alerts_enabled BOOLEAN;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_on_new_intake BOOLEAN;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_on_task_due BOOLEAN;
--> statement-breakpoint
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_on_status_change BOOLEAN;
