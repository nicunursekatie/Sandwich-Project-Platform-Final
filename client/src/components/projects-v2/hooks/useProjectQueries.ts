import { useQuery } from '@tanstack/react-query';
import { User } from '@shared/schema';

export const useProjectQueries = () => {
  // Fetch users for assignee selection and display
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch users specifically for assignments (might have different permissions)
  const { data: usersForAssignments = [], isLoading: assignmentsLoading } = useQuery<User[]>({
    queryKey: ['/api/users/for-assignments'],
    staleTime: 5 * 60 * 1000,
  });

  // Helper function to get user by ID
  const getUserById = (userId: string | number): User | undefined => {
    return users.find((u) => u.id === userId?.toString());
  };

  // Helper function to get user display name
  const getUserDisplayName = (userId: string | number): string => {
    const user = getUserById(userId);
    if (!user) return 'Unknown';

    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return name || user.email || 'Unknown';
  };

  // Helper function to get multiple users by IDs
  const getUsersByIds = (userIds: (string | number)[]): User[] => {
    return userIds
      .map(id => getUserById(id))
      .filter((user): user is User => user !== undefined);
  };

  // Parse comma-separated names or IDs
  const parseAssignees = (assigneeString: string): string[] => {
    if (!assigneeString) return [];
    return assigneeString.split(',').map(s => s.trim()).filter(Boolean);
  };

  return {
    users,
    usersForAssignments,
    usersLoading,
    assignmentsLoading,
    getUserById,
    getUserDisplayName,
    getUsersByIds,
    parseAssignees,
  };
};