/**
 * Centralized Database Configuration
 *
 * This is the SINGLE source of truth for database connection configuration.
 * All database connections in the codebase should import from this module.
 *
 * Environment Variables (in priority order):
 * - NODE_ENV=production: Uses PRODUCTION_DATABASE_URL
 * - NODE_ENV=development: Uses DEV_DATABASE_URL (falls back to PRODUCTION_DATABASE_URL)
 * - DATABASE_URL: Legacy fallback for both environments
 */

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Get the database URL based on the current environment.
 *
 * Priority order:
 * - Production: PRODUCTION_DATABASE_URL -> DEV_DATABASE_URL -> DATABASE_URL
 * - Development: DEV_DATABASE_URL -> PRODUCTION_DATABASE_URL -> DATABASE_URL
 *
 * Note: Currently using PRODUCTION_DATABASE_URL first in both environments
 * because dev database may not have schema pushed yet.
 * TODO: Switch development to DEV_DATABASE_URL first once dev database is ready.
 */
function getDatabaseUrl(): string | undefined {
  if (isProduction) {
    return (
      process.env.PRODUCTION_DATABASE_URL ||
      process.env.DEV_DATABASE_URL ||
      process.env.DATABASE_URL
    );
  }

  // Development environment
  // TODO: Change to DEV_DATABASE_URL first once dev database has schema
  return (
    process.env.PRODUCTION_DATABASE_URL ||
    process.env.DEV_DATABASE_URL ||
    process.env.DATABASE_URL
  );
}

/**
 * The resolved database URL for the current environment.
 * May be undefined if no database URL is configured.
 */
export const databaseUrl = getDatabaseUrl();

/**
 * Whether we're running in production mode.
 */
export { isProduction };

/**
 * Get the database URL, throwing an error if not configured.
 * Use this when a database connection is required.
 */
export function requireDatabaseUrl(): string {
  const url = databaseUrl;
  if (!url) {
    throw new Error(
      'Database URL not configured. Please set DEV_DATABASE_URL for development or PRODUCTION_DATABASE_URL for production.'
    );
  }
  return url;
}

/**
 * Get database URL for Drizzle config (allows placeholder for migration generation).
 * Returns a placeholder URL if no real URL is configured, since drizzle-kit
 * can generate migrations without an actual database connection.
 */
export function getDatabaseUrlForDrizzleConfig(): string {
  return databaseUrl || 'postgresql://placeholder';
}

/**
 * Log which database is being used (for debugging purposes).
 */
export function logDatabaseEnvironment(logger: { log: (...args: any[]) => void }): void {
  logger.log(`🗄️ Using ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} database`);
}
