import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import * as schema from '../shared/schema';

async function setupProductionSchema() {
  console.log('🔧 Setting up production database schema...\n');

  // Safety check: Ensure PRODUCTION_DATABASE_URL is set and different from dev
  if (!process.env.PRODUCTION_DATABASE_URL) {
    throw new Error('PRODUCTION_DATABASE_URL must be set');
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set');
  }

  if (process.env.PRODUCTION_DATABASE_URL === process.env.DATABASE_URL) {
    throw new Error('⚠️  PRODUCTION_DATABASE_URL and DATABASE_URL are the same! Migration aborted for safety.');
  }

  console.log('✅ Safety check passed: Production and development databases are different\n');

  try {
    // Connect to production database
    const prodSql = neon(process.env.PRODUCTION_DATABASE_URL);
    const prodDb = drizzle(prodSql, { schema });

    console.log('📋 Applying migrations to production database...');
    
    // Apply all migrations from the migrations folder
    await migrate(prodDb, { migrationsFolder: './migrations' });
    
    console.log('✅ Production schema created successfully!');
    console.log('🎉 All tables are now ready in production database\n');
    
  } catch (error) {
    console.error('❌ Schema setup failed:', error);
    throw error;
  }
}

setupProductionSchema()
  .then(() => {
    console.log('✨ Production database is ready for data migration');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
