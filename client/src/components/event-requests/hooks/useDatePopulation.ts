import { useMemo } from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';

export interface DatePopulationInfo {
  totalEvents: number;
  // Warning level: 'none' | 'open' (teal - good!) | 'busy' (gold)
  warningLevel: 'none' | 'open' | 'busy';
  warningColor: string;
  warningMessage: string;
}

// Normalize date to YYYY-MM-DD string for comparison
const normalizeDate = (dateInput: string | Date | null | undefined): string | null => {
  if (!dateInput) return null;

  const dateStr = typeof dateInput === 'string' ? dateInput : dateInput.toISOString();
  // Extract just the date part (YYYY-MM-DD)
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

/**
 * Hook to get date population information for event cards
 * Returns a function to check any date's population
 */
export function useDatePopulation() {
  const { eventRequests } = useEventRequestContext();

  // Pre-compute date population map for efficiency
  const datePopulationMap = useMemo(() => {
    const map = new Map<string, number>();

    // Only count active events (not completed, declined, cancelled, or postponed)
    const activeStatuses = ['new', 'in_process', 'scheduled'];

    for (const event of eventRequests) {
      if (!activeStatuses.includes(event.status || '')) continue;

      // Use scheduledEventDate if available, otherwise desiredEventDate
      const eventDate = event.scheduledEventDate || event.desiredEventDate;
      const normalizedDate = normalizeDate(eventDate);

      if (!normalizedDate) continue;

      const current = map.get(normalizedDate) || 0;
      map.set(normalizedDate, current + 1);
    }

    return map;
  }, [eventRequests]);

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
        totalEvents: 0,
        warningLevel: 'none',
        warningColor: '',
        warningMessage: '',
      };
    }

    // Get base count from the map
    let total = datePopulationMap.get(normalizedDate) || 0;

    // If excluding an event (e.g., don't count the current event when showing its own warning)
    if (excludeEventId) {
      const excludedEvent = eventRequests.find((e) => e.id === excludeEventId);
      if (excludedEvent) {
        const excludedDate = normalizeDate(
          excludedEvent.scheduledEventDate || excludedEvent.desiredEventDate
        );
        if (excludedDate === normalizedDate) {
          total = Math.max(0, total - 1);
        }
      }
    }

    // Determine warning level
    // Open (teal #47B3CB): 0 other events on this date - good, prioritize filling gaps!
    // Busy (gold #FBAD3F): 2+ other events on this date - busy day warning
    // None: 1 other event - neutral
    let warningLevel: 'none' | 'open' | 'busy' = 'none';
    let warningColor = '';
    let warningMessage = '';

    if (total === 0) {
      warningLevel = 'open';
      warningColor = '#47B3CB';
      warningMessage = 'Open date - no other events scheduled';
    } else if (total >= 2) {
      warningLevel = 'busy';
      warningColor = '#FBAD3F';
      warningMessage = `${total} other events on this date`;
    }

    return {
      totalEvents: total,
      warningLevel,
      warningColor,
      warningMessage,
    };
  };

  return { getDatePopulation, datePopulationMap };
}
