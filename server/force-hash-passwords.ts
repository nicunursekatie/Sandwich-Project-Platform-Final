/**
 * Force hash passwords - bypasses any caching
 */
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

async function forceHashPasswords() {
  // Direct PostgreSQL connection - no ORM
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    console.log('🔐 FORCE HASH - Direct PostgreSQL connection\n');
    
    // Get all users with JSON/plaintext passwords
    const result = await pool.query(`
      SELECT id, email, password 
      FROM users 
      WHERE password NOT LIKE '$2%'
      ORDER BY email
    `);
    
    console.log(`Found ${result.rows.length} users needing migration\n`);
    
    for (const row of result.rows) {
      const { id, email, password } = row;
      
      let plaintextPassword: string;
      let format: string;
      
      // Extract plaintext
      if (password.startsWith('{')) {
        try {
          const parsed = JSON.parse(password);
          plaintextPassword = parsed.password?.trim() || password.trim();
          format = 'JSON';
        } catch {
          plaintextPassword = password.trim();
          format = 'plaintext';
        }
      } else {
        plaintextPassword = password.trim();
        format = 'plaintext';
      }
      
      console.log(`🔓 ${email}: ${format} = "${plaintextPassword}"`);
      
      // Hash it
      const hashedPassword = await bcrypt.hash(plaintextPassword, SALT_ROUNDS);
      console.log(`   🔒 Hashing to: ${hashedPassword.substring(0, 29)}...`);
      
      // Direct update
      await pool.query(
        'UPDATE users SET password = $1 WHERE id = $2',
        [hashedPassword, id]
      );
      
      console.log(`   ✅ Updated\n`);
    }
    
    console.log('\n═══════════════════════════════════════════════');
    console.log(`✅ Successfully migrated ${result.rows.length} passwords`);
    console.log('═══════════════════════════════════════════════\n');
    
  } finally {
    await pool.end();
  }
}

forceHashPasswords()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Failed:', err);
    process.exit(1);
  });
