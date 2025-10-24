/**
 * Bcrypt Password Hashing Migration Script
 *
 * Converts all plaintext passwords in the password column to bcrypt hashes
 *
 * CRITICAL: This script must be run BEFORE deploying the bcrypt authentication changes
 */

import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

interface HashMigrationResult {
  email: string;
  success: boolean;
  wasAlreadyHashed: boolean;
  error?: string;
}

async function hashAllPasswords(): Promise<HashMigrationResult[]> {
  console.log('🔐 Starting bcrypt password hashing migration...\n');

  const results: HashMigrationResult[] = [];

  // Get all active users with passwords
  const allUsers = await db
    .select()
    .from(users)
    .where(eq(users.isActive, true));

  console.log(`Found ${allUsers.length} active users to process\n`);

  for (const user of allUsers) {
    const email = user.email || 'unknown';
    console.log(`\n📧 Processing: ${email}`);

    try {
      const currentPassword = user.password;

      if (!currentPassword) {
        console.log(`  ⚠️  No password found - skipping`);
        results.push({
          email,
          success: true,
          wasAlreadyHashed: false,
        });
        continue;
      }

      // Check if password is already a bcrypt hash
      // Bcrypt hashes start with $2a$, $2b$, or $2y$ and are 60 characters long
      const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(currentPassword) && currentPassword.length === 60;

      if (isBcryptHash) {
        console.log(`  ✓ Password already hashed - skipping`);
        results.push({
          email,
          success: true,
          wasAlreadyHashed: true,
        });
        continue;
      }

      // Hash the plaintext password
      console.log(`  🔒 Hashing plaintext password...`);
      const hashedPassword = await bcrypt.hash(currentPassword, SALT_ROUNDS);

      // Update the user with hashed password
      await db
        .update(users)
        .set({
          password: hashedPassword,
        })
        .where(eq(users.id, user.id));

      console.log(`  ✅ Password hashed successfully`);

      results.push({
        email,
        success: true,
        wasAlreadyHashed: false,
      });

    } catch (error) {
      console.error(`  ❌ Hashing failed:`, error);
      results.push({
        email,
        success: false,
        wasAlreadyHashed: false,
        error: String(error),
      });
    }
  }

  return results;
}

async function generateHashReport(results: HashMigrationResult[]) {
  console.log('\n\n═══════════════════════════════════════════════');
  console.log('📊 BCRYPT HASHING MIGRATION REPORT');
  console.log('═══════════════════════════════════════════════\n');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const newlyHashed = successful.filter(r => !r.wasAlreadyHashed);
  const alreadyHashed = successful.filter(r => r.wasAlreadyHashed);

  console.log(`✅ Successfully processed: ${successful.length}/${results.length}`);
  console.log(`   - Newly hashed: ${newlyHashed.length}`);
  console.log(`   - Already hashed: ${alreadyHashed.length}`);

  if (failed.length > 0) {
    console.log(`\n❌ Failed to hash: ${failed.length}`);
    failed.forEach(r => {
      console.log(`   - ${r.email}: ${r.error}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log('✅ Hashing migration complete!');
  console.log('Next step: Deploy authentication code changes');
  console.log('═══════════════════════════════════════════════\n');
}

// Run migration if called directly
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  hashAllPasswords()
    .then(generateHashReport)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

export { hashAllPasswords, generateHashReport };
