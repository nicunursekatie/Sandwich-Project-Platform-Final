import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { logger } from '../lib/logger';

// Extend Express Request to include session with user
interface AuthenticatedRequest extends Request {
  user?: any;
  session?: {
    user?: any;
    destroy?: (callback: (err?: any) => void) => void;
  };
}

/**
 * Development-only bypass middleware
 * Allows all requests in development when APP_ENV=development
 */
export function devBypass(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (process.env.APP_ENV === 'development') {
    return next();
  }
  next();
}

/**
 * Session-based authentication middleware
 * Checks if user is logged in via session
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // Skip auth in development mode
  if (process.env.APP_ENV === 'development') {
    return next();
  }

  try {
    // Check for user in request (set by earlier middleware) or session
    const user = req.user || req.session?.user;

    if (!user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    // Ensure user still exists and is active
    const dbUser = await storage.getUser(user.id);
    if (!dbUser) {
      // Clear invalid session
      if (req.session?.destroy) {
        req.session.destroy(() => {});
      }
      return res.status(401).json({
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    // Don't block inactive users from basic routes (they need to see pending status)
    // The blockInactiveUsers middleware handles route-specific blocking

    // Attach fresh user data to request
    req.user = dbUser;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(500).json({
      message: 'Authentication error',
      code: 'AUTH_ERROR',
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches user to request if authenticated, but doesn't require it
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const user = req.user || req.session?.user;
    if (user) {
      const dbUser = await storage.getUser(user.id);
      if (dbUser) {
        req.user = dbUser;
      }
    }
    next();
  } catch (error) {
    // Don't fail on optional auth errors
    next();
  }
}

/**
 * Middleware to block inactive users from most routes
 * Inactive users can only access authentication-related endpoints
 */
export async function blockInactiveUsers(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // Skip in development mode
  if (process.env.APP_ENV === 'development') {
    return next();
  }

  try {
    // Allow unauthenticated requests to proceed (they'll be caught by other auth checks)
    if (!req.user && !req.session?.user) {
      return next();
    }

    const user = req.user || req.session?.user;

    // Define exact path+method combinations that pending users CAN access
    // Using exact matching to prevent bypassing mutation endpoints
    const allowedRoutes = [
      { method: 'GET', path: '/api/auth/user' },      // Get current user info
      { method: 'POST', path: '/api/auth/login' },    // Login
      { method: 'POST', path: '/api/auth/logout' },   // Logout
      { method: 'POST', path: '/api/auth/signup' },   // Signup
      { method: 'GET', path: '/api/user/me' },        // Get own profile (read-only)
      { method: 'GET', path: '/healthz' },            // Health check
      { method: 'GET', path: '/api/login' },          // Login page
      { method: 'GET', path: '/api/logout' },         // Logout page
      // Password reset routes (public - users need these to recover access)
      { method: 'POST', path: '/api/forgot-password' },           // Request password reset
      { method: 'POST', path: '/api/reset-password' },            // Execute password reset
      { method: 'POST', path: '/api/auth/request-initial-password' }, // Request initial password setup
      { method: 'POST', path: '/api/auth/set-initial-password' },     // Set initial password
    ];

    // Path prefixes that should be allowed (for routes with parameters)
    const allowedPathPrefixes = [
      { method: 'GET', prefix: '/api/verify-reset-token/' },           // Verify reset token
      { method: 'GET', prefix: '/api/auth/verify-initial-password-token/' }, // Verify initial password token
    ];

    // Check if the request method+path combination is allowed for inactive users
    const isAllowedRoute = allowedRoutes.some(
      route => route.method === req.method && req.path === route.path
    );

    // Check if the request matches an allowed prefix pattern
    const isAllowedPrefix = allowedPathPrefixes.some(
      route => route.method === req.method && req.path.startsWith(route.prefix)
    );

    // If user is inactive and trying to access a protected route, block them
    if (user && !user.isActive && !isAllowedRoute && !isAllowedPrefix) {
      logger.log(`❌ INACTIVE USER BLOCKED: ${user.email} attempted to access ${req.path}`);
      return res.status(403).json({
        message: 'Account pending approval',
        code: 'PENDING_APPROVAL',
        details: 'Your account is awaiting admin approval. You will be notified once approved.',
        status: user.metadata?.status || 'pending_approval',
      });
    }

    next();
  } catch (error) {
    logger.error('Error in blockInactiveUsers middleware:', error);
    next(); // Allow request to proceed on error to avoid breaking the app
  }
}

/**
 * Permission-based authorization middleware factory
 * Creates middleware that checks if user has a specific permission
 */
export function requirePermission(permission: string) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    // Skip permission check in development mode
    if (process.env.APP_ENV === 'development') {
      return next();
    }

    const user = req.user || req.session?.user;

    if (!user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    // Super admins have all permissions
    if (user.role === 'super_admin') {
      return next();
    }

    // Check if user has the required permission
    const userPermissions = user.permissions || [];
    if (
      Array.isArray(userPermissions) &&
      userPermissions.includes(permission)
    ) {
      return next();
    }

    // Check role-based permissions (legacy support)
    if (user.role === 'admin') {
      // Admins have most permissions by default
      return next();
    }

    logger.log(
      `❌ PERMISSION DENIED: ${user.email} lacks permission ${permission}`
    );
    return res.status(403).json({
      message: 'Permission denied',
      code: 'PERMISSION_DENIED',
      required: permission,
    });
  };
}

/**
 * Role-based authorization middleware factory
 * Creates middleware that checks if user has one of the specified roles
 */
export function requireRole(...roles: string[]) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    // Skip role check in development mode
    if (process.env.APP_ENV === 'development') {
      return next();
    }

    const user = req.user || req.session?.user;

    if (!user) {
      return res.status(401).json({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      });
    }

    if (!roles.includes(user.role)) {
      logger.log(
        `❌ ROLE DENIED: ${user.email} has role ${user.role}, requires one of: ${roles.join(', ')}`
      );
      return res.status(403).json({
        message: 'Insufficient role',
        code: 'ROLE_DENIED',
        required: roles,
        current: user.role,
      });
    }

    next();
  };
}
