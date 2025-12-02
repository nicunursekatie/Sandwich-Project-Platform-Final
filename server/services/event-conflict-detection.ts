/**
 * Event Conflict Detection Service
 *
 * Automatically detects scheduling conflicts for events:
 * - Van booking conflicts (overlapping times)
 * - High volume days (multiple events on same day)
 * - Driver conflicts (same driver assigned to overlapping events)
 * - Recipient conflicts (same recipient has another event)
 *
 * Conflicts are flagged but don't prevent event creation.
 */

import { db } from '../db';
import { eventRequests } from '@shared/schema';
import { eq, and, ne, gte, lte, or, sql } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';

export interface ConflictWarning {
  type: 'van_conflict' | 'high_volume_day' | 'driver_conflict' | 'recipient_conflict' | 'time_overlap';
  severity: 'warning' | 'critical';
  message: string;
  conflictingEventId?: number;
  conflictingEventName?: string;
  conflictingEventTime?: string;
  details?: Record<string, any>;
}

export interface ConflictCheckResult {
  hasConflicts: boolean;
  warnings: ConflictWarning[];
  summary: string;
}

/**
 * Parse time string (e.g., "2:30 PM", "14:30") to minutes since midnight
 */
function parseTimeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;

  // Try parsing "HH:MM AM/PM" format
  const amPmMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (amPmMatch) {
    let hours = parseInt(amPmMatch[1], 10);
    const minutes = parseInt(amPmMatch[2], 10);
    const period = amPmMatch[3]?.toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return hours * 60 + minutes;
  }

  // Try parsing "HH:MM" 24-hour format
  const h24Match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    const hours = parseInt(h24Match[1], 10);
    const minutes = parseInt(h24Match[2], 10);
    return hours * 60 + minutes;
  }

  return null;
}

/**
 * Check if two time ranges overlap
 */
function timesOverlap(
  start1: number | null,
  end1: number | null,
  start2: number | null,
  end2: number | null
): boolean {
  // If we don't have complete time info, assume potential overlap
  if (start1 === null || end1 === null || start2 === null || end2 === null) {
    return true; // Conservative: assume overlap if we can't determine
  }

  // Check for overlap: one range starts before the other ends
  return start1 < end2 && start2 < end1;
}

/**
 * Get the date portion of a Date object as YYYY-MM-DD string
 */
function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Check for all conflicts for an event
 */
