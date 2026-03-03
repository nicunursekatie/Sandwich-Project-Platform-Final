-- Migration 0043: Cast users notification/boolean columns to BOOLEAN
-- Drops text defaults first (required by PostgreSQL), then casts, then restores boolean defaults.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'sms_alerts_enabled' AND data_type != 'boolean') THEN
    ALTER TABLE users ALTER COLUMN sms_alerts_enabled DROP DEFAULT;
    ALTER TABLE users ALTER COLUMN sms_alerts_enabled TYPE boolean
      USING (LOWER(TRIM(COALESCE(sms_alerts_enabled::text, ''))) IN ('true', '1', 'yes'));
    ALTER TABLE users ALTER COLUMN sms_alerts_enabled SET DEFAULT false;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_notifications_enabled' AND data_type != 'boolean') THEN
    ALTER TABLE users ALTER COLUMN email_notifications_enabled DROP DEFAULT;
    ALTER TABLE users ALTER COLUMN email_notifications_enabled TYPE boolean
      USING (LOWER(TRIM(COALESCE(email_notifications_enabled::text, ''))) IN ('true', '1', 'yes'));
    ALTER TABLE users ALTER COLUMN email_notifications_enabled SET DEFAULT true;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'notify_on_new_intake' AND data_type != 'boolean') THEN
    ALTER TABLE users ALTER COLUMN notify_on_new_intake DROP DEFAULT;
    ALTER TABLE users ALTER COLUMN notify_on_new_intake TYPE boolean
      USING (LOWER(TRIM(COALESCE(notify_on_new_intake::text, ''))) IN ('true', '1', 'yes'));
    ALTER TABLE users ALTER COLUMN notify_on_new_intake SET DEFAULT true;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'notify_on_task_due' AND data_type != 'boolean') THEN
    ALTER TABLE users ALTER COLUMN notify_on_task_due DROP DEFAULT;
    ALTER TABLE users ALTER COLUMN notify_on_task_due TYPE boolean
      USING (LOWER(TRIM(COALESCE(notify_on_task_due::text, ''))) IN ('true', '1', 'yes'));
    ALTER TABLE users ALTER COLUMN notify_on_task_due SET DEFAULT true;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'notify_on_status_change' AND data_type != 'boolean') THEN
    ALTER TABLE users ALTER COLUMN notify_on_status_change DROP DEFAULT;
    ALTER TABLE users ALTER COLUMN notify_on_status_change TYPE boolean
      USING (LOWER(TRIM(COALESCE(notify_on_status_change::text, ''))) IN ('true', '1', 'yes'));
    ALTER TABLE users ALTER COLUMN notify_on_status_change SET DEFAULT false;
  END IF;
END $$;
