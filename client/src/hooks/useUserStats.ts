import { useMemo } from 'react';
import { USER_ROLES } from '@shared/auth-utils';

interface User {
  id: string;
  role: string;
  isActive: boolean;
}

export function useUserStats(users: User[]) {
  const userStats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u: User) => u.isActive).length,
      inactive: users.filter((u: User) => !u.isActive).length,
      byRole: Object.values(USER_ROLES).reduce(
        (acc, role) => {
          acc[role] = users.filter((u: User) => u.role === role).length;
          return acc;
        },
        {} as Record<string, number>
      ),
    };
  }, [users]);

  return userStats;
}
