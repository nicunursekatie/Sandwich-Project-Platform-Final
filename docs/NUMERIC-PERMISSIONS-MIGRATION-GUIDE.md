# Numeric Permissions Migration Guide

## Overview

This guide explains how to safely migrate users with numeric (bitmask) permissions to the modern string array format, eliminating a critical security vulnerability.

## Current Status

**Good News:** The `database.db` file in this environment is empty (0 bytes), which means:
- This is likely a development or fresh environment
- No actual users have numeric permissions in this database
- Migration steps are provided for when you run this in production

## Background

See `docs/SECURITY-NUMERIC-PERMISSIONS.md` for full security details.

**The Problem:**
- Users with `permissions` field as `number` bypass all permission checks
- They get unconditional access to ALL resources
- This is a CRITICAL security vulnerability

**The Solution:**
- Migrate all users to `string[]` permission format
- Remove numeric permission support from codebase
- Add database constraints to prevent future numeric permissions

---

## Migration Steps

### Step 1: Audit Current Database

First, identify if you have any users with numeric permissions:

```bash
# Option A: Use the audit script (requires dependencies installed)
npm install
npx tsx scripts/audit-numeric-permissions.ts

# Option B: Direct SQL query (if sqlite3 CLI available)
sqlite3 /path/to/production/database.db <<SQL
SELECT
  id,
  email,
  role,
  permissions,
  typeof(permissions) as perm_type
FROM users
WHERE typeof(permissions) = 'integer';
SQL
```

**Expected Output:**
- If empty: ✅ No migration needed for this database
- If results: 🚨 Continue with migration steps below

### Step 2: Understand Permission Mapping

Numeric permissions use bitmasks. You need to map the numeric value to permission strings.

**Permission String Examples:**
```typescript
[
  'ADMIN_ACCESS',
  'USERS_VIEW',
  'USERS_EDIT',
  'HOSTS_VIEW',
  'COLLECTIONS_VIEW',
  'NAV_DASHBOARD',
  // ... etc
]
```

**If you have numeric permissions:**
1. Identify which bits were set in the original bitmask system
2. Map those bits to the corresponding permission strings
3. Contact the original developer for the bitmask mapping

**Most Common Scenario:**
- Users with numeric permissions are legacy admin accounts
- Safe approach: Give them all admin permissions

### Step 3: Create Backup

**CRITICAL: Always backup before migration!**

```bash
# Backup production database
cp database.db database.db.backup.$(date +%Y%m%d_%H%M%S)

# Verify backup
ls -lh database.db*
```

### Step 4: Run Migration Script

Create and run the migration script:

```bash
# Create migration script
cat > scripts/migrate-numeric-permissions.ts << 'EOF'
import { initializeStorage } from '../server/storage.js';

// Define default permissions for legacy users
const DEFAULT_ADMIN_PERMISSIONS = [
  'ADMIN_ACCESS',
  'NAV_DASHBOARD',
  'NAV_USER_MANAGEMENT',
  'USERS_VIEW',
  'USERS_EDIT',
  'USERS_ADD',
  'USERS_DELETE',
  'HOSTS_VIEW',
  'HOSTS_EDIT',
  'RECIPIENTS_VIEW',
  'RECIPIENTS_EDIT',
  'DRIVERS_VIEW',
  'VOLUNTEERS_VIEW',
  'COLLECTIONS_VIEW',
  'MESSAGES_VIEW',
  'MESSAGES_SEND',
  'EVENT_REQUESTS_VIEW',
  'EVENT_REQUESTS_EDIT',
  'PROJECTS_VIEW',
  'PROJECTS_EDIT_ALL',
  'DOCUMENTS_VIEW',
  'DOCUMENTS_MANAGE',
];

async function migrateNumericPermissions() {
  const storage = await initializeStorage();

  // Get all users
  const users = await storage.getAllUsers();

  let migratedCount = 0;

  for (const user of users) {
    if (typeof user.permissions === 'number') {
      console.log(`Migrating user: ${user.email} (ID: ${user.id})`);
      console.log(`  Old permissions (numeric): ${user.permissions}`);

      // Assign appropriate permissions based on role
      let newPermissions: string[] = [];

      if (user.role === 'super_admin' || user.role === 'admin') {
        newPermissions = DEFAULT_ADMIN_PERMISSIONS;
      } else {
        // For other roles, assign basic permissions
        newPermissions = ['NAV_DASHBOARD', 'VOLUNTEERS_VIEW'];
      }

      // Update user
      await storage.updateUser(user.id, {
        permissions: newPermissions
      });

      console.log(`  New permissions (array): [${newPermissions.length} permissions]`);
      migratedCount++;
    }
  }

  console.log(`\n✅ Migration complete! Migrated ${migratedCount} users.`);
}

migrateNumericPermissions().catch(console.error);
EOF

# Run migration (after installing dependencies)
npm install
npx tsx scripts/migrate-numeric-permissions.ts
```

