/**
 * Unified Permission System
 *
 * This module provides consistent permission checking logic for both
 * frontend and backend. It replaces the inconsistent hasPermission()
 * and requirePermission() implementations with a single, authoritative
 * permission checking system.
 */

import { PERMISSIONS, USER_ROLES, applyPermissionDependencies } from './auth-utils';
import type { UserForPermissions } from './types';

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
export function checkPermission(user: UserForPermissions | null | undefined, permission: string): PermissionCheckResult {
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

  // Step 1.5: Universal permissions - all authenticated users have these
  if (permission === 'VOLUNTEERS_VIEW') {
    return {
      granted: true,
      reason: 'Universal permission (all users have access)',
      userRole: user.role,
      userPermissions: ['VOLUNTEERS_VIEW']
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

  // Step 3: Extract user permissions (arrays only - numeric format not supported)
  let userPermissions: string[] = [];

  if (Array.isArray(user.permissions)) {
    userPermissions = user.permissions;
  } else if (user.permissions === null || user.permissions === undefined) {
    userPermissions = [];
  } else if (typeof user.permissions === 'number') {
    // SECURITY: Numeric bitmask permissions are NOT supported in unified-auth-utils
    // They must be migrated to string array format
    // Rejecting access forces proper migration rather than creating security holes
    console.error(`🚨 SECURITY: User ${user.id} has unsupported numeric permission format (${user.permissions}). Permission denied. Must migrate to array format.`);
    return {
      granted: false,
      reason: 'Numeric permission format not supported - must migrate to array format',
      userRole: user.role,
      userPermissions: []
    };
  } else {
    // Unknown format - reject
    return {
      granted: false,
      reason: `Unsupported permission format: ${typeof user.permissions}. Expected array.`,
      userRole: user.role,
      userPermissions: []
    };
  }

  // Step 3.5: Admin backward compatibility for new navigation and event permissions
  if (user.role === 'admin') {
    if (permission.startsWith('NAV_') || 
        permission === 'ADMIN_PANEL_ACCESS' ||
        permission.startsWith('EVENT_REQUESTS_') ||
        permission.startsWith('DOCUMENTS_')) {
      return {
        granted: true,
        reason: 'Admin role automatic access (backward compatibility)',
        userRole: user.role,
        userPermissions: userPermissions
      };
    }
  }

  // Step 4: Apply permission dependencies and check for permission match
  // This handles cases where users have NAV_* permissions but not the underlying functional permissions
  const effectivePermissions = applyPermissionDependencies(userPermissions);
  
  if (effectivePermissions.includes(permission)) {
    return {
      granted: true,
      reason: 'Permission granted',
      userRole: user.role,
      userPermissions: effectivePermissions
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
export function hasPermission(user: UserForPermissions | null | undefined, permission: string): boolean {
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
  user: UserForPermissions | null | undefined,
  ownPermission: string,
  allPermission: string,
  resourceOwnerId?: string | string[] | null
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
    const normalizedOwnerIds = Array.isArray(resourceOwnerId)
      ? resourceOwnerId.filter((id) => typeof id === 'string' && id)
      : resourceOwnerId
        ? [resourceOwnerId]
        : [];

    if (normalizedOwnerIds.length === 0) {
      return {
        granted: false,
        reason: 'Resource owner ID required for ownership check',
        userRole: user?.role,
        userPermissions: ownResult.userPermissions
      };
    }

    if (normalizedOwnerIds.includes(user?.id ?? '')) {
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
  return allPermissions.includes(permission);
}

/**
 * Get all permissions for a user (with validation)
 */
export function getUserPermissions(user: UserForPermissions | null | undefined): string[] {
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
 * Debug info structure for permission debugging
 */
export interface PermissionDebugInfo {
  userId: string;
  userRole: string;
  userPermissions: string[];
  isActive: boolean | string;
  permissionFormat: string;
  permissionCheck?: {
    permission: string;
    granted: boolean;
    reason: string;
  };
}

/**
 * Debug helper - get detailed permission info for troubleshooting
 */
export function debugPermissions(user: UserForPermissions | null | undefined, permission?: string): PermissionDebugInfo {
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
