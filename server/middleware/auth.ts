import type { RequestHandler } from 'express';
import { storage } from '../storage-wrapper';
import { PERMISSIONS, getDefaultPermissionsForRole } from '../../shared/auth-utils';
import { checkPermission, checkOwnershipPermission } from '../../shared/unified-auth-utils';
import { logger } from '../utils/production-safe-logger';

/**
 * Environment detection for development vs production mode
 * 
 * Development mode is enabled when ALL of these are true:
 * - APP_ENV is explicitly set to 'development'
 * - NODE_ENV is NOT 'production' (additional safety for non-Replit deployments)
 * - NOT in a Replit deployment (REPLIT_DEPLOYMENT !== '1')
 * 
 * This ensures production deployments ALWAYS require full authentication,
 * even if someone accidentally sets APP_ENV=development in production.
 */
export const isDevMode = (): boolean => {
  const appEnv = process.env.APP_ENV;
  const nodeEnv = process.env.NODE_ENV;
  const isDeployment = process.env.REPLIT_DEPLOYMENT === '1';
  
  // NEVER allow dev mode in a Replit deployment
  if (isDeployment) {
    return false;
  }
  
  // NEVER allow dev mode if NODE_ENV is 'production' (catches non-Replit prod deployments)
  if (nodeEnv === 'production') {
    return false;
  }
  
  return appEnv === 'development';
};

/**
 * Development admin user for testing
 * This user has full admin permissions and is only used in development mode
 * Includes all fields that routes might expect to avoid undefined errors
 */
const DEV_ADMIN_USER = {
  id: 'dev-admin-user-id',
  email: 'dev@thesandwichproject.org',
  firstName: 'Dev',
  lastName: 'Admin',
  displayName: 'Dev Admin',
  profileImageUrl: null,
  role: 'admin' as const,
  permissions: getDefaultPermissionsForRole('admin'),
  isActive: true,
  // Additional fields that some routes may expect
  metadata: {
    status: 'active',
  },
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date(),
  lastLoginAt: new Date(),
  phone: null,
  canReceiveSms: false,
  smsVerifiedAt: null,
};

/**
 * Basic authentication check middleware
 * Ensures user is logged in (has session)
 * 
 * In development mode (APP_ENV=development), auto-authenticates as dev admin
 * In production mode, requires real authentication
 */
