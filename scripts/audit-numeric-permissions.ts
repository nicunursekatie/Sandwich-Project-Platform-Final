/**
 * Audit Script: Numeric Permissions Security Check
 *
 * This script audits the database for users with numeric (bitmask) permissions,
 * which is a known security vulnerability documented in docs/SECURITY-NUMERIC-PERMISSIONS.md
 *
 * Usage:
 *   npm run audit:permissions
 *
 * Or directly:
 *   tsx scripts/audit-numeric-permissions.ts
 */

import { db } from '../server/db.js';
import * as schema from '../shared/schema.js';
import { eq, sql } from 'drizzle-orm';

interface AuditResult {
  totalUsers: number;
  usersWithNumericPermissions: Array<{
    id: string;
    email: string;
    role: string;
    permissions: any;
  }>;
  usersWithArrayPermissions: number;
  usersWithNullPermissions: number;
}

/**
 * Main audit function
 */
async function auditNumericPermissions(): Promise<AuditResult> {
  console.log('🔍 Starting audit for numeric permissions...\n');

  // Get all users
  const allUsers = await db.select({
    id: schema.users.id,
    email: schema.users.email,
    role: schema.users.role,
    permissions: schema.users.permissions,
  }).from(schema.users);

  const result: AuditResult = {
    totalUsers: allUsers.length,
    usersWithNumericPermissions: [],
    usersWithArrayPermissions: 0,
    usersWithNullPermissions: 0,
  };

  // Analyze each user's permissions
  for (const user of allUsers) {
    const permsType = typeof user.permissions;

    if (permsType === 'number') {
      console.log(`🚨 SECURITY ISSUE: User ${user.email} (${user.id}) has numeric permissions: ${user.permissions}`);
      result.usersWithNumericPermissions.push({
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      });
    } else if (Array.isArray(user.permissions)) {
      result.usersWithArrayPermissions++;
    } else if (user.permissions === null || user.permissions === undefined) {
      result.usersWithNullPermissions++;
    }
  }

  return result;
}

/**
 * Generate migration SQL for users with numeric permissions
 */
function generateMigrationSQL(usersWithNumericPerms: AuditResult['usersWithNumericPermissions']): void {
  if (usersWithNumericPerms.length === 0) {
    return;
  }

  console.log('\n📝 Migration SQL to fix numeric permissions:\n');
  console.log('-- WARNING: Review these SQL statements before executing');
  console.log('-- You may need to determine appropriate permissions for each user\n');

  for (const user of usersWithNumericPerms) {
    console.log(`-- User: ${user.email} (${user.role})`);
    console.log(`UPDATE users`);
    console.log(`SET permissions = '{}'  -- TODO: Set appropriate permissions array`);
    console.log(`WHERE id = '${user.id}';`);
    console.log('');
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const result = await auditNumericPermissions();

    console.log('\n' + '='.repeat(60));
    console.log('AUDIT RESULTS');
    console.log('='.repeat(60));
    console.log(`Total users:                    ${result.totalUsers}`);
    console.log(`Users with array permissions:   ${result.usersWithArrayPermissions} ✅`);
    console.log(`Users with null permissions:    ${result.usersWithNullPermissions} ⚠️`);
    console.log(`Users with numeric permissions: ${result.usersWithNumericPermissions.length} ${result.usersWithNumericPermissions.length > 0 ? '🚨 CRITICAL' : '✅'}`);
    console.log('='.repeat(60));

    if (result.usersWithNumericPermissions.length > 0) {
      console.log('\n⚠️  SECURITY WARNING:');
      console.log('Found users with numeric permissions format!');
      console.log('This is a known security vulnerability.');
      console.log('\nAffected users:');

      for (const user of result.usersWithNumericPermissions) {
        console.log(`  - ${user.email} (${user.role}): permissions = ${user.permissions}`);
      }

      generateMigrationSQL(result.usersWithNumericPermissions);

      console.log('\n📚 For more information, see:');
      console.log('   docs/SECURITY-NUMERIC-PERMISSIONS.md');

      process.exit(1); // Exit with error code to signal security issue
    } else {
      console.log('\n✅ No security issues found!');
      console.log('All users have proper permission format (array or null).');
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Error during audit:', error);
    process.exit(1);
  }
}

main();
