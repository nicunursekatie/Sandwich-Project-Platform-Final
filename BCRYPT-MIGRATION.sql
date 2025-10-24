-- ============================================================================
-- BCRYPT PASSWORD HASHING MIGRATION (SAFE VERSION WITH ROLLBACK)
-- ============================================================================
--
-- WARNING: This script will irreversibly hash all plaintext passwords.
-- BACKUP YOUR DATABASE BEFORE RUNNING THIS!
--
-- What this does:
-- 1. Enables pgcrypto extension for bcrypt support
-- 2. Creates a backup column (password_backup) for emergency rollback
-- 3. Updates all users with plaintext passwords to use bcrypt hashes
-- 4. Skips passwords that are already bcrypt hashed
-- 5. Wraps everything in a transaction for safety
--
-- ============================================================================

-- Step 1: Enable pgcrypto extension (required for bcrypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Step 2: Add backup column (for emergency rollback - keep for 30 days)
-- Using timestamped column name to prevent collisions with future migrations
ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_backup_20241023 text;

-- Step 3: Pre-migration audit (INFORMATIONAL - READ ONLY)
-- Run this first to see what will be changed
WITH password_audit AS (
  SELECT
    COUNT(*) FILTER (WHERE password IS NULL) as null_passwords,
    COUNT(*) FILTER (WHERE password ~ '^\$2[aby]\$\d{2}\$') as already_hashed,
    COUNT(*) FILTER (WHERE password IS NOT NULL AND NOT password ~ '^\$2[aby]\$\d{2}\$') as to_be_hashed,
    COUNT(*) as total_users
  FROM users
  WHERE is_active = true
)
SELECT
  total_users,
  null_passwords,
  already_hashed,
  to_be_hashed,
  CASE
    WHEN to_be_hashed > 0 THEN 'READY TO MIGRATE'
    ELSE 'NO MIGRATION NEEDED'
  END as status
FROM password_audit;

-- Step 4: THE ACTUAL MIGRATION (wrapped in transaction)
-- ONLY RUN THIS AFTER REVIEWING THE OUTPUT FROM STEP 3!
BEGIN;

-- Backup existing plaintext passwords first
UPDATE users
SET password_backup_20241023 = password
WHERE
  is_active = true
  AND password IS NOT NULL
  AND NOT (password ~ '^\$2[aby]\$\d{2}\$')
  AND password_backup_20241023 IS NULL;  -- Don't overwrite existing backups

-- Hash the passwords
UPDATE users
SET
  password = crypt(password, gen_salt('bf', 10)),
  updated_at = NOW()  -- Track when migration happened
WHERE
  is_active = true
  AND password IS NOT NULL
  AND NOT (password ~ '^\$2[aby]\$\d{2}\$');

-- Verify no plaintext remains (throws error if migration incomplete)
DO $$
DECLARE
  remaining_plaintext INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_plaintext
  FROM users
  WHERE is_active = true
    AND password IS NOT NULL
    AND NOT (password ~ '^\$2[aby]\$\d{2}\$');

  IF remaining_plaintext > 0 THEN
    RAISE EXCEPTION 'Migration failed: % plaintext passwords remain', remaining_plaintext;
  END IF;

  RAISE NOTICE 'Migration verification successful - all passwords are hashed';
END $$;

COMMIT;

-- Step 5: Post-migration verification (INFORMATIONAL - READ ONLY)
-- Run this after Step 4 to confirm all passwords are now hashed
SELECT
  COUNT(*) as total_active_users,
  COUNT(*) FILTER (WHERE password ~ '^\$2[aby]\$\d{2}\$') as hashed_passwords,
  COUNT(*) FILTER (WHERE password_backup_20241023 IS NOT NULL) as backed_up_passwords,
  COUNT(*) FILTER (WHERE password IS NULL) as no_password
FROM users
WHERE is_active = true;

-- ============================================================================
-- EMERGENCY ROLLBACK (if something goes wrong within 30 days)
-- ============================================================================
-- ONLY USE THIS IF BCRYPT LOGIN IS BROKEN AND YOU NEED TO RESTORE OLD PASSWORDS

-- Restore passwords from backup:
-- UPDATE users
-- SET password = password_backup_20241023
-- WHERE password_backup_20241023 IS NOT NULL;

-- ============================================================================
-- CLEANUP (run after 30 days of successful operation)
-- ============================================================================
-- Remove backup column once you're confident everything works:

-- ALTER TABLE users DROP COLUMN password_backup_20241023;

-- ============================================================================
-- EXECUTION INSTRUCTIONS:
-- ============================================================================
--
-- 1. BACKUP YOUR DATABASE FIRST! (Neon console snapshot)
--
-- 2. Run Step 1 (CREATE EXTENSION)
--
-- 3. Run Step 2 (ALTER TABLE to add backup column)
--
-- 4. Run Step 3 (Pre-migration audit) and review the output
--
-- 5. If everything looks correct, run Step 4 (the full BEGIN...COMMIT block)
--    - This will backup passwords and hash them in a transaction
--    - If anything fails, the transaction will rollback automatically
--
-- 6. Run Step 5 (Post-migration verification) to confirm success
--
-- 7. Deploy updated authentication code that uses bcrypt.compare()
--
-- 8. Test login with real users
--
-- 9. After 30 days of stable operation, run cleanup to remove password_backup_20241023 column
--
-- ============================================================================
