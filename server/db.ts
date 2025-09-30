import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@shared/schema';

// Use production database when PRODUCTION_DATABASE_URL is set (deployed app)
// Otherwise use development database (workspace)
const databaseUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL or PRODUCTION_DATABASE_URL must be set. Did you forget to provision a database?'
  );
}

console.log(`🗄️ Using ${process.env.PRODUCTION_DATABASE_URL ? 'PRODUCTION' : 'DEVELOPMENT'} database`);

// Use HTTP connection instead of WebSocket for better stability
const sql = neon(databaseUrl);
export const db = drizzle(sql, { schema });
