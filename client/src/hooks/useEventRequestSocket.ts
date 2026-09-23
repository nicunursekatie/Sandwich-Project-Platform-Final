import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getOrCreateSocket } from '@/lib/socket-singleton';
import { logger } from '@/lib/logger';
import { useToast } from './use-toast';
import {
  invalidateEventRequestQueries,
  applyEventRequestUpdateById,
} from '@/lib/queryClient';

/**
 * Listen for Event Request creates/updates/deletes on the default socket
 * (already used by apiRequest's X-Socket-Id echo skip).
 *
 * Safe to mount from Dashboard and Event Requests at the same time — listeners
 * attach once. Visibility/focus refetch is left to EVENT_REQUEST_LIST_FRESHNESS
 * so waking a phone does not fire this helper and TanStack Query together.
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

  socket.on('event_request_created', handleEventCreated);
  socket.on('event_request_updated', handleEventUpdated);
  socket.on('event_request_deleted', handleEventDeleted);

  return () => {
    socket.off('event_request_created', handleEventCreated);
    socket.off('event_request_updated', handleEventUpdated);
    socket.off('event_request_deleted', handleEventDeleted);
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