export const isAuthenticated: RequestHandler = (req, res, next) => {
  // DEVELOPMENT MODE: Auto-authenticate as dev admin
  if (isDevMode()) {
    // Check if user is already authenticated (allow testing real auth flow)
    const existingUser = req.user || req.session?.user;
    if (!existingUser) {
      // Auto-authenticate as dev admin - set BOTH req.user AND req.session.user
      // to ensure compatibility with all downstream code paths
      req.user = DEV_ADMIN_USER;
      if (req.session) {
        req.session.user = DEV_ADMIN_USER;
      }
      logger.log('🔧 DEV MODE: Auto-authenticated as dev admin');
    } else {
      // User already authenticated, keep their session
      if (!req.user && req.session?.user) {
        req.user = req.session?.user;
      }
    }
    return next();
  }

  // PRODUCTION MODE: Require real authentication
  const user = req.user || req.session?.user;

  if (!user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  // Attach user to request if not already there
  if (!req.user && req.session?.user) {
    req.user = req.session?.user;
  }

  next();
};

// Global middleware to block inactive (pending approval) users
export const blockInactiveUsers: RequestHandler = async (req, res, next) => {
  try {
    // In dev mode, skip inactive user blocking
    if (isDevMode()) {
      return next();
    }

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
    ];

    // Check if the request method+path combination is allowed for inactive users
    const isAllowedRoute = allowedRoutes.some(
      route => route.method === req.method && req.path === route.path
    );
    
    // If user is inactive and trying to access a protected route, block them
    if (user && !user.isActive && !isAllowedRoute) {
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
};

// Single, authoritative requirePermission middleware
// DENIES ACCESS BY DEFAULT - only grants access if explicitly authorized
export const requirePermission = (permission: string): RequestHandler => {
  return async (req: any, res, next) => {
    try {
      // DEVELOPMENT MODE: Auto-grant all permissions
      if (isDevMode()) {
        // Ensure dev admin user is set on BOTH req.user and req.session.user
        if (!req.user) {
          req.user = DEV_ADMIN_USER;
          if (req.session) {
            req.session.user = DEV_ADMIN_USER;
          }
        }
        logger.log(`🔧 DEV MODE: Auto-granted permission ${permission}`);
        return next();
      }

      // STEP 1: Ensure user is authenticated - DENY if not
      const user = req.user || req.session?.user;
      if (!user) {
        logger.log(`❌ AUTH: No user context for ${permission} - DENIED`);
        return res.status(401).json({ message: 'Authentication required' });
      }

      // STEP 2: Fetch fresh user data to ensure current permissions
      let currentUser = user;
      if (user.email) {
        try {
          const freshUser = await storage.getUserByEmail(user.email);
          if (freshUser && freshUser.isActive) {
            currentUser = freshUser;
            req.user = freshUser;
          } else {
            logger.log(
              `❌ AUTH: User ${user.email} not found or inactive - DENIED`
            );
            return res
              .status(401)
              .json({ message: 'User account not found or inactive' });
          }
        } catch (dbError) {
          logger.error(
            'Database error fetching user in requirePermission:',
            dbError
          );
          // DENY access if we can't verify user status
          return res
            .status(500)
            .json({ message: 'Unable to verify user permissions' });
        }
      }

      // STEP 3: Use unified permission checking
      const permissionResult = checkPermission(currentUser, permission);
      
      if (permissionResult.granted) {
        logger.log(
          `✅ AUTH: ${permissionResult.reason} for ${permission} to ${currentUser.email}`
        );
        return next();
      }

      // DEFAULT: DENY ACCESS
      logger.log(
        `❌ AUTH: Permission ${permission} DENIED for ${currentUser.email} (role: ${currentUser.role})`
      );
      logger.log(`   Reason: ${permissionResult.reason}`);
      logger.log(`   Available permissions:`, permissionResult.userPermissions);
      
      return res.status(403).json({
        message: 'Insufficient permissions',
        required: permission,
        reason: permissionResult.reason,
        userRole: permissionResult.userRole,
        userPermissions: permissionResult.userPermissions || [],
      });
    } catch (error) {
      logger.error('❌ AUTH: Permission check failed:', error);
      // DENY access on any error
      return res.status(500).json({ message: 'Permission check failed' });
    }
  };
};

/**
 * SECURITY-CRITICAL: Ownership-aware permission checking middleware
 * 
 * This middleware enforces TWO levels of security:
 * 1. Fetches fresh user data from database to ensure current permissions
 * 2. Verifies BOTH ownership AND current permission at the moment of access
 * 
 * CRITICAL PROTECTION AGAINST:
 * - Users whose permissions were revoked after creating a resource
 * - Stale permission data from session/cache
 * - Race conditions between permission revocation and access
 * 
 * FLOW:
 * 1. Authenticate user
 * 2. FETCH FRESH user data from database (NOT from session/cache)
 * 3. Get resource owner ID
 * 4. Call checkOwnershipPermission with fresh user data
 *    - checkOwnershipPermission verifies ownership FIRST
 *    - Then verifies user CURRENTLY has the required permission
 *    - This ensures revoked permissions are enforced immediately
 * 
 * @param ownPermission - Permission required to access own resources
 * @param allPermission - Permission required to access all resources
 * @param getResourceUserId - Function to get the resource owner ID
 */
export const requireOwnershipPermission = (
  ownPermission: string,
  allPermission: string,
  getResourceUserId: (req: any) => Promise<string | null>
): RequestHandler => {
  return async (req: any, res, next) => {
    try {
      // DEVELOPMENT MODE: Auto-grant all permissions
      if (isDevMode()) {
        // Ensure dev admin user is set on BOTH req.user and req.session.user
        if (!req.user) {
          req.user = DEV_ADMIN_USER;
          if (req.session) {
            req.session.user = DEV_ADMIN_USER;
          }
        }
        logger.log(`🔧 DEV MODE: Auto-granted ownership permission ${allPermission}/${ownPermission}`);
        return next();
      }

      // STEP 1: Ensure user is authenticated
      const user = req.user || req.session?.user;
      if (!user) {
        logger.log(`❌ AUTH: No user context for ownership check - DENIED`);
        return res.status(401).json({ message: 'Authentication required' });
      }

      // STEP 2: SECURITY-CRITICAL - Fetch FRESH user data from database
      // This ensures we check CURRENT permissions, not stale session data
      // Prevents access by users whose permissions were revoked
      let currentUser = user;
      if (user.email) {
        try {
          const freshUser = await storage.getUserByEmail(user.email);
          if (freshUser && freshUser.isActive) {
            currentUser = freshUser;
            req.user = freshUser; // Update request with fresh data
            logger.log(`🔄 AUTH: Fetched fresh user data for ${freshUser.email}`);
          } else {
            logger.log(`❌ AUTH: User ${user.email} not found or inactive`);
            return res
              .status(401)
              .json({ message: 'User account not found or inactive' });
          }
        } catch (dbError) {
          logger.error('Database error in ownership check:', dbError);
          return res
            .status(500)
            .json({ message: 'Unable to verify user permissions' });
        }
      }

      // STEP 3: Get resource owner ID for ownership verification
      const resourceUserId = await getResourceUserId(req);
      
      // STEP 4: SECURITY-CRITICAL - Verify ownership AND current permissions
      // The checkOwnershipPermission function will:
      // - First verify if user owns the resource
      // - Then verify user CURRENTLY has the required permission
      // - This prevents revoked users from accessing their old resources
      const permissionResult = checkOwnershipPermission(
        currentUser, // Fresh user data with current permissions
        ownPermission,
        allPermission,
        resourceUserId || undefined
      );
      
      if (permissionResult.granted) {
        logger.log(
          `✅ AUTH: ${permissionResult.reason} for ${allPermission}/${ownPermission} to ${currentUser.email}`
        );
        return next();
      }

      // DEFAULT: DENY ACCESS
      logger.log(
        `❌ AUTH: Ownership permission DENIED for ${currentUser.email}`
      );
      logger.log(`   Reason: ${permissionResult.reason}`);
      logger.log(`   Resource owner: ${resourceUserId}, User ID: ${currentUser.id}`);
      
      return res.status(403).json({
        message: 'Insufficient permissions',
        required: `${allPermission} OR ${ownPermission}`,
        reason: permissionResult.reason,
        userRole: permissionResult.userRole,
        userPermissions: permissionResult.userPermissions || [],
      });
    } catch (error) {
      logger.error('❌ AUTH: Ownership check failed:', error);
      return res.status(500).json({ message: 'Permission check failed' });
    }
  };
};