export async function checkEventConflicts(
  eventData: {
    id?: number; // If editing existing event
    scheduledEventDate?: Date | string | null;
    eventStartTime?: string | null;
    eventEndTime?: string | null;
    vanBooked?: string | null; // 'yes', 'no', 'AM', 'PM'
    driverName?: string | null;
    recipientId?: number | null;
    organizationName?: string | null;
  }
): Promise<ConflictCheckResult> {
  const warnings: ConflictWarning[] = [];

  // Parse the scheduled date
  let scheduledDate: Date | null = null;
  if (eventData.scheduledEventDate) {
    scheduledDate = typeof eventData.scheduledEventDate === 'string'
      ? new Date(eventData.scheduledEventDate)
      : eventData.scheduledEventDate;
  }

  if (!scheduledDate || isNaN(scheduledDate.getTime())) {
    return {
      hasConflicts: false,
      warnings: [],
      summary: 'No scheduled date provided - cannot check conflicts',
    };
  }

  const dateStr = getDateString(scheduledDate);
  const startOfDay = new Date(dateStr + 'T00:00:00.000Z');
  const endOfDay = new Date(dateStr + 'T23:59:59.999Z');

  try {
    // Find all other events on the same day (excluding current event if editing)
    // Include new, in_process, scheduled, confirmed for high volume detection
    const allRelevantConditions = [
      gte(eventRequests.scheduledEventDate, startOfDay),
      lte(eventRequests.scheduledEventDate, endOfDay),
      // Include new, in_process, scheduled, and confirmed events (not cancelled/completed/postponed)
      or(
        eq(eventRequests.status, 'new'),
        eq(eventRequests.status, 'in_process'),
        eq(eventRequests.status, 'scheduled'),
        eq(eventRequests.status, 'confirmed'),
        eq(eventRequests.status, 'pending')
      ),
    ];

    if (eventData.id) {
      allRelevantConditions.push(ne(eventRequests.id, eventData.id));
    }

    const allEventsOnSameDay = await db
      .select()
      .from(eventRequests)
      .where(and(...allRelevantConditions));

    // Separate scheduled/confirmed events for van/driver conflict checking
    const eventsOnSameDay = allEventsOnSameDay.filter(
      e => e.status === 'scheduled' || e.status === 'confirmed'
    );

    // Check 1: High volume day warning (count all relevant events including new/in_process)
    if (allEventsOnSameDay.length >= 2) {
      const scheduledCount = eventsOnSameDay.length;
      const pendingCount = allEventsOnSameDay.length - scheduledCount;

      let message: string;
      if (pendingCount > 0 && scheduledCount > 0) {
        message = `${scheduledCount} scheduled + ${pendingCount} pending event(s) for ${scheduledDate.toLocaleDateString()}`;
      } else if (pendingCount > 0) {
        message = `${pendingCount} pending event(s) already being planned for ${scheduledDate.toLocaleDateString()}`;
      } else {
        message = `${scheduledCount} event(s) already scheduled for ${scheduledDate.toLocaleDateString()}`;
      }

      warnings.push({
        type: 'high_volume_day',
        severity: allEventsOnSameDay.length >= 4 ? 'critical' : 'warning',
        message,
        details: {
          eventCount: allEventsOnSameDay.length + 1, // Include the new event
          scheduledCount,
          pendingCount,
          events: allEventsOnSameDay.map(e => ({
            id: e.id,
            name: e.organizationName,
            time: e.eventStartTime,
            status: e.status,
          })),
        },
      });
    }

    // Parse current event times
    const currentStart = parseTimeToMinutes(eventData.eventStartTime);
    const currentEnd = parseTimeToMinutes(eventData.eventEndTime);

    // Check each event for specific conflicts
    for (const existingEvent of eventsOnSameDay) {
      const existingStart = parseTimeToMinutes(existingEvent.eventStartTime);
      const existingEnd = parseTimeToMinutes(existingEvent.eventEndTime);
      const hasTimeOverlap = timesOverlap(currentStart, currentEnd, existingStart, existingEnd);

      // Check 2: Van booking conflict
      const currentNeedsVan = eventData.vanBooked &&
        eventData.vanBooked.toLowerCase() !== 'no' &&
        eventData.vanBooked.toLowerCase() !== 'false';
      const existingNeedsVan = existingEvent.vanBooked &&
        existingEvent.vanBooked.toLowerCase() !== 'no' &&
        existingEvent.vanBooked.toLowerCase() !== 'false';

      if (currentNeedsVan && existingNeedsVan && hasTimeOverlap) {
        // Check if same time period (AM/PM)
        const currentPeriod = eventData.vanBooked?.toUpperCase();
        const existingPeriod = existingEvent.vanBooked?.toUpperCase();

        // Only flag if both are 'yes' (all day) or same period
        const periodConflict =
          currentPeriod === 'YES' ||
          existingPeriod === 'YES' ||
          currentPeriod === existingPeriod;

        if (periodConflict) {
          warnings.push({
            type: 'van_conflict',
            severity: 'critical',
            message: `Van already booked for "${existingEvent.organizationName}" at ${existingEvent.eventStartTime || 'TBD'}`,
            conflictingEventId: existingEvent.id,
            conflictingEventName: existingEvent.organizationName || 'Unknown',
            conflictingEventTime: existingEvent.eventStartTime || undefined,
          });
        }
      }

      // Check 3: Driver conflict
      if (eventData.driverName && existingEvent.driverName && hasTimeOverlap) {
        const currentDriver = eventData.driverName.toLowerCase().trim();
        const existingDriver = existingEvent.driverName.toLowerCase().trim();

        if (currentDriver === existingDriver) {
          warnings.push({
            type: 'driver_conflict',
            severity: 'critical',
            message: `${eventData.driverName} is already assigned to "${existingEvent.organizationName}" at ${existingEvent.eventStartTime || 'TBD'}`,
            conflictingEventId: existingEvent.id,
            conflictingEventName: existingEvent.organizationName || 'Unknown',
            conflictingEventTime: existingEvent.eventStartTime || undefined,
          });
        }
      }

      // Check 4: Recipient conflict
      if (eventData.recipientId && existingEvent.recipientId) {
        if (eventData.recipientId === existingEvent.recipientId) {
          warnings.push({
            type: 'recipient_conflict',
            severity: 'warning',
            message: `Same recipient already has an event scheduled: "${existingEvent.organizationName}" at ${existingEvent.eventStartTime || 'TBD'}`,
            conflictingEventId: existingEvent.id,
            conflictingEventName: existingEvent.organizationName || 'Unknown',
            conflictingEventTime: existingEvent.eventStartTime || undefined,
          });
        }
      }
    }

    // Generate summary
    const criticalCount = warnings.filter(w => w.severity === 'critical').length;
    const warningCount = warnings.filter(w => w.severity === 'warning').length;

    let summary = 'No conflicts detected';
    if (warnings.length > 0) {
      const parts = [];
      if (criticalCount > 0) parts.push(`${criticalCount} critical`);
      if (warningCount > 0) parts.push(`${warningCount} warning${warningCount > 1 ? 's' : ''}`);
      summary = `${parts.join(', ')} found`;
    }

    return {
      hasConflicts: warnings.length > 0,
      warnings,
      summary,
    };
  } catch (error) {
    logger.error('Error checking event conflicts:', error);
    return {
      hasConflicts: false,
      warnings: [],
      summary: 'Error checking conflicts - please review manually',
    };
  }
}

