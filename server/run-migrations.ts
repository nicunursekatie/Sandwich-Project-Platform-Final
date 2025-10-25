import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './utils/production-safe-logger';

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get database URL from environment
const DATABASE_URL = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  logger.error('ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

async function runAllMigrations() {
  logger.log('🔄 Running database migrations...');

  // Connect to database using Neon HTTP
  const sql = neon(DATABASE_URL);

  try {
    // Create migrations tracking table if it doesn't exist
    await sql(`
      CREATE TABLE IF NOT EXISTS "_migrations" (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Get list of migration files from the migrations directory
    const migrationsDir = path.join(__dirname, '..', 'migrations');

    if (!fs.existsSync(migrationsDir)) {
      logger.error('❌ Migrations directory not found at:', migrationsDir);
      process.exit(1);
    }

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Sort to ensure migrations run in order

    logger.log(`📁 Found ${files.length} migration files`);

    for (const file of files) {
      // Check if migration has already been executed
      const result = await sql`
        SELECT * FROM "_migrations" WHERE name = ${file}
      `;

      if (result.length > 0) {
        logger.log(`⏭️  Skipping ${file} (already executed)`);
        continue;
      }

      // Read and execute the migration
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

      logger.log(`📝 Executing ${file}...`);

      // Split by statement-breakpoint if it exists, otherwise execute as one statement
      const statements = migrationSQL.split('--> statement-breakpoint');

      for (const statement of statements) {
        const trimmed = statement.trim();
        if (trimmed) {
          await sql(trimmed);
        }
      }

      // Mark migration as executed
      await sql`
        INSERT INTO "_migrations" (name) VALUES (${file})
      `;

      logger.log(`✅ ${file} completed`);
    }

    logger.log('✅ All migrations completed successfully!');
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runAllMigrations();
