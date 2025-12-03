import { useMemo } from 'react';
import { useEventRequestContext } from '../context/EventRequestContext';
import type { EventRequest } from '@shared/schema';

export interface DatePopulationInfo {
  totalEvents: number;
  eventsWithDriverNeeds: number;
  // Warning level: 'none' | 'busy' (gold) | 'critical' (red)
  warningLevel: 'none' | 'busy' | 'critical';
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

// Check if an event has driver needs (driversNeeded > 0 and not self-transport)
const hasDriverNeeds = (event: EventRequest): boolean => {
  // If self-transport is true, they don't need TSP drivers
  if (event.selfTransport) return false;
  // Check if driversNeeded is set and > 0
  return (event.driversNeeded ?? 0) > 0;
};

/**
 * Hook to get date population information for event cards
 * Returns a function to check any date's population
 */
export function useDatePopulation() {
  const { eventRequests } = useEventRequestContext();

  // Pre-compute date population map for efficiency
  const datePopulationMap = useMemo(() => {
    const map = new Map<string, { total: number; withDriverNeeds: number }>();

    // Only count active events (not completed, declined, cancelled, or postponed)
    const activeStatuses = ['new', 'in_process', 'scheduled'];

    for (const event of eventRequests) {
      if (!activeStatuses.includes(event.status || '')) continue;

      // Use scheduledEventDate if available, otherwise desiredEventDate
      const eventDate = event.scheduledEventDate || event.desiredEventDate;
      const normalizedDate = normalizeDate(eventDate);

      if (!normalizedDate) continue;

      const current = map.get(normalizedDate) || { total: 0, withDriverNeeds: 0 };
      current.total += 1;
      if (hasDriverNeeds(event)) {
        current.withDriverNeeds += 1;
      }
      map.set(normalizedDate, current);
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
        eventsWithDriverNeeds: 0,
        warningLevel: 'none',
        warningColor: '',
        warningMessage: '',
      };
    }

    // Get base counts from the map
    let { total, withDriverNeeds } = datePopulationMap.get(normalizedDate) || {
      total: 0,
      withDriverNeeds: 0,
    };

    // If excluding an event (e.g., don't count the current event when showing its own warning)
    if (excludeEventId) {
      const excludedEvent = eventRequests.find((e) => e.id === excludeEventId);
      if (excludedEvent) {
        const excludedDate = normalizeDate(
          excludedEvent.scheduledEventDate || excludedEvent.desiredEventDate
        );
        if (excludedDate === normalizedDate) {
          total = Math.max(0, total - 1);
          if (hasDriverNeeds(excludedEvent)) {
            withDriverNeeds = Math.max(0, withDriverNeeds - 1);
          }
        }
      }
    }

    // Determine warning level
    // Critical (red #A31C41): 3+ events with driver needs on this date
    // Busy (gold #FBAD3F): 2+ total events on this date
    // None: 0-1 events
    let warningLevel: 'none' | 'busy' | 'critical' = 'none';
    let warningColor = '';
    let warningMessage = '';

    if (withDriverNeeds >= 3) {
      warningLevel = 'critical';
      warningColor = '#A31C41';
      warningMessage = `${withDriverNeeds} events need drivers on this date`;
    } else if (total >= 2) {
      warningLevel = 'busy';
      warningColor = '#FBAD3F';
      warningMessage = `${total} events scheduled for this date`;
    }

    return {
      totalEvents: total,
      eventsWithDriverNeeds: withDriverNeeds,
      warningLevel,
      warningColor,
      warningMessage,
    };
  };

  return { getDatePopulation, datePopulationMap };
}