### Step 5: Verify Migration

After migration, verify all users have proper permissions:

```bash
# Check that no numeric permissions remain
sqlite3 database.db <<SQL
SELECT COUNT(*) as numeric_count
FROM users
WHERE typeof(permissions) = 'integer';
-- Should return 0

SELECT COUNT(*) as array_count
FROM users
WHERE typeof(permissions) = 'text';
-- Should return total user count (or close to it)
SQL
```

### Step 6: Remove Numeric Permission Support

Now that all users are migrated, remove the dangerous code:

#### A. Update `shared/auth-utils.ts`

Remove or replace the numeric permission handling:

```typescript
// REMOVE THIS:
if (typeof user.permissions === 'number') {
  console.warn(`⚠️ SECURITY: User has numeric permissions`);
  return true;
}

// REPLACE WITH:
if (typeof user.permissions === 'number') {
  console.error(`🚨 CRITICAL: Numeric permissions no longer supported!`);
  console.error(`User ${user.id} must be migrated to string[] format`);
  return false; // Deny access
}
```

#### B. Update Type Definitions in `shared/types.ts`

```typescript
// BEFORE:
permissions: string[] | number | null | undefined

// AFTER:
permissions: string[] | null | undefined
```

#### C. Remove TODOs

Delete the TODO comments at:
- `shared/auth-utils.ts:658`
- `shared/auth-utils.ts:705`

Replace with:
```typescript
// ✅ MIGRATION COMPLETE: All users migrated to string[] format (YYYY-MM-DD)
```

### Step 7: Add Database Constraint (Optional)

Prevent future numeric permissions at the database level:

```sql
-- SQLite doesn't support CHECK constraints on existing columns easily
-- Instead, add validation in the application layer

-- In server/storage.ts, add validation:
async updateUser(id: string, updates: Partial<UpsertUser>) {
  if (updates.permissions && typeof updates.permissions === 'number') {
    throw new Error('Numeric permissions are not allowed. Use string[] format.');
  }
  // ... rest of update logic
}
```

### Step 8: Deploy and Monitor

After deploying the changes:

1. **Monitor logs** for any security warnings
2. **Check for errors** related to permission checks
3. **Verify** that no users are locked out
4. **Test** that admin users still have appropriate access

```bash
# Monitor logs for permission issues
tail -f /var/log/app.log | grep -i permission
```

---

## Testing Checklist

Before deploying to production:

- [ ] Backup created and verified
- [ ] Audit script run successfully
- [ ] Migration script tested on copy of production data
- [ ] All users have appropriate permissions
- [ ] No numeric permissions remain in database
- [ ] Type definitions updated
- [ ] Security vulnerability tests pass
- [ ] Admin users can still access admin panel
- [ ] Regular users have appropriate restricted access

---

## Rollback Plan

If something goes wrong:

```bash
# 1. Stop the application
systemctl stop your-app

# 2. Restore from backup
cp database.db database.db.failed
cp database.db.backup.TIMESTAMP database.db

# 3. Revert code changes
git revert <commit-hash>

# 4. Restart application
systemctl start your-app
```

---

## For Production Environments

**When running in production:**

1. **Schedule maintenance window**
2. **Notify all users** of brief downtime
3. **Run audit first** to understand scope
4. **Test migration on database copy**
5. **Execute during low-traffic period**
6. **Keep backup accessible for 30 days**
7. **Monitor closely for 24-48 hours**

---

## Summary for Current Codebase

Since your `database.db` is empty (development environment):

1. ✅ **No immediate action needed** - no users to migrate
2. ⚠️ **Do before production:** Remove numeric permission support from code
3. 🔒 **Add validation** to prevent numeric permissions in `updateUser()` and `createUser()`
4. 📝 **Update type definitions** to only allow `string[]`

The migration guide above is provided for when you deploy to production or import production data.

---

## Questions?

- Review `docs/SECURITY-NUMERIC-PERMISSIONS.md` for security details
- Check `shared/permission-config.ts` for all available permissions
- See `shared/auth-utils.ts` for current permission checking logic

**Need help?** Contact the development team or open an issue in the repository.
