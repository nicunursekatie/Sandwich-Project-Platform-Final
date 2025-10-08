import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { drizzle as drizzleSQLite } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '@shared/schema';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

// Use production database when PRODUCTION_DATABASE_URL is set (deployed app)
// Otherwise use development database (workspace)
const databaseUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

let db: NeonHttpDatabase<typeof schema> | BetterSQLite3Database<typeof schema>;

if (databaseUrl) {
  console.log(`🗄️ Using ${process.env.PRODUCTION_DATABASE_URL ? 'PRODUCTION' : 'DEVELOPMENT'} database`);
  // Use HTTP connection instead of WebSocket for better stability
  const sql = neon(databaseUrl);
  db = drizzle(sql, { schema });
} else {
  // Fallback to SQLite for local development
  console.log('🗄️ No DATABASE_URL found, using local SQLite database for development');
  const sqlite = new Database('./database.db');
  db = drizzleSQLite(sqlite, { schema });
}

export { db };
