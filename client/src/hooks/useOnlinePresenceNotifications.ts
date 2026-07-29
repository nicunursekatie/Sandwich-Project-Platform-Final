import { useEffect, useRef, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { Socket } from 'socket.io-client';
import { logger } from '@/lib/logger';
import { getOrCreateSocket, onSocketConnect } from '@/lib/socket-singleton';

interface OnlineUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
  profileImageUrl: string | null;
  lastActiveAt: string | null;
}

interface WebSocketOnlineUser {
  id: string;
  userName: string;
}

interface UserOnlineEvent {
  id: string;
  userName: string;
  timestamp: string;
}

interface UserOfflineEvent {
  id: string;
  userName: string;
  timestamp: string;
}

function getDisplayName(user: OnlineUser): string {
  if (user.displayName) return user.displayName;
  if (user.firstName && user.lastName)
    return `${user.firstName} ${user.lastName}`;
  if (user.firstName) return user.firstName;
  if (user.email) return user.email.split('@')[0];
  return 'Someone';
}

const ONLINE_TOAST_THRESHOLD_MS = 15 * 60 * 1000;

/** True when lastActiveAt is within the online window (currently active). */
function wasRecentlyActive(lastActiveAt: string | null): boolean {
  if (!lastActiveAt) return false;
  return Date.now() - new Date(lastActiveAt).getTime() < ONLINE_TOAST_THRESHOLD_MS;
}

/** True when lastActiveAt is absent or older than the online window (was away). */
function wasOfflineLongEnough(lastActiveAt: string | null | undefined): boolean {
  if (!lastActiveAt) return true;
  return Date.now() - new Date(lastActiveAt).getTime() >= ONLINE_TOAST_THRESHOLD_MS;
}

