import type { RequestHandler } from 'express';
import { storage } from '../storage-wrapper';
import { PERMISSIONS } from '../../shared/auth-utils';
import { checkPermission, checkOwnershipPermission } from '../../shared/unified-auth-utils';
import { logger } from '../utils/production-safe-logger';

// Global middleware to block inactive (pending approval) users
export const blockInactiveUsers: RequestHandler = async (req, res, next) => {
  try {
    // Allow unauthenticated requests to proceed (they'll be caught by other auth checks)
    if (!req.user && !req.session?.user) {
      return next();
    }

    const user = req.user || req.session?.user;
    
    // Define paths that pending users CAN access
    const allowedPaths = [
      '/api/auth/',
      '/api/user/me',
      '/api/user/profile',
      '/healthz',
      '/api/login',
      '/api/logout',
    ];

    // Check if the request path is allowed for inactive users
    const isAllowedPath = allowedPaths.some(path => req.path.startsWith(path));
    
    // If user is inactive and trying to access a protected route, block them
    if (user && !user.isActive && !isAllowedPath) {
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

// Helper function for ownership-aware permission checks
export const requireOwnershipPermission = (
  ownPermission: string,
  allPermission: string,
  getResourceUserId: (req: any) => Promise<string | null>
): RequestHandler => {
  return async (req: any, res, next) => {
    try {
      // STEP 1: Ensure user is authenticated
      const user = req.user || req.session?.user;
      if (!user) {
        logger.log(`❌ AUTH: No user context for ownership check - DENIED`);
        return res.status(401).json({ message: 'Authentication required' });
      }

      // STEP 2: Fetch fresh user data
      let currentUser = user;
      if (user.email) {
        try {
          const freshUser = await storage.getUserByEmail(user.email);
          if (freshUser && freshUser.isActive) {
            currentUser = freshUser;
            req.user = freshUser;
          } else {
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

      // STEP 3: Get resource owner ID for ownership check
      const resourceUserId = await getResourceUserId(req);
      
      // STEP 4: Use unified ownership permission checking
      const permissionResult = checkOwnershipPermission(
        currentUser,
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
