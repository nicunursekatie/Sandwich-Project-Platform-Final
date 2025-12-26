import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@shared/schema';
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http';
import { logger } from './utils/production-safe-logger';
import { requireDatabaseUrl, logDatabaseEnvironment } from './config/database';

// Use centralized database configuration
const databaseUrl = requireDatabaseUrl();

// Fix TypeScript union type issue by using a single concrete type
// This prevents "expression is not callable" errors when using db.select/insert/update/delete
type DB = NeonHttpDatabase<typeof schema>;

logDatabaseEnvironment(logger);

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
