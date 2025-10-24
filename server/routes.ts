import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { storage } from './storage-wrapper';
import { createActivityLogger } from './middleware/activity-logger';
import createMainRoutes from './routes/index';
import { requirePermission } from './middleware/auth';
import { createCorsMiddleware, logCorsConfig } from './config/cors';

/**
 * ⚠️  WARNING: LEGACY ROUTING SYSTEM - DO NOT ADD NEW ROUTES HERE! ⚠️
 *
 * This file is part of the LEGACY routing system and should NOT be used for new routes.
 *
 * ❌ DO NOT:
 *   - Add new route registrations to this file
 *   - Import new route files here
 *   - Use app.use() or app.get/post/etc. to register routes
 *
 * ✅ DO INSTEAD:
 *   - Add new routes to server/routes/index.ts using the modular system
 *   - Use the RouterDependencies pattern for dependency injection
 *   - Follow the example of existing routes in server/routes/
 *
 * 📚 DOCUMENTATION:
 *   See ROUTING_CONSOLIDATION_PLAN.md for migration details
 *
 * 🔍 AUTOMATED CHECK:
 *   Run `npm run check:routes` to verify no new legacy routes have been added
 *
 * This file will eventually be deprecated. All new development should use
 * the modular routing system in server/routes/index.ts.
 */

