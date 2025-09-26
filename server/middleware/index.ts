/**
 * Centralized Middleware Configuration
 *
 * Re-exports all commonly used middleware from existing files to provide
 * a single import point for consistent middleware usage across the application.
 *
 * Usage:
 * import { requirePermission, sanitizeMiddleware, requestLogger } from '../middleware';
 */

// Import functions for use within this file
import { requestLogger, errorLogger, logger } from './logger';
import { sanitizeMiddleware, sanitizeHtml, sanitizeText } from './sanitizer';
import { requirePermission, requireOwnershipPermission } from './auth';

// Authentication and authorization middleware
export { requirePermission, requireOwnershipPermission } from './auth';

// Input sanitization middleware
export { sanitizeMiddleware, sanitizeHtml, sanitizeText } from './sanitizer';

// Logging and monitoring middleware
export { requestLogger, errorLogger, logger } from './logger';

// File upload handling middleware
export {
  upload,
  meetingMinutesUpload,
  importUpload,
  projectFilesUpload,
  projectDataUpload,
  documentsUpload,
} from './uploads';

// Version control class and utilities
export { VersionControl } from './version-control';
export type { VersionedRecord, ChangesetRequest } from './version-control';

// Activity logging middleware factory
export { createActivityLogger } from './activity-logger';

/**
 * Standard middleware stack for API routes
 *
 * This provides a consistent middleware ordering that can be applied
 * to route groups. Order matters - authentication should come before
 * authorization, sanitization before validation, etc.
 */
export function createStandardMiddleware(permissions?: string[]) {
  const middleware = [requestLogger, sanitizeMiddleware];

  // Add permission checking if specified
  if (permissions && permissions.length > 0) {
    middleware.push(...permissions.map((p) => requirePermission(p)));
  }

  return middleware;
}

/**
 * Create middleware stack for public routes (no authentication required)
 * Includes basic logging and sanitization but no auth checks
 */
export function createPublicMiddleware() {
  return [requestLogger, sanitizeMiddleware];
}

/**
 * Create middleware stack for authenticated routes with optional permissions
 * Combines authentication check with standard middleware
 */
export function createAuthenticatedMiddleware(
  permissions?: string[],
  isAuthenticated?: any
) {
  const middleware = createStandardMiddleware(permissions);

  if (isAuthenticated) {
    return [isAuthenticated, ...middleware];
  }

  return middleware;
}

/**
 * Create a complete middleware stack for a route module
 * Includes authentication, standard middleware, and error handling
 */
export function createCompleteMiddlewareStack(options: {
  moduleId: string;
  isAuthenticated?: any;
  permissions?: string[];
  requireAuth?: boolean;
}) {
  const {
    moduleId,
    isAuthenticated,
    permissions,
    requireAuth = true,
  } = options;

  const middleware = [];

  // Add authentication if required
  if (requireAuth && isAuthenticated) {
    middleware.push(isAuthenticated);
  }

  // Add standard middleware (logging, sanitization, permissions)
  middleware.push(...createStandardMiddleware(permissions));

  // Add error handler
  const errorHandler = createErrorHandler(moduleId);

  return {
    middleware,
    errorHandler,
  };
}

/**
 * Validation middleware factory using shared schemas
 *
 * @param schema - Zod schema for validation
 * @param target - What to validate ('body', 'params', 'query')
 */
export function validateRequest(
  schema: any,
  target: 'body' | 'params' | 'query' = 'body'
) {
  return (req: any, res: any, next: any) => {
    try {
      const data = req[target];
      const validated = schema.parse(data);
      req[target] = validated;
      next();
    } catch (error: any) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors || error.message,
      });
    }
  };
}

/**
 * Error handling middleware for specific route modules
 *
 * Provides consistent error formatting and logging for feature-specific routes
 */
export function createErrorHandler(moduleId: string) {
  return (error: any, req: any, res: any, next: any) => {
    // Use imported logger

    logger.error(`${moduleId} error: ${error.message}`, error, {
      method: req.method,
      url: req.url,
    });

    // Don't expose internal errors in production
    const isDevelopment = process.env.NODE_ENV === 'development';

    res.status(error.status || 500).json({
      error: `${moduleId} error`,
      message: isDevelopment ? error.message : 'Something went wrong',
      ...(isDevelopment && { stack: error.stack }),
    });
  };
}

/**
 * DEPRECATED: Legacy CORS configuration - use centralized config instead
 * @deprecated Use getExpressCorsConfig() from './config/cors' instead
 */
export const corsConfig = {
  origin: false, // Disabled - use centralized config
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

// Export types for TypeScript support
export type { LogEntry } from './logger';