export function useOnlinePresenceNotifications() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const previousOnlineIdsRef = useRef<Set<string>>(new Set());
  const previousLastActiveByUserRef = useRef<Map<string, string | null>>(new Map());
  const isFirstLoadRef = useRef(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsOnlineUsers, setWsOnlineUsers] = useState<Map<string, WebSocketOnlineUser>>(new Map());

  const sendHeartbeat = useCallback(async () => {
    if (!currentUser) return;
    try {
      await fetch('/api/users/heartbeat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // Silently ignore heartbeat errors
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, 2 * 60 * 1000);
    return () => clearInterval(heartbeatInterval);
  }, [currentUser, sendHeartbeat]);

  useEffect(() => {
    if (!currentUser) return;

    const sharedSocket = getOrCreateSocket();
    setSocket(sharedSocket);

    const userName = currentUser.firstName || currentUser.email || 'Anonymous';

    const handleConnect = () => {
      logger.log('[OnlinePresence] Connected via shared socket');
      setWsConnected(true);
      sharedSocket.emit('join-channel', {
        channel: 'presence',
        userId: String(currentUser.id),
        userName,
      });
      sharedSocket.emit('get-online-users');
    };

    const handleDisconnect = () => {
      logger.log('[OnlinePresence] Disconnected');
      setWsConnected(false);
    };

    const handleConnectError = (error: Error) => {
      logger.error('[OnlinePresence] Connection error:', error);
      setWsConnected(false);
    };

    const handleOnlineUsersList = (users: WebSocketOnlineUser[]) => {
      logger.log('[OnlinePresence] Received online users list:', users.length);
      const userMap = new Map<string, WebSocketOnlineUser>();
      users.forEach((u) => userMap.set(u.id, u));
      setWsOnlineUsers(userMap);

      if (isFirstLoadRef.current) {
        previousOnlineIdsRef.current = new Set(users.map((u) => u.id));
        isFirstLoadRef.current = false;
      }
    };

    const handleUserOnline = (data: UserOnlineEvent) => {
      logger.log('[OnlinePresence] User online:', data.userName, data.id);

      setWsOnlineUsers((prev) => {
        const updated = new Map(prev);
        updated.set(data.id, { id: data.id, userName: data.userName });
        return updated;
      });

      if (data.id !== String(currentUser.id) && !isFirstLoadRef.current) {
        if (!previousOnlineIdsRef.current.has(data.id)) {
          toast({
            title: `${data.userName} is now online`,
            description: 'A team member is active on the platform',
            duration: 4000,
          });
        }
      }

      previousOnlineIdsRef.current.add(data.id);

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/users/online'] });
      }, 250);
    };

    const handleUserOffline = (data: UserOfflineEvent) => {
      logger.log('[OnlinePresence] User offline:', data.userName, data.id);

      setWsOnlineUsers((prev) => {
        const updated = new Map(prev);
        updated.delete(data.id);
        return updated;
      });

      previousOnlineIdsRef.current.delete(data.id);

      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/users/online'] });
      }, 250);
    };

    setWsConnected(sharedSocket.connected);
    const offConnect = onSocketConnect(sharedSocket, handleConnect);

    sharedSocket.on('disconnect', handleDisconnect);
    sharedSocket.on('connect_error', handleConnectError);
    sharedSocket.on('online-users-list', handleOnlineUsersList);
    sharedSocket.on('user-online', handleUserOnline);
    sharedSocket.on('user-offline', handleUserOffline);

    return () => {
      offConnect();
      sharedSocket.off('disconnect', handleDisconnect);
      sharedSocket.off('connect_error', handleConnectError);
      sharedSocket.off('online-users-list', handleOnlineUsersList);
      sharedSocket.off('user-online', handleUserOnline);
      sharedSocket.off('user-offline', handleUserOffline);
      setSocket(null);
      setWsConnected(false);
    };
  }, [currentUser, toast, queryClient]);

  const { data: polledOnlineUsers = [] } = useQuery<OnlineUser[]>({
    queryKey: ['/api/users/online'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users/online');
      return Array.isArray(response) ? response : [];
    },
    refetchInterval: 5 * 60 * 1000,
    enabled: !!currentUser,
  });

  useEffect(() => {
    if (!currentUser || polledOnlineUsers.length === 0) return;

    if (wsConnected) {
      if (isFirstLoadRef.current) {
        isFirstLoadRef.current = false;
        previousOnlineIdsRef.current = new Set(polledOnlineUsers.map((u) => u.id));
        previousLastActiveByUserRef.current = new Map(
          polledOnlineUsers.map((u) => [u.id, u.lastActiveAt]),
        );
      }
      return;
    }

    const currentOnlineIds = new Set(polledOnlineUsers.map((u) => u.id));

    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      previousOnlineIdsRef.current = currentOnlineIds;
      previousLastActiveByUserRef.current = new Map(
        polledOnlineUsers.map((u) => [u.id, u.lastActiveAt]),
      );
      return;
    }

    const newUsers = polledOnlineUsers.filter((user) => {
      if (user.id === String(currentUser.id)) return false;
      if (previousOnlineIdsRef.current.has(user.id)) return false;
      if (!wasRecentlyActive(user.lastActiveAt)) return false;

      // Match server wasOfflineLongEnough: only toast when they were away before
      // this appearance (not a stale/partial poll diff). Use last snapshot we have
      // for this user — from when they dropped off the online list or never seen.
      const priorLastActive = previousLastActiveByUserRef.current.get(user.id);
      if (priorLastActive === undefined) {
        // First time we've tracked this user while polling — require current activity.
        return true;
      }
      return wasOfflineLongEnough(priorLastActive);
    });

    if (newUsers.length > 0) {
      if (newUsers.length === 1) {
        toast({
          title: `${getDisplayName(newUsers[0])} is now online`,
          description: 'A team member is active on the platform',
          duration: 4000,
        });
      } else if (newUsers.length <= 3) {
        const names = newUsers.map((u) => getDisplayName(u)).join(', ');
        toast({
          title: `${names} are now online`,
          description: `${newUsers.length} team members are active on the platform`,
          duration: 4000,
        });
      } else {
        toast({
          title: `${newUsers.length} people came online`,
          description: `${getDisplayName(newUsers[0])} and ${newUsers.length - 1} others are active on the platform`,
          duration: 4000,
        });
      }
    }

    previousOnlineIdsRef.current = currentOnlineIds;
    const nextLastActive = new Map(previousLastActiveByUserRef.current);
    for (const user of polledOnlineUsers) {
      nextLastActive.set(user.id, user.lastActiveAt);
    }
    previousLastActiveByUserRef.current = nextLastActive;
  }, [polledOnlineUsers, currentUser, toast, wsConnected]);

  return {
    onlineUsers: polledOnlineUsers,
    wsConnected,
    wsOnlineUserCount: wsOnlineUsers.size,
  };
}
