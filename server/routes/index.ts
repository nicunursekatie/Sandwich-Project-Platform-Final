import { Router } from 'express';
import createAdminRoutes from './admin';
import createAuthRoutes from './auth';
import createGroupsCatalogRoutes from './groups-catalog';

// Import organized feature routers
import usersRouter from './users';
import createProjectRoutes from './projects';
import tasksRouter from './tasks';
import collectionsRouter from './collections';
import recipientsRouter from './recipients';
import meetingsRouter from './meetings/index';
import messagingRouter from './messaging';
import eventRequestsRouter from './event-requests';
import importCollectionsRouter from './import-collections';
import notificationsRouter from './notifications';
import reportsRouter from './reports';
import searchRouter from './search';
import storageRouter from './storage';
import versioningRouter from './versioning';
import coreRouter from './core';
import meRouter from './me';
import { createDocumentsRouter } from './documents';
import createAgendaItemsRouter from '../routes/agenda-items';
import { createActivityLogRoutes } from './activity-log';
import { smsUserRoutes } from './sms-users';
import { smsTestingRoutes } from './sms-testing';
import { smsAnnouncementRoutes } from './sms-announcement';
import monitoringRouter from './monitoring';
import enhancedActivityRouter from './enhanced-user-activity';
import { wishlistSuggestionsRouter, wishlistActivityRouter } from './wishlist';
import { streamRoutes } from './stream';

// Import centralized middleware
import { createStandardMiddleware, createErrorHandler } from '../middleware';
import type { IStorage } from '../storage';

interface RouterDependencies {
  isAuthenticated: any;
  requirePermission: any;
  sessionStore: any;
  storage: IStorage;
}

export function createMainRoutes(deps: RouterDependencies) {
  const router = Router();

  // Legacy routes - preserve existing functionality
  const adminRoutes = createAdminRoutes({
    isAuthenticated: deps.isAuthenticated,
    requirePermission: deps.requirePermission,
    sessionStore: deps.sessionStore,
  });
  router.use('/api', adminRoutes);

  const authRoutes = createAuthRoutes({
    isAuthenticated: deps.isAuthenticated,
  });
  router.use('/api/auth', authRoutes);

  const groupsCatalogRoutes = createGroupsCatalogRoutes({
    isAuthenticated: deps.isAuthenticated,
  });
  router.use('/api/groups-catalog', groupsCatalogRoutes);

  // New organized feature routes with consistent middleware
  // Core application routes (health checks, session management)
  router.use('/api', coreRouter);

  // Feature-based routes with standardized middleware
  router.use(
    '/api/users',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    usersRouter
  );
  router.use('/api/users', createErrorHandler('users'));

  // Instantiate projects router with required dependencies
  const projectsRouter = createProjectRoutes({
    storage: deps.storage,
    isAuthenticated: deps.isAuthenticated,
    requirePermission: deps.requirePermission,
  });
  router.use(
    '/api/projects',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    projectsRouter
  );
  router.use('/api/projects', createErrorHandler('projects'));

  router.use(
    '/api/tasks',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    tasksRouter
  );
  router.use('/api/tasks', createErrorHandler('tasks'));

  router.use(
    '/api/sandwich-collections',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    collectionsRouter
  );
  router.use('/api/sandwich-collections', createErrorHandler('collections'));

  router.use(
    '/api/recipients',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    recipientsRouter
  );
  router.use('/api/recipients', createErrorHandler('recipients'));

  router.use(
    '/api/import-collections',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    importCollectionsRouter
  );
  router.use(
    '/api/import-collections',
    createErrorHandler('import-collections')
  );

  // Mount meetings routes with multiple paths to match existing routes
  router.use(
    '/api/meeting-minutes',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    meetingsRouter
  );
  router.use('/api/meeting-minutes', createErrorHandler('meetings'));

  // Setup agenda items router
  const agendaItemsRouter = createAgendaItemsRouter(
    deps.isAuthenticated,
    deps.storage
  );

  router.use(
    '/api/agenda-items',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    agendaItemsRouter
  );
  router.use('/api/agenda-items', createErrorHandler('agenda-items'));

  router.use(
    '/api/current-meeting',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    meetingsRouter
  );
  router.use('/api/current-meeting', createErrorHandler('meetings'));

  router.use(
    '/api/meetings',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    meetingsRouter
  );
  router.use('/api/meetings', createErrorHandler('meetings'));

  router.use(
    '/api/drive-links',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    meetingsRouter
  );
  router.use('/api/drive-links', createErrorHandler('meetings'));

  router.use(
    '/api/files',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    meetingsRouter
  );
  router.use('/api/files', createErrorHandler('meetings'));

  router.use(
    '/api/messaging',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    messagingRouter
  );
  router.use('/api/messaging', createErrorHandler('messaging'));

  router.use(
    '/api/notifications',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    notificationsRouter
  );
  router.use('/api/notifications', createErrorHandler('notifications'));

  router.use(
    '/api/reports',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    reportsRouter
  );
  router.use('/api/reports', createErrorHandler('reports'));

  router.use(
    '/api/search',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    searchRouter
  );
  router.use('/api/search', createErrorHandler('search'));

  router.use(
    '/api/storage',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    storageRouter
  );
  router.use('/api/storage', createErrorHandler('storage'));

  // Documents router with standardized middleware
  const documentsRouter = createDocumentsRouter(deps.storage);
  router.use(
    '/api/documents',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    documentsRouter
  );
  router.use('/api/documents', createErrorHandler('documents'));

  router.use(
    '/api/versioning',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    versioningRouter
  );
  router.use('/api/versioning', createErrorHandler('versioning'));

  // Activity log router
  const activityLogRouter = createActivityLogRoutes(deps.storage);
  router.use(
    '/api/activity-log',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    activityLogRouter
  );
  router.use('/api/activity-log', createErrorHandler('activity-log'));

  // Event Requests routes
  router.use(
    '/api/event-requests',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    eventRequestsRouter
  );
  router.use('/api/event-requests', createErrorHandler('event-requests'));

  // Me routes - user-specific endpoints
  router.use(
    '/api/me',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    meRouter
  );
  router.use('/api/me', createErrorHandler('me'));

  // SMS notification routes - SMS users router already includes /users prefix
  router.use(
    '/api',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    smsUserRoutes
  );

  router.use(
    '/api/sms-testing',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    smsTestingRoutes
  );
  router.use('/api/sms-testing', createErrorHandler('sms-testing'));

  router.use(
    '/api/sms-announcement',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    smsAnnouncementRoutes
  );
  router.use('/api/sms-announcement', createErrorHandler('sms-announcement'));

  router.use(
    '/api/monitoring',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    monitoringRouter
  );
  router.use('/api/monitoring', createErrorHandler('monitoring'));

  // Wishlist routes - mount directly to match frontend expectations
  router.use(
    '/api/wishlist-suggestions',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    wishlistSuggestionsRouter
  );
  router.use('/api/wishlist-suggestions', createErrorHandler('wishlist-suggestions'));

  router.use(
    '/api/wishlist-activity',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    wishlistActivityRouter
  );
  router.use('/api/wishlist-activity', createErrorHandler('wishlist-activity'));

  // Enhanced user activity tracking (stub) - enabled to prevent 404 errors
  router.use('/api/enhanced-user-activity', enhancedActivityRouter);

  // Stream Chat routes - real-time messaging with Stream API
  router.use(
    '/api/stream',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    streamRoutes
  );
  router.use('/api/stream', createErrorHandler('stream'));

  return router;
}

// Backwards compatibility exports
export { createMainRoutes as apiRoutes };
export default createMainRoutes;
