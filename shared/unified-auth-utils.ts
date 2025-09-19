/**
 * Unified Permission System
 * 
 * This module provides consistent permission checking logic for both
 * frontend and backend. It replaces the inconsistent hasPermission()
 * and requirePermission() implementations with a single, authoritative
 * permission checking system.
 */

import { PERMISSIONS, USER_ROLES } from './auth-utils';

export interface User {
  id: string;
  email?: string;
  role: string;
  permissions: string[] | number | null | undefined;
  isActive?: boolean;
}

export interface PermissionCheckResult {
  granted: boolean;
  reason: string;
  userRole?: string;
  userPermissions?: string[];
}

/**
 * Core permission checking logic - used by both frontend and backend
 * 
 * This function is STRICT by design:
 * - No case-insensitive fallbacks (permissions must match exactly)
 * - No bitmask support (only arrays)
 * - Clear, predictable behavior
 */
export function checkPermission(user: User | null | undefined, permission: string): PermissionCheckResult {
  // Step 1: Validate inputs
  if (!user) {
    return {
      granted: false,
      reason: 'No user provided'
    };
  }

  if (!permission || typeof permission !== 'string') {
    return {
      granted: false,
      reason: 'Invalid permission string'
    };
  }

  if (user.isActive === false) {
    return {
      granted: false,
      reason: 'User account is inactive'
    };
  }

  // Step 2: Super admin bypass
  if (user.role === 'super_admin' || user.role === USER_ROLES.SUPER_ADMIN) {
    return {
      granted: true,
      reason: 'Super admin access',
      userRole: user.role,
      userPermissions: ['*ALL*']
    };
  }

  // Step 3: Extract user permissions (arrays only)
  let userPermissions: string[] = [];
  
  if (Array.isArray(user.permissions)) {
    userPermissions = user.permissions;
  } else if (user.permissions === null || user.permissions === undefined) {
    userPermissions = [];
  } else {
    // Reject bitmask or other formats - they should be migrated
    return {
      granted: false,
      reason: `Unsupported permission format: ${typeof user.permissions}. Expected array.`,
      userRole: user.role,
      userPermissions: []
    };
  }

  // Step 4: Check for exact permission match
  if (userPermissions.includes(permission)) {
    return {
      granted: true,
      reason: 'Permission granted',
      userRole: user.role,
      userPermissions: userPermissions
    };
  }

  // Step 5: Permission denied
  return {
    granted: false,
    reason: `Permission '${permission}' not found in user permissions`,
    userRole: user.role,
    userPermissions: userPermissions
  };
}

/**
 * Frontend-compatible hasPermission function
 * Uses the unified checkPermission logic
 */
export function hasPermission(user: any, permission: string): boolean {
  const result = checkPermission(user, permission);
  return result.granted;
}

/**
 * Enhanced permission checker with ownership support
 * 
 * @param user - User object
 * @param ownPermission - Permission needed to access own resources (e.g., 'COLLECTIONS_EDIT_OWN')
 * @param allPermission - Permission needed to access all resources (e.g., 'COLLECTIONS_EDIT_ALL')
 * @param resourceOwnerId - ID of the resource owner
 * @returns PermissionCheckResult
 */
export function checkOwnershipPermission(
  user: User | null | undefined,
  ownPermission: string,
  allPermission: string,
  resourceOwnerId?: string
): PermissionCheckResult {
  
  // Check for "ALL" permission first
  const allResult = checkPermission(user, allPermission);
  if (allResult.granted) {
    return {
      ...allResult,
      reason: 'All-access permission granted'
    };
  }

  // Check for "OWN" permission with ownership verification
  const ownResult = checkPermission(user, ownPermission);
  if (ownResult.granted) {
    if (!resourceOwnerId) {
      return {
        granted: false,
        reason: 'Resource owner ID required for ownership check',
        userRole: user?.role,
        userPermissions: ownResult.userPermissions
      };
    }

    if (user?.id === resourceOwnerId) {
      return {
        ...ownResult,
        reason: 'Own-resource permission granted'
      };
    } else {
      return {
        granted: false,
        reason: 'User does not own this resource',
        userRole: user?.role,
        userPermissions: ownResult.userPermissions
      };
    }
  }

  // Neither permission granted
  return {
    granted: false,
    reason: `Neither '${allPermission}' nor '${ownPermission}' permissions found`,
    userRole: user?.role,
    userPermissions: allResult.userPermissions
  };
}

/**
 * Validate permission string format
 * Ensures permissions follow RESOURCE_ACTION pattern
 */
export function validatePermissionFormat(permission: string): boolean {
  if (typeof permission !== 'string' || !permission) {
    return false;
  }

  // Check if it's a known permission
  const allPermissions = Object.values(PERMISSIONS);
  return allPermissions.includes(permission as any);
}

/**
 * Get all permissions for a user (with validation)
 */
export function getUserPermissions(user: User | null | undefined): string[] {
  const result = checkPermission(user, 'DUMMY_PERMISSION'); // Just to validate user
  
  if (!user || !result.userPermissions) {
    return [];
  }

  if (user.role === 'super_admin' || user.role === USER_ROLES.SUPER_ADMIN) {
    return Object.values(PERMISSIONS);
  }

  return result.userPermissions;
}

/**
 * Debug helper - get detailed permission info for troubleshooting
 */
export function debugPermissions(user: User | null | undefined, permission?: string): any {
  const baseInfo = {
    userId: user?.id || 'N/A',
    userRole: user?.role || 'N/A',
    userPermissions: getUserPermissions(user),
    isActive: user?.isActive ?? 'N/A',
    permissionFormat: Array.isArray(user?.permissions) 
      ? 'array' 
      : typeof user?.permissions
  };

  if (permission) {
    const result = checkPermission(user, permission);
    return {
      ...baseInfo,
      permissionCheck: {
        permission,
        granted: result.granted,
        reason: result.reason
      }
    };
  }

  return baseInfo;
}
