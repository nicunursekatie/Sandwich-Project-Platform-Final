import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DEV_DATABASE_URL || '';

export default defineConfig({
  schema: './shared/schema.ts',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
  verbose: false,
  strict: false,
});