/**
 * Get conflicts for a specific date (useful for calendar views)
 */
export async function getConflictsForDate(date: Date): Promise<{
  vanConflicts: Array<{ event1: any; event2: any }>;
  driverConflicts: Array<{ driver: string; events: any[] }>;
  highVolume: boolean;
  eventCount: number;
}> {
  const dateStr = getDateString(date);
  const startOfDay = new Date(dateStr + 'T00:00:00.000Z');
  const endOfDay = new Date(dateStr + 'T23:59:59.999Z');

  try {
    // Get all relevant events (new, in_process, scheduled, confirmed) for high volume
    const allEvents = await db
      .select()
      .from(eventRequests)
      .where(
        and(
          gte(eventRequests.scheduledEventDate, startOfDay),
          lte(eventRequests.scheduledEventDate, endOfDay),
          or(
            eq(eventRequests.status, 'new'),
            eq(eventRequests.status, 'in_process'),
            eq(eventRequests.status, 'scheduled'),
            eq(eventRequests.status, 'confirmed')
          )
        )
      );

    // For van/driver conflicts, only check scheduled/confirmed events
    const scheduledEvents = allEvents.filter(
      e => e.status === 'scheduled' || e.status === 'confirmed'
    );

    const vanConflicts: Array<{ event1: any; event2: any }> = [];
    const driverGroups: Map<string, any[]> = new Map();

    // Check each pair of scheduled events
    for (let i = 0; i < scheduledEvents.length; i++) {
      const event1 = scheduledEvents[i];

      // Track drivers
      if (event1.driverName) {
        const driverKey = event1.driverName.toLowerCase().trim();
        if (!driverGroups.has(driverKey)) {
          driverGroups.set(driverKey, []);
        }
        driverGroups.get(driverKey)!.push(event1);
      }

      for (let j = i + 1; j < scheduledEvents.length; j++) {
        const event2 = scheduledEvents[j];

        // Check van conflict
        const van1 = event1.vanBooked?.toLowerCase() !== 'no';
        const van2 = event2.vanBooked?.toLowerCase() !== 'no';

        if (van1 && van2) {
          const start1 = parseTimeToMinutes(event1.eventStartTime);
          const end1 = parseTimeToMinutes(event1.eventEndTime);
          const start2 = parseTimeToMinutes(event2.eventStartTime);
          const end2 = parseTimeToMinutes(event2.eventEndTime);

          if (timesOverlap(start1, end1, start2, end2)) {
            vanConflicts.push({ event1, event2 });
          }
        }
      }
    }

    // Find driver conflicts (drivers with multiple events)
    const driverConflicts = Array.from(driverGroups.entries())
      .filter(([_, events]) => events.length > 1)
      .map(([driver, events]) => ({ driver, events }));

    return {
      vanConflicts,
      driverConflicts,
      highVolume: allEvents.length >= 3, // Count all relevant events for high volume
      eventCount: allEvents.length,
    };
  } catch (error) {
    logger.error('Error getting conflicts for date:', error);
    return {
      vanConflicts: [],
      driverConflicts: [],
      highVolume: false,
      eventCount: 0,
    };
  }
}
