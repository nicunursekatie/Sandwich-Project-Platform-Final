import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getOrCreateSocket } from '@/lib/socket-singleton';
import { logger } from '@/lib/logger';
import { useToast } from './use-toast';
import { invalidateEventRequestQueries } from '@/lib/queryClient';

/**
 * Hook that listens for real-time event request updates via Socket.IO
 * Automatically invalidates event request queries when new events are created
 */
export function useEventRequestSocket() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    const socket = getOrCreateSocket();

    const handleEventCreated = (eventRequest: any) => {
      logger.log('[EventRequestSocket] New event request created:', eventRequest.id);

      // Invalidate all event request queries to trigger refetch
      invalidateEventRequestQueries(queryClient);

      // Show toast notification
      toast({
        title: 'New Event Added',
        description: `${eventRequest.organizationName || 'New event'} has been added from Google Sheets`,
      });
    };

    const handleEventUpdated = (eventRequest: any) => {
      // Ignore the echo of our OWN save. Every mutation already refreshes the UI
      // locally (invalidate in onSuccess/onSettled), so re-invalidating here just
      // triggers a redundant full refetch that can reset an open form mid-edit.
      // Updates from other users/tabs/background sync carry a different socket id
      // (or none) and still refresh exactly as before.
      if (
        eventRequest?.originSocketId &&
        socket.id &&
        eventRequest.originSocketId === socket.id
      ) {
        logger.log('[EventRequestSocket] Ignoring own update echo for', eventRequest.id);
        return;
      }
      logger.log('[EventRequestSocket] Event request updated:', eventRequest.id);
      invalidateEventRequestQueries(queryClient);
    };

    const handleEventDeleted = (data: { id: number }) => {
      logger.log('[EventRequestSocket] Event request deleted:', data.id);
      invalidateEventRequestQueries(queryClient);
    };

    // Subscribe to events
    socket.on('event_request_created', handleEventCreated);
    socket.on('event_request_updated', handleEventUpdated);
    socket.on('event_request_deleted', handleEventDeleted);

    return () => {
      // Cleanup listeners
      socket.off('event_request_created', handleEventCreated);
      socket.off('event_request_updated', handleEventUpdated);
      socket.off('event_request_deleted', handleEventDeleted);
    };
  }, [queryClient, toast]);
}
