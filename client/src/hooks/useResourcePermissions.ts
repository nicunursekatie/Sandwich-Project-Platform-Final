import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission, PERMISSIONS } from '@shared/auth-utils';

/**
 * Custom hook for checking common CRUD permissions for a resource.
 * Eliminates repetitive permission checking code across components.
 *
 * @param resource - The resource name (e.g., 'VOLUNTEERS', 'HOSTS', 'RECIPIENTS')
 * @returns Object with canView, canAdd, canEdit, canDelete boolean flags
 *
 * @example
 * const permissions = useResourcePermissions('VOLUNTEERS');
 * if (permissions.canEdit) { ... }
 */
export function useResourcePermissions(resource: string) {
  const { user } = useAuth();

  return useMemo(() => {
    // Build permission keys dynamically
    const viewKey = `${resource}_VIEW` as keyof typeof PERMISSIONS;
    const addKey = `${resource}_ADD` as keyof typeof PERMISSIONS;
    const editKey = `${resource}_EDIT` as keyof typeof PERMISSIONS;
    const deleteKey = `${resource}_DELETE` as keyof typeof PERMISSIONS;

    return {
      canView: hasPermission(user, PERMISSIONS[viewKey]),
      canAdd: hasPermission(user, PERMISSIONS[addKey]),
      canEdit: hasPermission(user, PERMISSIONS[editKey]),
      canDelete: hasPermission(user, PERMISSIONS[deleteKey]),
    };
  }, [user, resource]);
}

/**
 * Custom hook for checking specific custom permissions.
 * Use this for non-standard permission patterns.
 *
 * @param permissionKeys - Array of permission keys to check
 * @returns Object mapping permission keys to boolean values
 *
 * @example
 * const { VOLUNTEERS_VIEW, VOLUNTEERS_EXPORT } = usePermissions(['VOLUNTEERS_VIEW', 'VOLUNTEERS_EXPORT']);
 */
export function usePermissions(permissionKeys: string[]) {
  const { user } = useAuth();

  return useMemo(() => {
    const result: Record<string, boolean> = {};
    permissionKeys.forEach(key => {
      result[key] = hasPermission(user, PERMISSIONS[key as keyof typeof PERMISSIONS]);
    });
    return result;
  }, [user, permissionKeys]);
}
