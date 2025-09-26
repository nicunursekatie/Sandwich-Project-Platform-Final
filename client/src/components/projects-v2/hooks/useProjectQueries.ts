import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User } from '@shared/schema';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission, PERMISSIONS } from '@shared/auth-utils';

type ProjectUser = Pick<
  User,
  'id' | 'email' | 'firstName' | 'lastName' | 'displayName'
> &
  Partial<User>;

export const useProjectQueries = () => {
  const { user: currentUser } = useAuth();
  const canManageUsers = hasPermission(currentUser, PERMISSIONS.USERS_EDIT);

  // Fetch users for assignee selection and display (admin-only)
  const {
    data: adminUsers = [],
    isLoading: adminUsersLoading,
  } = useQuery<User[]>({
    queryKey: ['/api/users'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    enabled: canManageUsers,
  });

  // Fetch users specifically for assignments (might have different permissions)
  const {
    data: usersForAssignments = [],
    isLoading: assignmentsLoading,
  } = useQuery<ProjectUser[]>({
    queryKey: ['/api/users/for-assignments'],
    staleTime: 5 * 60 * 1000,
  });

  const userLookup = useMemo(() => {
    const map = new Map<string, ProjectUser>();

    usersForAssignments.forEach((assignmentUser) => {
      if (!assignmentUser?.id) return;
      map.set(assignmentUser.id.toString(), assignmentUser);
    });

    if (canManageUsers) {
      adminUsers.forEach((adminUser) => {
        if (!adminUser?.id) return;
        map.set(adminUser.id.toString(), adminUser);
      });
    }

    return map;
  }, [usersForAssignments, adminUsers, canManageUsers]);

  // Helper function to get user by ID
  const getUserById = (
    userId: string | number | null | undefined
  ): ProjectUser | undefined => {
    if (userId === null || userId === undefined) return undefined;
    return userLookup.get(userId.toString());
  };

  // Helper function to get user display name
  const getUserDisplayName = (userId: string | number): string => {
    const user = getUserById(userId);
    if (!user) {
      return userId ? userId.toString() : 'Unknown';
    }

    if (user.displayName) {
      return user.displayName;
    }

    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    if (name) return name;

    if (user.email) return user.email;

    return `User ${user.id}`;
  };

  // Helper function to get multiple users by IDs
  const getUsersByIds = (userIds: (string | number)[]): ProjectUser[] => {
    return userIds
      .map(id => getUserById(id))
      .filter((user): user is ProjectUser => user !== undefined);
  };

  // Parse comma-separated names or IDs
  const parseAssignees = (assigneeString: string): string[] => {
    if (!assigneeString) return [];
    return assigneeString.split(',').map(s => s.trim()).filter(Boolean);
  };

  return {
    users: canManageUsers ? adminUsers : usersForAssignments,
    usersForAssignments,
    usersLoading: canManageUsers ? adminUsersLoading : assignmentsLoading,
    assignmentsLoading,
    getUserById,
    getUserDisplayName,
    getUsersByIds,
    parseAssignees,
  };
};