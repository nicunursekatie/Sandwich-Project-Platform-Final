-- Migration 0043: Cast users notification/boolean columns to BOOLEAN
-- Run this before drizzle-kit push if you get "cannot be cast automatically to type boolean".
-- The DB may have these as varchar/text; PostgreSQL needs USING to convert.

-- Helper: cast varchar/text to boolean (handles 'true'/'false', '1'/'0', null, empty)
-- We use a single expression that works for existing data.

DO $$
BEGIN
  -- sms_alerts_enabled
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'sms_alerts_enabled') THEN
    ALTER TABLE users
      ALTER COLUMN sms_alerts_enabled TYPE boolean
      USING (LOWER(TRIM(COALESCE(sms_alerts_enabled::text, ''))) IN ('true', '1', 'yes'));
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_notifications_enabled') THEN
    ALTER TABLE users
      ALTER COLUMN email_notifications_enabled TYPE boolean
      USING (LOWER(TRIM(COALESCE(email_notifications_enabled::text, ''))) IN ('true', '1', 'yes'));
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'notify_on_new_intake') THEN
    ALTER TABLE users
      ALTER COLUMN notify_on_new_intake TYPE boolean
      USING (LOWER(TRIM(COALESCE(notify_on_new_intake::text, ''))) IN ('true', '1', 'yes'));
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'notify_on_task_due') THEN
    ALTER TABLE users
      ALTER COLUMN notify_on_task_due TYPE boolean
      USING (LOWER(TRIM(COALESCE(notify_on_task_due::text, ''))) IN ('true', '1', 'yes'));
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'notify_on_status_change') THEN
    ALTER TABLE users
      ALTER COLUMN notify_on_status_change TYPE boolean
      USING (LOWER(TRIM(COALESCE(notify_on_status_change::text, ''))) IN ('true', '1', 'yes'));
  END IF;
END $$;
