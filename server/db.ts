import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { drizzle as drizzleSQLite } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@shared/schema';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { logger } from './utils/production-safe-logger';

// Use production database when PRODUCTION_DATABASE_URL is set (deployed app)
// Otherwise use development database (workspace)
const databaseUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

// Fix TypeScript union type issue by using a single concrete type
// This prevents "expression is not callable" errors when using db.select/insert/update/delete
type DB = NeonHttpDatabase<typeof schema>;
let db: DB;
let sqlClient: ReturnType<typeof neon> | null = null;

if (databaseUrl) {
  logger.log(`🗄️ Using ${process.env.PRODUCTION_DATABASE_URL ? 'PRODUCTION' : 'DEVELOPMENT'} database`);
  // Use HTTP connection instead of WebSocket for better stability
  sqlClient = neon(databaseUrl);
  db = drizzle(sqlClient, {
    schema,
    logger: false
  }) as DB;

  // Add execute method for raw SQL queries
  (db as any).execute = async (query: any) => {
    if (sqlClient) {
      return await sqlClient(query);
    }
    throw new Error('SQL client not initialized');
  };
} else {
  // Fallback to SQLite for local development
  logger.log('🗄️ No DATABASE_URL found, using local SQLite database for development');
  const sqlite = new Database('./database.db');
  db = drizzleSQLite(sqlite, { schema }) as unknown as DB;

  // Add execute method for SQLite
  (db as any).execute = async (query: any) => {
    return sqlite.prepare(query.sql.join('')).run();
  };
}

export { db };
