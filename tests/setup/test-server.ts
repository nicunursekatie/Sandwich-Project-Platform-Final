/**
 * Test Server Setup
 *
 * Creates an Express app instance for integration testing with proper
 * authentication, database, and middleware setup.
 */

import express, { Express } from 'express';
import session from 'express-session';
import { registerRoutes } from '../../server/routes';

export interface TestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  permissions: string[];
  isActive: boolean;
}

export interface TestContext {
  app: Express;
  authenticatedSession: any;
  unauthenticatedSession: any;
  adminSession: any;
}

/**
 * Create a test Express app with all routes registered
 */
export async function createTestServer(): Promise<Express> {
  const app = express();

  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Session middleware for testing
  app.use(
    session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    })
  );

  // Register all routes
  await registerRoutes(app);

  return app;
}

/**
 * Create a mock authenticated session
 */
export function createMockSession(user: Partial<TestUser> = {}): any {
  return {
    user: {
      id: user.id || 'test-user-1',
      email: user.email || 'test@example.com',
      firstName: user.firstName || 'Test',
      lastName: user.lastName || 'User',
      permissions: user.permissions || [],
      isActive: user.isActive !== undefined ? user.isActive : true,
    },
  };
}

/**
 * Create a mock admin session
 */
export function createAdminSession(): any {
  return createMockSession({
    id: 'admin-user',
    email: 'admin@example.com',
    firstName: 'Admin',
    lastName: 'User',
    permissions: [
      'USERS_VIEW',
      'USERS_EDIT',
      'DRIVERS_VIEW',
      'DRIVERS_EDIT',
      'VOLUNTEERS_VIEW',
      'VOLUNTEERS_EDIT',
      'HOSTS_VIEW',
      'HOSTS_EDIT',
      'RECIPIENTS_VIEW',
      'RECIPIENTS_EDIT',
      'DATA_EXPORT',
    ],
  });
}

/**
 * Helper to set authentication on a request
 */
export function authenticateRequest(req: any, user?: Partial<TestUser>): void {
  req.session = createMockSession(user);
  req.user = req.session.user;
}
