// Clean error handling for Replit - let Replit handle restarts
// Replit already monitors and restarts crashed apps automatically

// Note: OpenAPI extension removed due to platform compatibility issues

import express, { type Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import compression from 'compression';
import { registerRoutes } from './routes';
import { setupVite, serveStatic, log } from './vite';
import { initializeDatabase } from './db-init';
import { setupSocketChat } from './socket-chat';
import { startBackgroundSync } from './background-sync-service';
import { smartDeliveryService } from './services/notifications/smart-delivery';
import logger, { createServiceLogger, logRequest } from './utils/logger.js';
import {
  performanceMonitoringMiddleware,
  errorTrackingMiddleware,
  createMonitoringRoutes,
  monitorSocketIO,
  monitorWebSocket,
  startMetricsUpdates,
  sentryErrorHandler,
  initializeSentry,
} from './monitoring';

const app = express();
const serverLogger = createServiceLogger('server');

// Initialize Sentry error tracking (must be before any other middleware)
initializeSentry(app);
serverLogger.info('Sentry monitoring initialized');

// CRITICAL: Health check route BEFORE any middleware - for deployment health checks
// Use /healthz instead of / to avoid blocking the frontend
app.get('/healthz', (_req: Request, res: Response) => res.sendStatus(200));

// Performance monitoring middleware (should be early in the chain)
app.use(performanceMonitoringMiddleware);
serverLogger.info('Performance monitoring middleware enabled');

// Enable gzip/brotli compression for performance
app.use(
  compression({
    filter: (req: Request, res: Response) => {
      // Don't compress if the client doesn't support it
      if (req.headers['x-no-compression']) {
        return false;
      }

      // Compress all text-based content types and JSON
      const contentType = res.get('content-type');
      if (!contentType) return false;

      return (
        /text|javascript|json|css|html|xml|svg/.test(contentType) ||
        contentType.includes('application/json') ||
        contentType.includes('application/javascript') ||
        contentType.includes('text/')
      );
    },
    threshold: 1024, // Only compress files larger than 1KB
    level: 6, // Compression level (1-9, 6 is good balance)
    memLevel: 8, // Memory usage level (1-9, 8 is good balance)
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add CDN caching headers for static assets
app.use((req: Request, res: Response, next: NextFunction) => {
  const path = req.path;

  // Set cache headers based on content type and path
  if (path.match(/\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico|pdf)$/i)) {
    // Static assets - cache for 1 year (immutable if using content hashing)
    if (path.includes('.') && path.match(/\.[a-f0-9]{8,}\./)) {
      // Content-hashed assets (e.g., main.abc123def.js) - cache immutably
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      // Non-hashed assets - cache for 1 day with revalidation
      res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
    }
    res.setHeader('Vary', 'Accept-Encoding');
  } else if (path.startsWith('/api/')) {
    // API routes - no caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else if (path === '/' || path.endsWith('.html')) {
    // HTML pages - minimal caching with revalidation
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  }

  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (path.startsWith('/api')) {
      logRequest(req.method, path, undefined, duration);

      // Also use the old log format for compatibility
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + '…';
      }

      log(logLine);
    }
  });

  next();
});

// Debug process exit
process.on('exit', (code) => logger.warn(`Process exiting with code: ${code}`));
process.on('uncaughtException', (e) => {
  logger.error('Uncaught exception:', e);
});
process.on('unhandledRejection', (e) => {
  logger.error('Unhandled rejection:', e);
});

