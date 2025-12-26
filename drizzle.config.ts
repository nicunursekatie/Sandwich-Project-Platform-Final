import { defineConfig } from 'drizzle-kit';
import { getDatabaseUrlForDrizzleConfig } from './server/config/database';

// Use centralized database configuration
const databaseUrl = getDatabaseUrlForDrizzleConfig();

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