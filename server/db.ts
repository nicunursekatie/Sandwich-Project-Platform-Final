import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@shared/schema';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { logger } from './utils/production-safe-logger';

// Use production database when PRODUCTION_DATABASE_URL is set (deployed app)
// Otherwise use development database (workspace)
const databaseUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required. Please set either PRODUCTION_DATABASE_URL or DATABASE_URL.');
}

// Fix TypeScript union type issue by using a single concrete type
// This prevents "expression is not callable" errors when using db.select/insert/update/delete
type DB = NeonHttpDatabase<typeof schema>;

logger.log(`🗄️ Using ${process.env.PRODUCTION_DATABASE_URL ? 'PRODUCTION' : 'DEVELOPMENT'} database`);

// Use HTTP connection instead of WebSocket for better stability
const sqlClient = neon(databaseUrl);
const db = drizzle(sqlClient, {
  schema,
  logger: false
}) as DB;

// Add execute method for raw SQL queries
(db as any).execute = async (query: any) => {
  return await sqlClient(query);
};

export { db };
