import { logger } from './utils/production-safe-logger';

/**
 * CENTRALIZED DATABASE URL RESOLUTION
 * 
 * This is the SINGLE source of truth for database connection string selection.
 * All files that need a database connection should import from here.
 * 
 * Environment-based database selection:
 * - Development (NODE_ENV=development or unset): Use DATABASE_URL_DEV (dev Neon branch)
 * - Production (NODE_ENV=production): Use DATABASE_URL (production Neon branch)
 */

export const isProduction = process.env.NODE_ENV === 'production';

export function getDatabaseUrl(): string | undefined {
  // Development: DATABASE_URL_DEV → DATABASE_URL (fallback)
  // Production: DATABASE_URL → DATABASE_URL_DEV (fallback)
  return isProduction 
    ? (process.env.DATABASE_URL || process.env.DATABASE_URL_DEV)
    : (process.env.DATABASE_URL_DEV || process.env.DATABASE_URL);
}

export function getDatabaseBranch(): 'dev' | 'production' {
  const dbUrl = getDatabaseUrl();
  return dbUrl === process.env.DATABASE_URL_DEV ? 'dev' : 'production';
}

export const databaseInfo = {
  isProduction,
  get url() { return getDatabaseUrl(); },
  get branch() { return getDatabaseBranch(); }
};
