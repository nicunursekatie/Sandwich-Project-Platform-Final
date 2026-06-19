import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { queryClient } from '@/lib/queryClient';
import { logger } from '@/lib/logger';
import { getOrCreateSocket, onSocketConnect } from '@/lib/socket-singleton';

interface NotificationActionEvent {
  notificationId: number;
  actionType: string;
  actionStatus: 'success' | 'failed';
  userId: string;
  result?: any;
}

interface NotificationCreatedEvent {
  notification: any;
  priority: string;
}

export function useNotificationSocket() {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) return;

    const sharedSocket = getOrCreateSocket();
    setSocket(sharedSocket);

    const handleConnect = () => {
      logger.log('[NotificationSocket] Connected via shared socket');
      setConnected(true);
      sharedSocket.emit('join-notification-channel', {
        userId: user.id,
        userName: user.firstName || user.email,
      });
    };

    const handleDisconnect = () => {
      logger.log('[NotificationSocket] Disconnected');
      setConnected(false);
    };

    const handleConnectError = (error: Error) => {
      logger.error('[NotificationSocket] Connection error:', error);
      setConnected(false);
    };

    const handleActionCompleted = (data: NotificationActionEvent) => {
      logger.log('[NotificationSocket] Action completed:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/counts'] });
    };

    const handleNotificationCreated = (data: NotificationCreatedEvent) => {
      logger.log('[NotificationSocket] New notification:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/counts'] });
    };

    const handleNotificationUpdated = (data: { notificationId: number; changes: any }) => {
      logger.log('[NotificationSocket] Notification updated:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/counts'] });
    };

    const handleNotificationUpdate = (data: { type?: string; channelId?: string; channelName?: string }) => {
      logger.log('[NotificationSocket] Notification update (e.g. new chat message):', data);
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/counts'] });
    };

    setConnected(sharedSocket.connected);
    const offConnect = onSocketConnect(sharedSocket, handleConnect);

    sharedSocket.on('disconnect', handleDisconnect);
    sharedSocket.on('connect_error', handleConnectError);
    sharedSocket.on('notification-action-completed', handleActionCompleted);
    sharedSocket.on('notification-created', handleNotificationCreated);
    sharedSocket.on('notification-updated', handleNotificationUpdated);
    sharedSocket.on('notification_update', handleNotificationUpdate);

    return () => {
      offConnect();
      sharedSocket.off('disconnect', handleDisconnect);
      sharedSocket.off('connect_error', handleConnectError);
      sharedSocket.off('notification-action-completed', handleActionCompleted);
      sharedSocket.off('notification-created', handleNotificationCreated);
      sharedSocket.off('notification-updated', handleNotificationUpdated);
      sharedSocket.off('notification_update', handleNotificationUpdate);
      setSocket(null);
      setConnected(false);
    };
  }, [user]);

  return {
    socket,
    connected,
  };
}
