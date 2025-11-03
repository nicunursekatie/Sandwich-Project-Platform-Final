import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { logger } from '@/lib/logger';

interface Message {
  id: number;
  senderId: string;
  content: string;
  senderName?: string;
  senderEmail?: string;
  createdAt: string;
  updatedAt: string;
  editedAt?: string;
  deletedAt?: string;
}

/**
 * Lightweight hook to fetch messages for a specific event context.
 * Unlike useMessaging(), this hook does NOT create WebSocket connections
 * or set up notification handlers, making it safe to use in multiple
 * components without creating duplicate connections.
 */
export function useEventMessages(eventId: string | undefined) {
  return useQuery<Message[]>({
    queryKey: ['event-messages', eventId],
    queryFn: async () => {
      if (!eventId) {
        return [];
      }

      try {
        const response = await apiRequest(
          'GET',
          `/api/messaging/context/event/${eventId}`
        );
        return response.messages || [];
      } catch (error) {
        logger.error('Failed to fetch event messages:', error);
        return [];
      }
    },
    enabled: !!eventId,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 25000, // Consider data stale after 25 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}
