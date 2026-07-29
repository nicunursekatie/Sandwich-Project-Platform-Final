import type { Express } from 'express';
import express from 'express';
import session from 'express-session';
import type { Store } from 'express-session';
import connectPg from 'connect-pg-simple';
import { Pool as PgPool } from 'pg';
import { storage } from './storage-wrapper';
import { createActivityLogger } from './middleware/activity-logger';
import createMainRoutes from './routes/index';
import { requirePermission, blockInactiveUsers } from './middleware/auth';
import { createCorsMiddleware, logCorsConfig } from './config/cors';
import { logger } from './utils/production-safe-logger';
import { getDatabaseUrl } from './db-url';
import { registerObjectStorageRoutes } from './replit_integrations/object_storage';

/**
 * Route Registration
 *
 * All routes are now handled by the modular routing system in server/routes/index.ts.
 * This file configures middleware and delegates to the modular router.
 *
 * To add new routes, see server/routes/index.ts
 */

export async function registerRoutes(app: Express): Promise<Store> {
  // ==========================================================================
  // SESSION & COOKIE CONFIGURATION
  // ==========================================================================
  // If login causes a page refresh instead of succeeding, check:
  // 1. trust proxy is set (required behind reverse proxy like Replit)
  // 2. REPLIT_DEPLOYMENT=1 is set in Secrets (for production deployments)
  // 3. SESSION_SECRET is set in Secrets
  // 4. CORS is not setting Access-Control-Allow-Origin to 'null'
  // ==========================================================================

  const isProduction = process.env.NODE_ENV === 'production';
  const isReplitDeployment = process.env.REPLIT_DEPLOYMENT === '1';
  const isOnReplit = !!process.env.REPL_ID;

  // Validate SESSION_SECRET in production to prevent security vulnerabilities
  if (isProduction && !process.env.SESSION_SECRET) {
    throw new Error(
      'CRITICAL: SESSION_SECRET environment variable must be set in production. ' +
      'Without this, session tokens can be forged, leading to authentication bypass.'
    );
  }

  // Warn if REPLIT_DEPLOYMENT is not set correctly
  if (isProduction && isOnReplit && !isReplitDeployment) {
    logger.warn('⚠️ [Session] REPLIT_DEPLOYMENT is not set to "1" in Secrets!');
    logger.warn('⚠️ [Session] This may cause login to fail. Add REPLIT_DEPLOYMENT=1 to your Secrets.');
  }

  // ==========================================================================
  // SESSION STORE RESILIENCE
  // ==========================================================================
  // Sessions are stored in Postgres (Neon). Neon recycles idle Postgres
  // connections after a short window — if connect-pg-simple holds on to
  // a stale connection, every authenticated request can stall waiting
  // for it, and the server appears frozen even though the DB is fine.
  //
  // History: a Neon connection blip on 2026-06-26 wedged the entire
  // server until manual republish. Symptoms were textbook stale-pool:
  // app silent (not crashed), no errors, recovered on fresh process.
  //
  // The fix has two parts:
  //   1. Pass an explicitly configured pg.Pool with:
  //        - short idleTimeoutMillis so dead sockets are dropped fast
  //        - connectionTimeoutMillis so a stuck connect attempt fails
  //          fast rather than hanging the request that triggered it
  //        - small max so any pile-up is bounded
  //        - keepAlive so the OS detects dead peers between requests
  //        - statement_timeout so a session query that does get stuck
  //          aborts in seconds, not minutes
  //   2. A pool.on('error') handler — pg's Pool emits 'error' on idle
  //      clients when the connection dies; without a handler this
  //      becomes an uncaught exception that crashes the process. With
  //      the handler, the pool simply discards the dead client and
  //      gets a fresh one on the next checkout.
  //
  // Net effect: a Neon connection blip is now at worst a momentary
  // slow page for users — the pool self-heals instead of wedging.
  const databaseUrl = getDatabaseUrl();

  const sessionPool = new PgPool({
    connectionString: databaseUrl,
    // Allow up to 5 concurrent session-store connections. Sessions are
    // tiny and reads are cached client-side; we don't need many. A
    // small max also caps blast radius if something does go wrong.
    max: 5,
    // Idle sockets are closed after 30s — well under Neon's idle
    // window so we recycle voluntarily rather than holding dead ones.
    idleTimeoutMillis: 30_000,
    // Fail a stuck initial connect in 5s instead of hanging the
    // request that triggered it.
    connectionTimeoutMillis: 5_000,
    // TCP keepalive so the OS surfaces dead peers between requests
    // rather than discovering them only when we try to use a socket.
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    // Server-side cap: any session query stuck longer than 10s aborts
    // with an error, which the pool can recover from, instead of
    // tying up the request thread indefinitely.
    statement_timeout: 10_000,
  });

  // CRITICAL: handle pool 'error' events. pg's Pool emits 'error' on
  // idle clients when their underlying connection dies (which is what
  // happens during a Neon recycle). Without a listener, Node treats
  // this as an unhandled error and crashes the process. With one, we
  // log it and let the pool transparently replace the bad client.
  sessionPool.on('error', (err) => {
    logger.error('🔌 [SessionPool] Idle client error — pool will recover', {
      message: err.message,
      code: (err as any).code,
    });
  });

  const PgSession = connectPg(session);
  const sessionStore = new PgSession({
    pool: sessionPool,
    // createTableIfMissing intentionally omitted — the sessions table
    // is provisioned by ensureSessionsTable() in db-init.ts at startup.
    // Letting connect-pg-simple try a CREATE TABLE concurrently could
    // race during the very Neon hiccup we're trying to survive.
    ttl: 30 * 24 * 60 * 60, // 30 days in seconds (matches cookie maxAge)
    tableName: 'sessions',
  });

  // CRITICAL: Trust Replit's HTTPS proxy so Express sets secure cookies correctly
  // Without this, Express thinks the connection is insecure and won't set secure cookies
  // SYMPTOM if missing: Login causes page refresh, cookies rejected silently
  app.set('trust proxy', 1);
  logger.info('🔒 [Proxy] trust proxy enabled for secure cookies behind reverse proxy');

  // Add secure CORS middleware before session middleware
  logCorsConfig(); // Log configuration for debugging
  app.use(createCorsMiddleware());

  // Use secure cookies in production OR in Replit deployments (which use HTTPS)
  const useSecureCookies = isProduction || isReplitDeployment;

  // Log complete session configuration for debugging login issues
  logger.info('🔐 [Session Config]', {
    isProduction,
    isReplitDeployment,
    isOnReplit,
    trustProxy: true,
    useSecureCookies,
    cookieSettings: {
      secure: useSecureCookies,
      httpOnly: true,
      sameSite: useSecureCookies ? 'none' : 'lax',
    },
  });

  // Extra validation: warn if configuration looks wrong
  if (useSecureCookies) {
    logger.info('🔐 [Session] Secure cookies ENABLED - requires HTTPS');
  } else {
    logger.info('🔓 [Session] Secure cookies DISABLED - development mode');
  }

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

  registerObjectStorageRoutes(app);

  // CRITICAL: Signup routes MUST be registered BEFORE mainRoutes
  // These are public endpoints that don't require authentication
  // and need to match before authRouter can intercept them
  const { signupRoutes } = await import('./routes/signup');
  app.use('/api', signupRoutes);

  // Main modular routes (handles all API endpoints)
  const mainRoutes = createMainRoutes({
    isAuthenticated,
    requirePermission,
    sessionStore,
    storage,
  });
  app.use(mainRoutes);

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
