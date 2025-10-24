import { Router } from 'express';
// Import organized feature routers from feature-first folders
import usersRouter from './users';
import createAuthRoutes from './users/auth';
import createProjectRoutes from './projects';
import createAdminRoutes from './core/admin';
import createGroupsCatalogRoutes from './collections/groups-catalog';
import tasksRouter from './tasks';
import collectionsRouter from './collections';
import recipientsRouter from './recipients';
import createMeetingsRouter from './meetings/index';
import meetingNotesRouter from './meeting-notes';
import messagingRouter from './messaging';
import eventRequestsRouter from './event-requests';
import importCollectionsRouter from './import-collections';
import notificationsRouter from './notifications';
import reportsRouter from './reports';
import searchRouter from './search';
import storageRouter from './storage';
import documentsRouter from './documents';
import versioningRouter from './versioning';
import coreRouter from './core';
import meRouter from './me';
import availabilityRouter from './availability';
import createAgendaItemsRouter from '../routes/agenda-items';
import { createActivityLogRoutes } from './activity-log';
import { smsUserRoutes } from './sms-users';
import { smsTestingRoutes } from './sms-testing';
import { smsAnnouncementRoutes } from './sms-announcement';
import monitoringRouter from './monitoring';
import enhancedActivityRouter from './enhanced-user-activity';
import { wishlistSuggestionsRouter, wishlistActivityRouter } from './wishlist';
import { streamRoutes } from './stream';
import { coolerTypesRouter, coolerInventoryRouter } from './coolers';
import teamBoardRouter from './team-board';
import migrationsRouter from './migrations';
import { createDashboardDocumentsRoutes } from './dashboard-documents';
import { createDriversRouter } from './drivers';
import { createVolunteersRouter } from './volunteers';
import { createHostsRouter } from './hosts';
import { createEventRemindersRouter } from './event-reminders';
import { createEmailRouter } from './email-routes';
import { createOnboardingRouter } from './onboarding';
import { createGoogleSheetsRouter } from './google-sheets';
import { createGoogleCalendarRouter } from './google-calendar';
import { createRouteOptimizationRouter } from './routes';
import { createRecipientTspContactsRouter } from './recipient-tsp-contacts';
import { createSandwichDistributionsRouter } from './sandwich-distributions';
import { createImportEventsRouter } from './import-events';
import { createDataManagementRouter } from './data-management';
import { createPasswordResetRouter } from './password-reset';
import { createMessageNotificationsRouter } from './message-notifications';
import { createAnnouncementsRouter } from './announcements';
import { createPerformanceRouter } from './performance';
import { createAuditLogsRouter } from './audit-logs';

