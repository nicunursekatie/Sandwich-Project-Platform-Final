import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get database URL from environment
const DATABASE_URL = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

async function runMigration() {
  console.log('🔄 Running sandwich range fields migration...');

  // Connect to database using Neon HTTP
  const sql = neon(DATABASE_URL);

  try {
    // Read the migration SQL
    const migrationPath = path.join(__dirname, 'migrations', 'add_sandwich_range_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📝 Executing SQL:\n', migrationSQL);

    // Execute the migration
    await sql(migrationSQL);

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
