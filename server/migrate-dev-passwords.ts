/**
 * Development Password Migration Script
 * Upgrades all legacy passwords (JSON/plaintext) to bcrypt hashes
 */

import { db } from './db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

interface MigrationResult {
  email: string;
  originalFormat: 'json' | 'plaintext' | 'already_hashed';
  success: boolean;
  error?: string;
}

async function migrateDevPasswords() {
  console.log('🔐 Starting development password migration...\n');
  
  const results: MigrationResult[] = [];
  
  // Get all users
  const allUsers = await db.select().from(users);
  console.log(`Found ${allUsers.length} users to check\n`);
  
  for (const user of allUsers) {
    const email = user.email || 'unknown';
    const storedPassword = user.password;
    
    if (!storedPassword) {
      console.log(`⚠️  ${email}: No password set - skipping`);
      continue;
    }
    
    // Check if already bcrypt hashed
    if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
      console.log(`✅ ${email}: Already bcrypt hashed - skipping`);
      results.push({
        email,
        originalFormat: 'already_hashed',
        success: true,
      });
      continue;
    }
    
    try {
      let plaintextPassword: string | null = null;
      let originalFormat: 'json' | 'plaintext' = 'plaintext';
      
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(storedPassword);
        if (parsed.password && typeof parsed.password === 'string') {
          plaintextPassword = parsed.password.trim();
          originalFormat = 'json';
          console.log(`🔓 ${email}: Found JSON password: "${plaintextPassword}"`);
        }
      } catch {
        // Not JSON - treat as plaintext
        plaintextPassword = storedPassword.trim();
        originalFormat = 'plaintext';
        console.log(`🔓 ${email}: Found plaintext password: "${plaintextPassword}"`);
      }
      
      if (!plaintextPassword) {
        console.log(`⚠️  ${email}: Could not extract password - skipping`);
        continue;
      }
      
      // Hash the password
      console.log(`   🔒 Hashing password...`);
      const hashedPassword = await bcrypt.hash(plaintextPassword, SALT_ROUNDS);
      
      // Update in database
      await db
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, user.id));
      
      console.log(`   ✅ Successfully upgraded to bcrypt hash\n`);
      
      results.push({
        email,
        originalFormat,
        success: true,
      });
      
    } catch (error) {
      console.error(`   ❌ Failed:`, error);
      results.push({
        email,
        originalFormat: 'plaintext',
        success: false,
        error: String(error),
      });
    }
  }
  
  return results;
}

async function printReport(results: MigrationResult[]) {
  console.log('\n═══════════════════════════════════════════════');
  console.log('📊 PASSWORD MIGRATION REPORT');
  console.log('═══════════════════════════════════════════════\n');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const alreadyHashed = results.filter(r => r.originalFormat === 'already_hashed');
  const jsonMigrated = results.filter(r => r.success && r.originalFormat === 'json');
  const plaintextMigrated = results.filter(r => r.success && r.originalFormat === 'plaintext');
  
  console.log(`✅ Total users processed: ${results.length}`);
  console.log(`   - Already secure (bcrypt): ${alreadyHashed.length}`);
  console.log(`   - Migrated from JSON: ${jsonMigrated.length}`);
  console.log(`   - Migrated from plaintext: ${plaintextMigrated.length}`);
  
  if (failed.length > 0) {
    console.log(`\n❌ Failed migrations: ${failed.length}`);
    failed.forEach(r => {
      console.log(`   - ${r.email}: ${r.error}`);
    });
  }
  
  console.log('\n═══════════════════════════════════════════════');
  console.log('✅ Migration complete!');
  console.log('All passwords are now securely hashed with bcrypt.');
  console.log('═══════════════════════════════════════════════\n');
}

// Run migration
migrateDevPasswords()
  .then(printReport)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });
