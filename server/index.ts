// Clean error handling for Replit - let Replit handle restarts
// Replit already monitors and restarts crashed apps automatically

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

const app = express();
const serverLogger = createServiceLogger('server');

// CRITICAL: Health check MUST be first - before any middleware or initialization
// This ensures Autoscale deployments can verify the server is running immediately
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Root endpoint also responds immediately for deployment health checks
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

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

async function startServer() {
  try {
    serverLogger.info('Starting The Sandwich Project server...');

    // Basic error handler - ensure JSON responses for API routes
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

    // For Autoscale deployments, use port 80 in production, 5000 in development
    const port = process.env.NODE_ENV === 'production' ? 80 : (process.env.PORT || 5000);
    const host = '0.0.0.0';

    serverLogger.info(
      `Starting server on ${host}:${port} in ${process.env.NODE_ENV || 'development'} mode`
    );

    const finalPort = port;

    // Set up basic routes BEFORE starting server
    app.use('/attached_assets', express.static('attached_assets'));

    // API health check endpoint
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

    // Set up Socket.io for chat system
    const io = setupSocketChat(httpServer);

    // Configure smart delivery service with Socket.IO for real-time notifications
    smartDeliveryService.setSocketIO(io);

    // Set up WebSocket server for real-time notifications
    const wss = new WebSocketServer({
      server: httpServer,
      path: '/notifications',
    });

    // Simple API request logging (without interfering with responses)
    app.use('/api', (req: Request, res: Response, next: NextFunction) => {
      serverLogger.debug(`API Request: ${req.method} ${req.originalUrl}`);
      next();
    });

    // CRITICAL FIX: Register all API routes FIRST to prevent route interception
    try {
      await registerRoutes(app);
      serverLogger.info('✅ API routes registered FIRST - before static files');
    } catch (error) {
      serverLogger.error('Route registration failed:', error);
    }

    // CRITICAL FIX: Add JSON 404 catch-all for unmatched API routes
    // This prevents API routes from falling through to Vite/SPA and returning HTML
    app.all('/api/*', (req: Request, res: Response) => {
      serverLogger.warn(`🚨 API route not found: ${req.originalUrl}`);
      res.status(404).json({
        error: `API route not found: ${req.originalUrl}`,
        method: req.method,
        path: req.originalUrl,
      });
    });

    // IMPORTANT: Static files and SPA fallback MUST come AFTER API routes
    if (process.env.NODE_ENV === 'production') {
      // In production, serve static files from the built frontend
      app.use(express.static('dist/public'));

      // SPA fallback for production - serve index.html for frontend routes
      // This MUST be after API routes and MUST NOT catch / (health check endpoint)
      app.get('*', async (req: Request, res: Response, next: NextFunction) => {
        // NEVER serve HTML for API routes - let them 404 instead
        if (req.originalUrl.startsWith('/api/')) {
          serverLogger.warn(
            `🚨 API route ${req.originalUrl} reached SPA fallback - this should not happen!`
          );
          return next(); // Let it 404 rather than serve HTML
        }

        // Root / is reserved for health checks, don't serve SPA for it
        if (req.originalUrl === '/') {
          return next(); // This shouldn't happen since / is already handled above
        }

        // Serve SPA for all other frontend routes
        const path = await import('path');
        res.sendFile(path.join(process.cwd(), 'dist/public/index.html'));
      });

      serverLogger.info(
        '✅ Static file serving and SPA routing configured AFTER API routes'
      );
    }

    // Set up Vite middleware AFTER API routes to prevent catch-all interference
    if (process.env.NODE_ENV === 'development') {
      try {
        const { setupVite } = await import('./vite');
        await setupVite(app, httpServer);
        serverLogger.info(
          'Vite development server setup complete AFTER API routes'
        );
      } catch (error) {
        serverLogger.error('Vite setup failed:', error);
        serverLogger.warn(
          'Server continuing without Vite - frontend may not work properly'
        );
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

    // Start server and keep process alive - critical for production deployments
    return new Promise<Server>((resolve) => {
      httpServer.listen(Number(finalPort), host, () => {
        serverLogger.info(`✅ Server listening on http://${host}:${finalPort}`);
        serverLogger.info(
          `WebSocket server ready on ws://${host}:${finalPort}/notifications`
        );
        serverLogger.info(
          `Environment: ${process.env.NODE_ENV || 'development'}`
        );

        // Signal deployment readiness to Replit
        if (process.env.NODE_ENV === 'production') {
          serverLogger.info('🚀 PRODUCTION SERVER READY FOR TRAFFIC');
        } else {
          serverLogger.info('✅ Development server ready');
        }

        // Run initialization in the background AFTER server is listening
        // This prevents blocking health checks and allows the server to respond immediately
        (async () => {
          try {
            serverLogger.info('Starting background initialization...');
            
            await initializeDatabase();
            serverLogger.info('✓ Database initialized');

            const { storage } = await import('./storage-wrapper');
            const { startBackgroundSync } = await import('./background-sync-service');
            startBackgroundSync(storage as any);
            serverLogger.info('✓ Background sync started');

            const { initializeCronJobs } = await import('./services/cron-jobs');
            initializeCronJobs();
            serverLogger.info('✓ Cron jobs initialized');

            serverLogger.info('✅ Background initialization complete');
          } catch (error) {
            serverLogger.error('Background initialization failed:', error);
            serverLogger.warn('Server will continue running, but some features may be unavailable');
          }
        })();

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

        // Proper error handling - log and exit, let Replit restart
        process.on('uncaughtException', (error) => {
          serverLogger.error('🚨 Uncaught Exception - this is fatal:', error);
          serverLogger.error('Exiting to allow Replit to restart the app cleanly');
          process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
          serverLogger.error('🚨 Unhandled Promise Rejection:', {
            reason,
            promise,
          });
          serverLogger.error('Exiting to allow Replit to restart the app cleanly');
          process.exit(1);
        });

        // Resolve with the server instance to keep reference alive
        resolve(httpServer);
      });
    });
  } catch (error) {
    serverLogger.error('✗ Server startup failed:', error);
    serverLogger.error(
      'Fatal startup error - exiting to allow Replit to restart'
    );
    process.exit(1);
  }
}

// Start server and keep it running - the returned Promise keeps the server reference alive
startServer()
  .then((server) => {
    // Server is now listening and will stay alive
    // The server reference and active listeners keep the process running
  })
  .catch((error) => {
    console.error('✗ Failed to start server:', error);
    console.error('Fatal error - exiting to allow Replit to restart');
    process.exit(1);
  });
