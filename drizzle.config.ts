import { defineConfig } from 'drizzle-kit';
import { getDatabaseUrl } from './server/db-url';

// Use centralized database configuration
// For migration generation, we use a placeholder if no URL is configured
const databaseUrl = getDatabaseUrl() || 'postgresql://placeholder';

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