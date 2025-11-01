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

if (databaseUrl) {
  logger.log(`🗄️ Using ${process.env.PRODUCTION_DATABASE_URL ? 'PRODUCTION' : 'DEVELOPMENT'} database`);
  // Use HTTP connection instead of WebSocket for better stability
  const sql = neon(databaseUrl);
  db = drizzle(sql, { 
    schema,
    logger: {
      logQuery: (query: string, params: unknown[]) => {
        logger.log(`[DRIZZLE SQL] ${query}`);
        logger.log(`[DRIZZLE PARAMS] ${JSON.stringify(params)}`);
      }
    }
  }) as DB;
} else {
  // Fallback to SQLite for local development
  logger.log('🗄️ No DATABASE_URL found, using local SQLite database for development');
  const sqlite = new Database('./database.db');
  db = drizzleSQLite(sqlite, { schema }) as unknown as DB;
}

export { db };
