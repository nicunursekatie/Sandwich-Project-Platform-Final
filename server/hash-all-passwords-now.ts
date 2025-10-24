/**
 * Direct password hashing - extracts plaintext and hashes it
 */
import { db } from './db';
import { users } from '@shared/schema';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

async function hashAllPasswords() {
  console.log('🔐 Starting DIRECT password hash migration...\n');
  
  // Get all users
  const allUsers = await db.select().from(users);
  console.log(`Found ${allUsers.length} total users\n`);
  
  let migrated = 0;
  let alreadyHashed = 0;
  let failed = 0;
  
  for (const user of allUsers) {
    const email = user.email || 'unknown';
    const storedPassword = user.password;
    
    if (!storedPassword) {
      console.log(`⚠️  ${email}: No password - skipping`);
      continue;
    }
    
    // Skip if already bcrypt
    if (storedPassword.startsWith('$2a$') || storedPassword.startsWith('$2b$')) {
      alreadyHashed++;
      console.log(`✅ ${email}: Already bcrypt - skipping`);
      continue;
    }
    
    try {
      let plaintextPassword: string;
      let format: string;
      
      // Try JSON first
      if (storedPassword.startsWith('{')) {
        try {
          const parsed = JSON.parse(storedPassword);
          if (parsed.password) {
            plaintextPassword = parsed.password.trim();
            format = 'JSON';
          } else {
            throw new Error('No password field in JSON');
          }
        } catch {
          // Fallback to treating as plaintext
          plaintextPassword = storedPassword.trim();
          format = 'plaintext';
        }
      } else {
        plaintextPassword = storedPassword.trim();
        format = 'plaintext';
      }
      
      console.log(`🔓 ${email}: Extracting ${format} password: "${plaintextPassword}"`);
      
      // Hash it
      const hashedPassword = await bcrypt.hash(plaintextPassword, SALT_ROUNDS);
      console.log(`   🔒 Hashing...`);
      
      // Update directly
      await db.update(users)
        .set({ password: hashedPassword })
        .where(db.sql`${users.id} = ${user.id}`);
      
      console.log(`   ✅ SUCCESS - Updated to bcrypt hash\n`);
      migrated++;
      
    } catch (error) {
      console.error(`   ❌ FAILED for ${email}:`, error);
      failed++;
    }
  }
  
  console.log('\n═══════════════════════════════════════════════');
  console.log('📊 MIGRATION COMPLETE');
  console.log('═══════════════════════════════════════════════');
  console.log(`✅ Already hashed: ${alreadyHashed}`);
  console.log(`🔐 Migrated to bcrypt: ${migrated}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📦 Total: ${allUsers.length}`);
  console.log('═══════════════════════════════════════════════\n');
}

hashAllPasswords()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Migration failed:', err);
    process.exit(1);
  });
