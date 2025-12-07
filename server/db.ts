import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@shared/schema';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { logger } from './utils/production-safe-logger';

// Environment-based database selection:
// - Production (NODE_ENV=production): Use PRODUCTION_DATABASE_URL
// - Development (NODE_ENV=development): Use DEV_DATABASE_URL (or DATABASE_URL for backwards compatibility)
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = isProduction 
  ? (process.env.PRODUCTION_DATABASE_URL || process.env.DEV_DATABASE_URL || process.env.DATABASE_URL)
  : (process.env.DEV_DATABASE_URL || process.env.DATABASE_URL);

if (!databaseUrl) {
  throw new Error('Database URL not configured. Please set DEV_DATABASE_URL for development or PRODUCTION_DATABASE_URL for production.');
}

// Fix TypeScript union type issue by using a single concrete type
// This prevents "expression is not callable" errors when using db.select/insert/update/delete
type DB = NeonHttpDatabase<typeof schema>;

logger.log(`🗄️ Using ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} database`);

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