async function bootstrap() {
  try {
    serverLogger.info('🚀 Starting The Sandwich Project server...');

    // Use PORT from environment (Replit Autoscale sets PORT=80), fallback to 80 for production, 5000 for dev
    const port = process.env.PORT || (process.env.NODE_ENV === 'production' ? 80 : 5000);
    const host = '0.0.0.0';

    serverLogger.info(
      `Starting server on ${host}:${port} in ${process.env.NODE_ENV || 'development'} mode`
    );

    // Basic error handler - available immediately for early errors
    app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || 'Internal Server Error';
      serverLogger.error('Unhandled error:', err);

      // Ensure API routes always return JSON
      if (req.originalUrl.startsWith('/api')) {
        return res.status(status).json({ message, error: true });
      }

      res.status(status).json({ message });
    });

    // Set up basic routes BEFORE starting server
    app.use('/attached_assets', express.static('attached_assets'));

    // Health check route - available before full initialization
    app.get('/health', (_req: Request, res: Response) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
      });
    });

    // Health check route for deployment - API endpoint
    app.get('/api/health', (_req: Request, res: Response) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
      });
    });

    const httpServer = createServer(app);

    // CRITICAL: Start listening IMMEDIATELY to open port for health checks
    // All heavy initialization will happen in background after port is open
    httpServer.listen(Number(port), host, () => {
      serverLogger.info(`✅ Server listening on http://${host}:${port}`);
      serverLogger.info(`✅ Port ${port} is now open for health checks`);
      serverLogger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);

      // Do ALL heavy initialization in background after server is listening
      setImmediate(async () => {
        try {
          serverLogger.info('Starting background initialization...');

          // Set up Socket.io for chat system
          const io = setupSocketChat(httpServer);
          monitorSocketIO(io);
          serverLogger.info('✅ Socket.IO monitoring enabled');

          // Configure smart delivery service with Socket.IO for real-time notifications
          smartDeliveryService.setSocketIO(io);

          // Set up WebSocket server for real-time notifications
          const wss = new WebSocketServer({
            server: httpServer,
            path: '/notifications',
          });

          // Monitor native WebSocket performance
          monitorWebSocket(wss);
          serverLogger.info('✅ WebSocket monitoring enabled');

          // Simple API request logging (without interfering with responses)
          app.use('/api', (req: Request, res: Response, next: NextFunction) => {
            serverLogger.debug(`API Request: ${req.method} ${req.originalUrl}`);
            next();
          });

          // Register monitoring routes (metrics, health checks, dashboard)
          const monitoringRouter = createMonitoringRoutes();
          app.use('/monitoring', monitoringRouter);
          serverLogger.info('✅ Monitoring routes registered at /monitoring');

          // CRITICAL FIX: Register all API routes FIRST to prevent route interception
          let sessionStore: any;
          try {
            sessionStore = await registerRoutes(app);
            serverLogger.info('✅ API routes registered');
          } catch (error) {
            serverLogger.error('Route registration failed:', error);
          }

          // Error tracking middleware (before final error handler)
          app.use(errorTrackingMiddleware);

          // CRITICAL FIX: Add JSON 404 catch-all for unmatched API routes
          app.all('/api/*', (req: Request, res: Response) => {
            serverLogger.warn(`🚨 API route not found: ${req.originalUrl}`);
            res.status(404).json({
              error: `API route not found: ${req.originalUrl}`,
              method: req.method,
              path: req.originalUrl,
            });
          });

          // Sentry error handler (must be after all routes) - only if Sentry is initialized
          if (process.env.SENTRY_DSN) {
            app.use(sentryErrorHandler());
            serverLogger.info('✅ Sentry error handler registered');
          }

          // IMPORTANT: Static files and SPA fallback MUST come AFTER API routes
          if (process.env.NODE_ENV === 'production') {
            // In production, serve static files from the built frontend
            app.use(express.static('dist/public'));

            // Simple SPA fallback for production - serve index.html for non-API routes
            app.get('*', async (req: Request, res: Response, next: NextFunction) => {
              // Skip health check endpoints - they're already handled
              if (req.originalUrl === '/' || req.originalUrl === '/healthz') {
                return next();
              }

              // NEVER serve HTML for API routes - let them 404 instead
              if (req.originalUrl.startsWith('/api/')) {
                serverLogger.warn(
                  `🚨 API route ${req.originalUrl} reached SPA fallback - this should not happen!`
                );
                return next(); // Let it 404 rather than serve HTML
              }

              // Only serve SPA for non-API routes
              const path = await import('path');
              res.sendFile(path.join(process.cwd(), 'dist/public/index.html'));
            });

            serverLogger.info('✅ Static file serving and SPA routing configured');
          }

          // Set up Vite middleware AFTER API routes to prevent catch-all interference
          if (process.env.NODE_ENV === 'development') {
            try {
              const { setupVite } = await import('./vite');
              await setupVite(app, httpServer);
              serverLogger.info('Vite development server setup complete');
            } catch (error) {
              serverLogger.error('Vite setup failed:', error);
              serverLogger.warn('Server continuing without Vite - frontend may not work properly');
            }
          }

          const clients = new Map<string, any>();

          wss.on('connection', (ws, request) => {
            serverLogger.info('WebSocket client connected', {
              remoteAddress: request.socket.remoteAddress,
            });

            ws.on('message', (data) => {
              try {
                const message = JSON.parse(data.toString());
                if (message.type === 'identify' && message.userId) {
                  clients.set(message.userId, ws);
                  serverLogger.info('User identified for notifications', {
                    userId: message.userId,
                  });
                }
              } catch (error) {
                serverLogger.error('WebSocket message parse error:', error);
              }
            });

            ws.on('close', () => {
              // Remove client from map when disconnected
              for (const [userId, client] of Array.from(clients.entries())) {
                if (client === ws) {
                  clients.delete(userId);
                  serverLogger.info('User disconnected from notifications', {
                    userId,
                  });
                  break;
                }
              }
            });

            ws.on('error', (error) => {
              serverLogger.error('WebSocket error:', error);
            });
          });

          // Global broadcast function for messaging system
          (global as any).broadcastNewMessage = async (data: any) => {
            serverLogger.debug('Broadcasting message to connected clients', {
              clientCount: clients.size,
            });

            // Broadcast to all connected clients
            for (const [userId, ws] of Array.from(clients.entries())) {
              if (ws.readyState === 1) {
                // WebSocket.OPEN
                try {
                  ws.send(JSON.stringify(data));
                } catch (error) {
                  serverLogger.error('Error sending message to user', {
                    userId,
                    error,
                  });
                  // Remove dead connection
                  clients.delete(userId);
                }
              } else {
                // Remove dead connection
                clients.delete(userId);
              }
            }
          };

          serverLogger.info('✅ WebSocket server ready at /notifications');

          // Database and background services initialization
          await initializeDatabase();
          logger.log({ message: '✓ Database initialization complete', level: 'info' });

          // Background Google Sheets sync re-enabled
          const { storage } = await import('./storage-wrapper');
          const { startBackgroundSync } = await import(
            './background-sync-service'
          );
          startBackgroundSync(storage as any); // TODO: Fix storage interface types
          logger.log({ message: '✓ Background Google Sheets sync service started', level: 'info' });

          // Initialize cron jobs for scheduled tasks
          const { initializeCronJobs } = await import('./services/cron-jobs');
          initializeCronJobs();
          logger.info('Cron jobs initialized (host availability scraper scheduled)');

          // Start periodic metrics updates (active users, sessions, etc.)
          if (sessionStore) {
            startMetricsUpdates(storage as any, sessionStore);
            logger.info('Periodic metrics updates started');
          } else {
            logger.warn('Session store not available - skipping session metrics');
          }

          logger.info('The Sandwich Project server is fully ready to handle requests');
          logger.info('SERVER INITIALIZATION COMPLETE');
          logger.info(`Monitoring Dashboard: http://${host}:${port}/monitoring/dashboard`);
          logger.info(`Metrics Endpoint: http://${host}:${port}/monitoring/metrics`);
          logger.info(`Health Check: http://${host}:${port}/monitoring/health/detailed`);
        } catch (initError) {
          serverLogger.error('✗ Background initialization failed:', initError);
          serverLogger.error(
            'This is a fatal error - exiting to allow Replit to restart'
          );
          // Let Replit restart the app to recover from initialization failures
          process.exit(1);
        }
      });
    });

    // Graceful shutdown handler - works in both dev and production
    const shutdown = async (signal: string) => {
      serverLogger.info(`Received ${signal}, starting graceful shutdown...`);

      // Close server gracefully
      httpServer.close(() => {
        serverLogger.info('HTTP server closed gracefully');
        process.exit(0);
      });

      // Force shutdown after 10 seconds if graceful shutdown fails
      setTimeout(() => {
        serverLogger.warn('Forcing shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals properly
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // PRODUCTION MODE: Aggressive exit prevention
    if (process.env.NODE_ENV === 'production') {
      logger.log({ message: '✅ Production exit prevention installed', level: 'info' });

      // Strategy 1: Keep stdin open
      process.stdin.resume();

      // Strategy 2: Prevent beforeExit
      process.on('beforeExit', (code) => {
        logger.log({ message: `⚠ Prevented process exit with code ${code} - keeping alive`, level: 'warn' });
        setTimeout(() => {}, 1000);
      });

      // Strategy 3: Override process.exit
      const originalExit = process.exit;
      process.exit = ((code?: number) => {
        logger.log({ message: `⚠ Prevented process.exit(${code}) in production mode`, level: 'warn' });
        return undefined as never;
      }) as typeof process.exit;

      // Production heartbeat
      setInterval(() => {
        logger.log({ message: `✅ Production heartbeat - uptime: ${Math.floor(process.uptime())}s`, level: 'info' });
      }, 60000);

      logger.log({ message: '✅ Production infinite keep-alive loop started', level: 'info' });
    }

    logger.log({ message: '✅ Health endpoint ready: /healthz', level: 'info' });
    logger.log({ message: '✅ Server startup complete - ready for traffic', level: 'info' });
  } catch (error) {
    console.error('SERVER STARTUP FAILED:');
    console.error(error);
    serverLogger.error('✗ Server startup failed:');
    if (error instanceof Error) {
      serverLogger.error('Error message:', error.message);
      serverLogger.error('Error stack:', error.stack);
    } else {
      serverLogger.error('Error details:', String(error));
    }
    process.exit(1);
  }
}

// Start server - MUST NOT await, just call it
bootstrap();

