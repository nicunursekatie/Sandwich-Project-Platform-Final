import { defineConfig } from 'drizzle-kit';

// Use DATABASE_URL or PRODUCTION_DATABASE_URL if available
// For migration generation only, we don't strictly need DB connection
const databaseUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL || 'postgresql://placeholder';

export default defineConfig({
  out: './migrations',
  schema: './shared/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
  // Generate migrations based on schema changes only
  // Don't try to introspect if using placeholder
  verbose: true,
  strict: true,
});
0