// Import centralized middleware
import {
  createStandardMiddleware,
  createErrorHandler,
  createPublicMiddleware,
} from '../middleware';
import { createErrorLogsRoutes } from './error-logs';
import workLogsRouter from './work-logs';
import shoutoutsRouter from './shoutouts';
import { RouterDependencies } from '../types';

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

  // Backwards compatibility: redirect /api/login to /api/auth/login
  router.all('/api/login', (req, res, next) => {
    req.url = '/api/auth/login';
    next('route');
  });
  router.use('/api/login', authRoutes);

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

  // Instantiate meetings router with required dependencies
  const meetingsRouter = createMeetingsRouter(deps);

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
    '/api/availability',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    availabilityRouter
  );
  router.use('/api/availability', createErrorHandler('availability'));

  // Dashboard documents configuration
  const dashboardDocumentsRouter = createDashboardDocumentsRoutes(
    deps.isAuthenticated,
    deps.requirePermission,
    deps.storage
  );
  router.use(
    '/api/dashboard-documents',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    dashboardDocumentsRouter
  );
  router.use('/api/dashboard-documents', createErrorHandler('dashboard-documents'));

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
    '/api/meeting-notes',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    meetingNotesRouter
  );
  router.use('/api/meeting-notes', createErrorHandler('meeting-notes'));

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

  // Audit logs router
  const auditLogsRouter = createAuditLogsRouter(deps);
  router.use(
    '/api/audit-logs',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    auditLogsRouter
  );
  router.use('/api/audit-logs', createErrorHandler('audit-logs'));

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

  // Team board routes
  router.use(
    '/api/team-board',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    teamBoardRouter
  );
  router.use('/api/team-board', createErrorHandler('team-board'));

  // Cooler tracking routes
  router.use(
    '/api/cooler-types',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    coolerTypesRouter
  );
  router.use('/api/cooler-types', createErrorHandler('cooler-types'));

  router.use(
    '/api/cooler-inventory',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    coolerInventoryRouter
  );
  router.use('/api/cooler-inventory', createErrorHandler('cooler-inventory'));

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

  // Client error logging endpoint (no auth required so we can capture pre-login issues)
  const errorLogsRouter = createErrorLogsRoutes(deps.storage);
  router.use(
    '/api/error-logs',
    ...createPublicMiddleware(),
    errorLogsRouter
  );
  router.use('/api/error-logs', createErrorHandler('error-logs'));

  // Work log time tracking endpoints
  router.use(
    '/api/work-logs',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    workLogsRouter
  );
  router.use('/api/work-logs', createErrorHandler('work-logs'));

  // Volunteer shoutouts and recognition tools
  router.use(
    '/api/shoutouts',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    shoutoutsRouter
  );
  router.use('/api/shoutouts', createErrorHandler('shoutouts'));

  // Database migrations (admin only)
  router.use(
    '/api/migrations',
    deps.isAuthenticated,
    migrationsRouter
  );
  router.use('/api/migrations', createErrorHandler('migrations'));

  // Drivers management
  const driversRouter = createDriversRouter(deps);
  router.use(
    '/api/drivers',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    driversRouter
  );
  router.use('/api/drivers', createErrorHandler('drivers'));

  // Volunteers management
  const volunteersRouter = createVolunteersRouter(deps);
  router.use(
    '/api/volunteers',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    volunteersRouter
  );
  router.use('/api/volunteers', createErrorHandler('volunteers'));

  // Hosts management
  const hostsRouter = createHostsRouter(deps);
  router.use(
    '/api',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    hostsRouter
  );
  router.use('/api/hosts*', createErrorHandler('hosts'));

  // Event reminders
  const eventRemindersRouter = createEventRemindersRouter(deps);
  router.use(
    '/api/event-reminders',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    eventRemindersRouter
  );
  router.use('/api/event-reminders', createErrorHandler('event-reminders'));

  // Email/inbox system
  const emailRouter = createEmailRouter(deps);
  router.use(
    '/api/emails',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    emailRouter
  );
  router.use('/api/emails', createErrorHandler('emails'));

  // Onboarding challenges
  const onboardingRouter = createOnboardingRouter(deps);
  router.use(
    '/api/onboarding',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    onboardingRouter
  );
  router.use('/api/onboarding', createErrorHandler('onboarding'));

  // Google Sheets integration
  const googleSheetsRouter = createGoogleSheetsRouter(deps);
  router.use(
    '/api/google-sheets',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    googleSheetsRouter
  );
  router.use('/api/google-sheets', createErrorHandler('google-sheets'));

  // Google Calendar integration
  const googleCalendarRouter = createGoogleCalendarRouter(deps);
  router.use(
    '/api/google-calendar',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    googleCalendarRouter
  );
  router.use('/api/google-calendar', createErrorHandler('google-calendar'));

  // Route optimization
  const routeOptimizationRouter = createRouteOptimizationRouter(deps);
  router.use(
    '/api/routes',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    routeOptimizationRouter
  );
  router.use('/api/routes', createErrorHandler('route-optimization'));

  // Recipient TSP contacts
  const recipientTspContactsRouter = createRecipientTspContactsRouter(deps);
  router.use(
    '/api/recipient-tsp-contacts',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    recipientTspContactsRouter
  );
  router.use('/api/recipient-tsp-contacts', createErrorHandler('recipient-tsp-contacts'));

  // Sandwich distributions
  const sandwichDistributionsRouter = createSandwichDistributionsRouter(deps);
  router.use(
    '/api/sandwich-distributions',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    sandwichDistributionsRouter
  );
  router.use('/api/sandwich-distributions', createErrorHandler('sandwich-distributions'));

  // Event imports
  const importEventsRouter = createImportEventsRouter(deps);
  router.use(
    '/api/import',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    importEventsRouter
  );
  router.use('/api/import', createErrorHandler('import-events'));

  // Data management (exports, bulk operations, integrity checks)
  const dataManagementRouter = createDataManagementRouter(deps);
  router.use(
    '/api/data-management',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    dataManagementRouter
  );
  router.use('/api/data-management', createErrorHandler('data-management'));

  // Password reset
  const passwordResetRouter = createPasswordResetRouter(deps);
  router.use(
    '/api',
    ...createPublicMiddleware(),
    passwordResetRouter
  );

  // Message notifications
  const messageNotificationsRouter = createMessageNotificationsRouter(deps);
  router.use(
    '/api/message-notifications',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    messageNotificationsRouter
  );
  router.use('/api/message-notifications', createErrorHandler('message-notifications'));

  // Announcements
  const announcementsRouter = createAnnouncementsRouter(deps);
  router.use(
    '/api/announcements',
    deps.isAuthenticated,
    ...createStandardMiddleware(),
    announcementsRouter
  );
  router.use('/api/announcements', createErrorHandler('announcements'));

  // Performance monitoring
  const performanceRouter = createPerformanceRouter(deps);
  router.use(
    '/api/performance',
    ...createStandardMiddleware(),
    performanceRouter
  );
  router.use('/api/performance', createErrorHandler('performance'));

  return router;
}

// Backwards compatibility exports
export { createMainRoutes as apiRoutes };
export default createMainRoutes;
