import { useCallback, useEffect, useRef } from 'react';
import type { EventRequest } from '@shared/schema';
import { markEventRequestViewed } from '@/lib/event-request-viewed';

/** Record that the user opened a new request (clears tab dot; status stays `new`). */
export function useMarkNewEventViewedOnOpen(userId: string | undefined) {
  const markedRef = useRef(new Set<number>());

  useEffect(() => {
    markedRef.current.clear();
  }, [userId]);

  const markViewedIfNew = useCallback(
    (event: EventRequest | null | undefined) => {
      if (!userId || !event?.id || event.status !== 'new') return;
      if (markedRef.current.has(event.id)) return;
      markedRef.current.add(event.id);
      markEventRequestViewed(userId, event.id);
    },
    [userId]
  );

  return { markViewedIfNew };
}
