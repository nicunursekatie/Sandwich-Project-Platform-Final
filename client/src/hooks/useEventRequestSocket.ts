import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getOrCreateSocket } from '@/lib/socket-singleton';
import { logger } from '@/lib/logger';
import { useToast } from './use-toast';
import {
  invalidateEventRequestQueries,
  applyEventRequestUpdateById,
  refreshEventRequestListAndCounts,
} from '@/lib/queryClient';

/**
 * Listen for Event Request creates/updates/deletes on the default socket
 * (already used by apiRequest's X-Socket-Id echo skip).
 *
 * Safe to mount from Dashboard and Event Requests at the same time — listeners
 * attach once. Also refetches list + counts when the tab becomes visible again
 * so a phone that missed socket events while backgrounded catches up.
 */
let attachCount = 0;
let detachListeners: (() => void) | null = null;

function attachEventRequestSocketListeners(
  queryClient: ReturnType<typeof useQueryClient>,
  toast: ReturnType<typeof useToast>['toast'],
): () => void {
  const socket = getOrCreateSocket();

  const handleEventCreated = (eventRequest: any) => {
    logger.log('[EventRequestSocket] New event request created:', eventRequest.id);
    invalidateEventRequestQueries(queryClient);
    toast({
      title: 'New Event Added',
      description: `${eventRequest.organizationName || 'New event'} has been added from Google Sheets`,
    });
  };

  const handleEventUpdated = (eventRequest: { id: number; originSocketId?: string }) => {
    if (
      eventRequest?.originSocketId &&
      socket.id &&
      eventRequest.originSocketId === socket.id
    ) {
      logger.log('[EventRequestSocket] Ignoring own update echo for', eventRequest.id);
      return;
    }
    logger.log('[EventRequestSocket] Event request updated:', eventRequest.id);
    void applyEventRequestUpdateById(queryClient, eventRequest.id);
  };

  const handleEventDeleted = (data: { id: number }) => {
    logger.log('[EventRequestSocket] Event request deleted:', data.id);
    invalidateEventRequestQueries(queryClient);
  };

  let lastVisibilityRefresh = 0;
  const handleVisibility = () => {
    if (document.visibilityState !== 'visible') return;
    const now = Date.now();
    if (now - lastVisibilityRefresh < 2000) return;
    lastVisibilityRefresh = now;
    void refreshEventRequestListAndCounts(queryClient);
  };

  socket.on('event_request_created', handleEventCreated);
  socket.on('event_request_updated', handleEventUpdated);
  socket.on('event_request_deleted', handleEventDeleted);
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    socket.off('event_request_created', handleEventCreated);
    socket.off('event_request_updated', handleEventUpdated);
    socket.off('event_request_deleted', handleEventDeleted);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}

export function useEventRequestSocket() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    attachCount += 1;
    if (attachCount === 1) {
      detachListeners = attachEventRequestSocketListeners(queryClient, toast);
    }
    return () => {
      attachCount -= 1;
      if (attachCount === 0) {
        detachListeners?.();
        detachListeners = null;
      }
    };
  }, [queryClient, toast]);
}
