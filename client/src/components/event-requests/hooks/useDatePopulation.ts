import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EventRequest } from '@shared/schema';
import { getEffectiveEventDate } from '@shared/event-validation-utils';

export interface DatePopulationInfo {
  scheduledCount: number;
  inProcessCount: number;
  rescheduledCount: number;
  // Whether there are no scheduled, in-process, or rescheduled events (open date)
  isOpen: boolean;
}

// Normalize date to YYYY-MM-DD string for comparison.
// Uses local date parts for Date objects (avoiding UTC shift) and
// extracts the date portion directly from ISO strings.
const normalizeDate = (dateInput: string | Date | null | undefined): string | null => {
  if (!dateInput) return null;

  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null;
    // Use local date parts to avoid UTC timezone shifting the day
    const y = dateInput.getFullYear();
    const m = String(dateInput.getMonth() + 1).padStart(2, '0');
    const d = String(dateInput.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // For strings, extract the YYYY-MM-DD portion directly
  const match = dateInput.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

interface DateCounts {
  scheduled: number;
  inProcess: number;
  rescheduled: number;
}

/**
 * Hook to get date population information for event cards.
 * Fetches ALL active events (scheduled, in_process, rescheduled) independently
 * of the current tab filter, so date population is accurate regardless of which
 * tab the user is viewing.
 */
export function useDatePopulation() {
  // Fetch all active events independently of the tab-filtered context list.
  // This ensures that when viewing the "New" tab, we still know about
  // scheduled/in-process events on the same date.
  const { data: allActiveEvents = [] } = useQuery<EventRequest[]>({
    queryKey: ['/api/event-requests/list', 'date-population-all-active'],
    queryFn: async () => {
      const response = await fetch(
        '/api/event-requests/list?status=scheduled,in_process,rescheduled',
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to fetch active events for date population');
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });

  // Pre-compute date population map for efficiency
  const datePopulationMap = useMemo(() => {
    const map = new Map<string, DateCounts>();

    for (const event of allActiveEvents) {
      const status = event.status || '';

      // Use scheduledEventDate if available, otherwise desiredEventDate
      const eventDate = getEffectiveEventDate(event);
      const normalizedDate = normalizeDate(eventDate);

      if (!normalizedDate) continue;

      const current = map.get(normalizedDate) || { scheduled: 0, inProcess: 0, rescheduled: 0 };

      if (status === 'scheduled') {
        current.scheduled += 1;
      } else if (status === 'in_process') {
        current.inProcess += 1;
      } else if (status === 'rescheduled') {
        current.rescheduled += 1;
      }

      map.set(normalizedDate, current);
    }

    return map;
  }, [allActiveEvents]);

  /**
   * Get population info for a specific date
   * @param date - Date string or Date object
   * @param excludeEventId - Optional event ID to exclude from count (useful when showing warning on the event's own card)
   */
  const getDatePopulation = (
    date: string | Date | null | undefined,
    excludeEventId?: number
  ): DatePopulationInfo => {
    const normalizedDate = normalizeDate(date);

    if (!normalizedDate) {
      return {
        scheduledCount: 0,
        inProcessCount: 0,
        rescheduledCount: 0,
        isOpen: true,
      };
    }

    // Get base counts from the map
    let { scheduled, inProcess, rescheduled } = datePopulationMap.get(normalizedDate) || {
      scheduled: 0,
      inProcess: 0,
      rescheduled: 0,
    };

    // If excluding an event (e.g., don't count the current event when showing its own warning)
    if (excludeEventId) {
      const excludedEvent = allActiveEvents.find((e) => e.id === excludeEventId);
      if (excludedEvent) {
        const excludedDate = normalizeDate(
          getEffectiveEventDate(excludedEvent)
        );
        if (excludedDate === normalizedDate) {
          if (excludedEvent.status === 'scheduled') {
            scheduled = Math.max(0, scheduled - 1);
          } else if (excludedEvent.status === 'in_process') {
            inProcess = Math.max(0, inProcess - 1);
          } else if (excludedEvent.status === 'rescheduled') {
            rescheduled = Math.max(0, rescheduled - 1);
          }
        }
      }
    }

    return {
      scheduledCount: scheduled,
      inProcessCount: inProcess,
      rescheduledCount: rescheduled,
      isOpen: scheduled === 0 && inProcess === 0 && rescheduled === 0,
    };
  };

  return { getDatePopulation, datePopulationMap };
}
