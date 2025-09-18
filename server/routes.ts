import type { Express } from 'express';
import { createServer, type Server } from 'http';
import express from 'express';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import { storage } from './storage-wrapper';
import { createActivityLogger } from './middleware/activity-logger';
import createMainRoutes from './routes/index';
import { requirePermission } from './middleware/auth';
import { createCorsMiddleware, logCorsConfig } from './config/cors';

export async function registerRoutes(app: Express): Promise<Server> {
  // Use database-backed session store for deployment persistence
  const PgSession = connectPg(session);
  const sessionStore = new PgSession({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: 30 * 24 * 60 * 60, // 30 days in seconds (matches cookie maxAge)
    tableName: 'sessions',
  });

  // Add secure CORS middleware before session middleware
  logCorsConfig(); // Log configuration for debugging
  app.use(createCorsMiddleware());

  // Add session middleware with enhanced security and mobile compatibility
  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || 'temp-secret-key-for-development',
      resave: false, // Only save session when modified - prevents unnecessary DB writes
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        httpOnly: true, // Prevent XSS attacks by blocking client-side access
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days for extended user sessions
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for mobile compatibility in production
        domain: undefined, // Let Express auto-detect domain for Replit
      },
      name: 'tsp.session', // Custom session name
      rolling: true, // Reset maxAge on every request to keep active sessions alive
    })
  );

  // Import authentication middleware for legacy routes that still need it
  const { isAuthenticated, setupTempAuth } = await import('./temp-auth');
  
  // Setup temp auth routes (including login page)
  setupTempAuth(app);

  // Add activity logging middleware after authentication setup
  app.use(createActivityLogger({ storage }));

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

  const passwordResetRoutes = await import('./routes/password-reset');
  app.use('/api', passwordResetRoutes.default);

  // === ENTITY MANAGEMENT ROUTES ===
  const driversRoutes = await import('./routes/drivers');
  app.use('/api/drivers', driversRoutes.default(isAuthenticated, storage));

  const volunteersRoutes = await import('./routes/volunteers');
  app.use(
    '/api/volunteers',
    volunteersRoutes.default(isAuthenticated, storage)
  );

  const { hostsRoutes } = await import('./routes/hosts');
  app.use('/api', hostsRoutes);

  const recipientsRoutes = await import('./routes/recipients');
  app.use('/api/recipients', recipientsRoutes.default);

  const recipientTspContactRoutes = await import(
    './routes/recipient-tsp-contacts'
  );
  app.use('/api/recipient-tsp-contacts', recipientTspContactRoutes.default);

  // === EVENT & DATA MANAGEMENT ===
  const eventRequestRoutes = await import('./routes/event-requests');
  app.use('/api/event-requests', eventRequestRoutes.default);

  const eventRemindersRoutes = await import('./routes/event-reminders');
  app.use(
    '/api/event-reminders',
    eventRemindersRoutes.default(isAuthenticated, storage)
  );

  const sandwichDistributionsRoutes = await import(
    './routes/sandwich-distributions'
  );
  app.use('/api/sandwich-distributions', sandwichDistributionsRoutes.default);

  const importEventsRoutes = await import('./routes/import-events');
  app.use('/api/import', importEventsRoutes.default);

  // === COMMUNICATION & EXTERNAL SERVICES ===
  const emailRoutes = await import('./routes/email-routes');
  app.use('/api/emails', emailRoutes.default);

  const { streamRoutes } = await import('./routes/stream');
  app.use('/api/stream', isAuthenticated, streamRoutes);

  // Message notifications routes
  const { registerMessageNotificationRoutes } = await import('./routes/message-notifications');
  registerMessageNotificationRoutes(app);

  // Announcements routes
  const { registerAnnouncementRoutes } = await import('./routes/announcements');
  registerAnnouncementRoutes(app);

  // User routes are now handled by the modular system in server/routes/index.ts

  // Register performance optimization routes
  const { registerPerformanceRoutes } = await import('./routes/performance');
  registerPerformanceRoutes(app);

  // Add catch-all handler for unknown API routes to prevent SPA fallback serving HTML
  // This must come AFTER all legitimate API routes but BEFORE static file serving
  app.use('/api', (req, res, next) => {
    // Only catch unmatched API routes, not the root path or static files
    if (req.path.startsWith('/api/') && !res.headersSent) {
      res.status(404).json({ 
        error: 'API endpoint not found',
        path: req.path,
        method: req.method 
      });
    } else {
      next();
    }
  });

  // Create HTTP server
  const server = createServer(app);

  return server;
}
