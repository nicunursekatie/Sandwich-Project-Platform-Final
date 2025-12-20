import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getOrCreateSocket } from '@/lib/socket-singleton';
import { logger } from '@/lib/logger';
import { useToast } from './use-toast';

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
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });

      // Show toast notification
      toast({
        title: 'New Event Added',
        description: `${eventRequest.organizationName || 'New event'} has been added from Google Sheets`,
      });
    };

    const handleEventUpdated = (eventRequest: any) => {
      logger.log('[EventRequestSocket] Event request updated:', eventRequest.id);
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
    };

    const handleEventDeleted = (data: { id: number }) => {
      logger.log('[EventRequestSocket] Event request deleted:', data.id);
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests'] });
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
