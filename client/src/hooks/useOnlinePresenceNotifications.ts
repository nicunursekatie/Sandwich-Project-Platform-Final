import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface OnlineUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
  profileImageUrl: string | null;
  lastActiveAt: string | null;
}

function getDisplayName(user: OnlineUser): string {
  if (user.displayName) return user.displayName;
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
  if (user.firstName) return user.firstName;
  if (user.email) return user.email.split('@')[0];
  return 'Someone';
}

export function useOnlinePresenceNotifications() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const previousOnlineIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  const { data: onlineUsers = [] } = useQuery<OnlineUser[]>({
    queryKey: ['/api/users/online'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users/online');
      return response;
    },
    refetchInterval: 30000, // Check every 30 seconds
    enabled: !!currentUser,
  });

  useEffect(() => {
    if (!currentUser || onlineUsers.length === 0) return;

    const currentOnlineIds = new Set(onlineUsers.map(u => u.id));

    // Skip notifications on first load
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      previousOnlineIdsRef.current = currentOnlineIds;
      return;
    }

    // Find new users who weren't online before
    const newUsers = onlineUsers.filter(
      user =>
        user.id !== currentUser.id &&
        !previousOnlineIdsRef.current.has(user.id)
    );

    // Show toast for each new user (limit to avoid spam)
    if (newUsers.length > 0) {
      if (newUsers.length === 1) {
        toast({
          title: `${getDisplayName(newUsers[0])} is now online`,
          description: "A team member just signed in",
          duration: 4000,
        });
      } else if (newUsers.length <= 3) {
        const names = newUsers.map(u => getDisplayName(u)).join(', ');
        toast({
          title: `${names} are now online`,
          description: `${newUsers.length} team members just signed in`,
          duration: 4000,
        });
      } else {
        toast({
          title: `${newUsers.length} people came online`,
          description: `${getDisplayName(newUsers[0])} and ${newUsers.length - 1} others just signed in`,
          duration: 4000,
        });
      }
    }

    // Update previous state
    previousOnlineIdsRef.current = currentOnlineIds;
  }, [onlineUsers, currentUser, toast]);

  return { onlineUsers };
}
