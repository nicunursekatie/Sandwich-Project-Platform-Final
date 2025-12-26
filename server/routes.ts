import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { storage } from './storage-wrapper';
import { createActivityLogger } from './middleware/activity-logger';
import createMainRoutes from './routes/index';
import { requirePermission, blockInactiveUsers } from './middleware/auth';
import { createCorsMiddleware, logCorsConfig } from './config/cors';
import { logger } from './utils/production-safe-logger';
import { getDatabaseUrl } from './db-url';

/**
 * Route Registration
 *
 * All routes are now handled by the modular routing system in server/routes/index.ts.
 * This file configures middleware and delegates to the modular router.
 *
 * To add new routes, see server/routes/index.ts
 */

export async function registerRoutes(app: Express): Promise<any> {
  // Validate SESSION_SECRET in production to prevent security vulnerabilities
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    throw new Error(
      'CRITICAL: SESSION_SECRET environment variable must be set in production. ' +
      'Without this, session tokens can be forged, leading to authentication bypass.'
    );
  }

  // Use database-backed session store for deployment persistence
  // Use centralized database URL configuration from db-url.ts
  const databaseUrl = getDatabaseUrl();

  const PgSession = connectPg(session);
  const sessionStore = new PgSession({
    conString: databaseUrl,
    createTableIfMissing: true,
    ttl: 30 * 24 * 60 * 60, // 30 days in seconds (matches cookie maxAge)
    tableName: 'sessions',
  });

  // Add secure CORS middleware before session middleware
  logCorsConfig(); // Log configuration for debugging
  app.use(createCorsMiddleware());

  // Determine if we're in production (deployed) or development environment
  const isProduction = process.env.NODE_ENV === 'production';
  const isReplitDev = !!(process.env.REPL_ID || process.env.REPLIT_DB_URL);
  const useSecureCookies = isProduction && !isReplitDev;

  logger.log('[Session Config]', {
    isProduction,
    isReplitDev,
    useSecureCookies,
    cookieSettings: {
      secure: useSecureCookies,
      sameSite: useSecureCookies ? 'none' : 'lax',
    },
  });

  // Add session middleware with enhanced security and mobile compatibility
  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || 'temp-secret-key-for-development',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: useSecureCookies,
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        sameSite: useSecureCookies ? 'none' : 'lax',
        domain: undefined,
      },
      name: 'tsp.session',
      rolling: true,
    })
  );

  // Import authentication middleware
  const { isAuthenticated } = await import('./auth');

  // Add activity logging middleware after authentication setup
  app.use(createActivityLogger({ storage }));

  // Block inactive (pending approval) users from accessing protected routes
  app.use(blockInactiveUsers);
  logger.log('✅ Inactive user blocking middleware enabled');

  // Disable caching for all API routes to prevent development issues
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Main modular routes (handles all API endpoints)
  const mainRoutes = createMainRoutes({
    isAuthenticated,
    requirePermission,
    sessionStore,
    storage,
  });
  app.use(mainRoutes);

  // Signup routes (kept separate for unauthenticated access)
  const { signupRoutes } = await import('./routes/signup');
  app.use('/api', signupRoutes);

  // Catch-all handler for unknown API routes
  app.use('/api', (req, res, next) => {
    if (req.path.startsWith('/api/') && !res.headersSent) {
      res.status(404).json({
        error: 'API endpoint not found',
        path: req.path,
        method: req.method,
      });
    } else {
      next();
    }
  });

  return sessionStore;
}
