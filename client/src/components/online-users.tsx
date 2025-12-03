import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Users } from 'lucide-react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface OnlineUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
  profileImageUrl: string | null;
  lastActiveAt: string | null;
}

function getInitials(user: OnlineUser): string {
  if (user.displayName) {
    return user.displayName.substring(0, 2).toUpperCase();
  }
  if (user.firstName && user.lastName) {
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  }
  if (user.firstName) {
    return user.firstName.substring(0, 2).toUpperCase();
  }
  if (user.email) {
    return user.email.substring(0, 2).toUpperCase();
  }
  return 'U';
}

function getDisplayName(user: OnlineUser): string {
  if (user.displayName) return user.displayName;
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
  if (user.firstName) return user.firstName;
  if (user.email) return user.email.split('@')[0];
  return 'User';
}

function getTimeAgo(lastActiveAt: string | null): string {
  if (!lastActiveAt) return 'Unknown';
  const now = new Date();
  const lastActive = new Date(lastActiveAt);
  const diffMs = now.getTime() - lastActive.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins === 1) return '1 min ago';
  if (diffMins < 60) return `${diffMins} mins ago`;
  return 'Over an hour ago';
}

export function OnlineUsers() {
  const { data: onlineUsers = [], isLoading } = useQuery<OnlineUser[]>({
    queryKey: ['/api/users/online'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users/online');
      return response;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const count = onlineUsers.length;

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <button
          className="p-2 rounded-lg transition-colors relative z-50 pointer-events-auto touch-manipulation min-w-[44px] text-teal-600 hover:bg-teal-50 hover:text-teal-800 flex items-center gap-1"
          title={`${count} user${count !== 1 ? 's' : ''} online`}
          aria-label={`${count} users online`}
        >
          <Users className="w-4 h-4 sm:w-5 sm:h-5" />
          {count > 0 && (
            <Badge
              variant="secondary"
              className="h-5 min-w-[20px] text-xs bg-green-100 text-green-700 border-green-200"
            >
              {count}
            </Badge>
          )}
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        className="w-72 p-0"
        align="end"
        sideOffset={8}
      >
        <div className="p-3 border-b bg-gradient-to-r from-teal-50 to-cyan-50">
          <h4 className="font-semibold text-teal-800 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Online Now
          </h4>
          <p className="text-xs text-teal-600 mt-0.5">
            {count} team member{count !== 1 ? 's' : ''} active
          </p>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-slate-500">
              Loading...
            </div>
          ) : count === 0 ? (
            <div className="p-4 text-center text-sm text-slate-500">
              No one else is online right now
            </div>
          ) : (
            <ul className="divide-y">
              {onlineUsers.map((user) => (
                <li
                  key={user.id}
                  className="p-3 hover:bg-slate-50 flex items-center gap-3"
                >
                  <div className="relative">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-teal-100 text-teal-700 text-xs">
                        {getInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {getDisplayName(user)}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {getTimeAgo(user.lastActiveAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export default OnlineUsers;