export async function registerRoutes(app: Express): Promise<void> {
  // Use database-backed session store for deployment persistence
  // Use production database when PRODUCTION_DATABASE_URL is set (deployed app)
  const databaseUrl =
    process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
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
  // For Replit: disable secure cookies in development to allow HTTP
  const isProduction = !!process.env.PRODUCTION_DATABASE_URL;
  const isReplitDev = !!(process.env.REPL_ID || process.env.REPLIT_DB_URL);
  const useSecureCookies = isProduction && !isReplitDev;

  console.log('[Session Config]', {
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
      resave: false, // Only save session when modified - prevents unnecessary DB writes
      saveUninitialized: false,
      cookie: {
        secure: useSecureCookies, // Only require HTTPS in true production (not Replit dev)
        httpOnly: true, // Prevent XSS attacks by blocking client-side access
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for extended user sessions
        sameSite: useSecureCookies ? 'none' : 'lax', // 'none' for production mobile, 'lax' for development
        domain: undefined, // Let Express auto-detect domain for Replit
      },
      name: 'tsp.session', // Custom session name
      rolling: true, // Reset maxAge on every request to keep active sessions alive
    })
  );

  // Import authentication middleware and setup
  const { isAuthenticated, setupAuth } = await import('./auth');

  // Setup authentication routes (including login page)
  setupAuth(app);

  // Add activity logging middleware after authentication setup
  app.use(createActivityLogger({ storage }));

  // Disable caching for all API routes to prevent development issues
  app.use('/api', (req, res, next) => {
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, private'
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // === CORE MODULAR ROUTES SYSTEM ===
  // Main modular routes (handles users, projects, tasks, collections, messaging, etc.)
  const mainRoutes = createMainRoutes({
    isAuthenticated,
    requirePermission,
    sessionStore,
    storage,
  });
  app.use(mainRoutes);

  // === AUTHENTICATION & USER MANAGEMENT ===
  const { signupRoutes } = await import('./routes/signup');
  app.use('/api', signupRoutes);

  // REMOVED: Duplicate route - now handled by modular system in server/routes/index.ts
  // const passwordResetRoutes = await import('./routes/password-reset');
  // app.use('/api', passwordResetRoutes.default);

  // === ENTITY MANAGEMENT ROUTES ===
  // REMOVED: Duplicate routes - now handled by modular system
  // const driversRoutes = await import('./routes/drivers');
  // app.use('/api/drivers', driversRoutes.default(isAuthenticated, storage));
  // const volunteersRoutes = await import('./routes/volunteers');
  // app.use('/api/volunteers', volunteersRoutes.default(isAuthenticated, storage));
  // const { hostsRoutes } = await import('./routes/hosts');
  // app.use('/api', hostsRoutes);

  // REMOVED: Duplicate route - now handled by modular system in server/routes/index.ts
  // const recipientsRoutes = await import('./routes/recipients');
  // app.use('/api/recipients', recipientsRoutes.default);

  // === EVENT & DATA MANAGEMENT ===
  // REMOVED: Duplicate routes - now handled by modular system in server/routes/index.ts
  // const recipientTspContactRoutes = await import('./routes/recipient-tsp-contacts');
  // app.use('/api/recipient-tsp-contacts', recipientTspContactRoutes.default);
  // const eventRequestRoutes = await import('./routes/event-requests');
  // app.use('/api/event-requests', eventRequestRoutes.default);
  // const eventRemindersRoutes = await import('./routes/event-reminders');
  // app.use('/api/event-reminders', eventRemindersRoutes.default(isAuthenticated, storage));
  // const sandwichDistributionsRoutes = await import('./routes/sandwich-distributions');
  // app.use('/api/sandwich-distributions', sandwichDistributionsRoutes.default);
  // const importEventsRoutes = await import('./routes/import-events');
  // app.use('/api/import', importEventsRoutes.default);
  // const dataManagementRoutes = await import('./routes/data-management');
  // app.use('/api', dataManagementRoutes.default);

  // REMOVED: Duplicate route - now handled by modular system in server/routes/index.ts
  // Dashboard Documents Configuration
  // const dashboardDocumentsRoutes = await import('./routes/dashboard-documents');
  // app.use('/api/dashboard-documents', dashboardDocumentsRoutes.default(isAuthenticated, requirePermission, storage));

  // === COMMUNICATION & EXTERNAL SERVICES ===
  // REMOVED: Duplicate routes - now handled by modular system in server/routes/index.ts
  // const emailRoutes = await import('./routes/email-routes');
  // app.use('/api/emails', emailRoutes.default);
  // const { streamRoutes } = await import('./routes/stream');
  // app.use('/api/stream', isAuthenticated, streamRoutes);
  // const onboardingRoutes = await import('./routes/onboarding');
  // app.use('/api/onboarding', onboardingRoutes.default);
  // const { registerMessageNotificationRoutes } = await import('./routes/message-notifications');
  // registerMessageNotificationRoutes(app);
  // const { registerAnnouncementRoutes } = await import('./routes/announcements');
  // registerAnnouncementRoutes(app);
  // const { registerPerformanceRoutes } = await import('./routes/performance');
  // registerPerformanceRoutes(app);

  // User routes are now handled by the modular system in server/routes/index.ts

  // REMOVED: Duplicate routes - now handled by modular system in server/routes/index.ts
  // const googleSheetsRoutes = await import('./routes/google-sheets');
  // app.use('/api/google-sheets', googleSheetsRoutes.default);
  // const googleCalendarRoutes = await import('./routes/google-calendar');
  // app.use('/api/google-calendar', googleCalendarRoutes.default);
  // const routeOptimizationRoutes = await import('./routes/routes');
  // app.use('/api/routes', routeOptimizationRoutes.default);

  // REMOVED: Duplicate route - now handled by modular system in server/routes/index.ts
  // Monitoring routes for weekly collection tracking
  // try {
  //   const monitoringRoutes = await import('./routes/monitoring');
  //   console.log('✅ Monitoring routes loaded successfully');
  //   app.use('/api/monitoring', isAuthenticated, monitoringRoutes.default);
  // } catch (error) {
  //   console.error('❌ Failed to load monitoring routes:', error);
  // }

  // Add catch-all handler for unknown API routes to prevent SPA fallback serving HTML
  // This must come AFTER all legitimate API routes but BEFORE static file serving
  app.use('/api', (req, res, next) => {
    // Only catch unmatched API routes, not the root path or static files
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

  // HTTP server is created by the caller (server/index.ts)
  // This function only registers routes and middleware
}
