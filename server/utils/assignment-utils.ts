/**
 * Centralized utilities for reading assignment data (Server-side)
 *
 * These functions use the JSONB fields (driverDetails, speakerDetails, volunteerDetails)
 * as the source of truth, rather than the legacy array columns.
 */

type EventWithAssignments = {
  driverDetails?: Record<string, any> | string | null;
  speakerDetails?: Record<string, any> | string | null;
  volunteerDetails?: Record<string, any> | string | null;
  assignedVanDriverId?: string | null;
  isDhlVan?: boolean | null;
  // Legacy arrays (still populated but no longer source of truth)
  assignedDriverIds?: string[] | null;
  assignedSpeakerIds?: string[] | null;
  assignedVolunteerIds?: string[] | null;
};

/**
 * Parse details field - handles both string JSON and object formats
 */
function parseDetails(details?: Record<string, any> | string | null): Record<string, any> | null {
  if (!details) return null;
  if (typeof details === 'string') {
    try {
      const parsed = JSON.parse(details);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, any>;
      }
      return null;
    } catch {
      return null;
    }
  }
  if (typeof details === 'object' && !Array.isArray(details)) {
    return details;
  }
  return null;
}

function getDriverIds(event: EventWithAssignments): string[] {
  const parsed = parseDetails(event.driverDetails);
  if (parsed) return Object.keys(parsed);
  if (event.assignedDriverIds && event.assignedDriverIds.length > 0) {
    return event.assignedDriverIds;
  }
  return [];
}

function getDriverCount(event: EventWithAssignments): number {
  return getDriverIds(event).length;
}

/**
 * Get total driver count including van driver and DHL
 */
export function getTotalDriverCount(event: EventWithAssignments): number {
  let count = getDriverCount(event);
  if (event.assignedVanDriverId) count++;
  if (event.isDhlVan) count++;
  return count;
}

function getSpeakerIds(event: EventWithAssignments): string[] {
  const parsed = parseDetails(event.speakerDetails);
  if (parsed) return Object.keys(parsed);
  if (event.assignedSpeakerIds && event.assignedSpeakerIds.length > 0) {
    return event.assignedSpeakerIds;
  }
  return [];
}

/**
 * Get count of speakers assigned
 */
export function getSpeakerCount(event: EventWithAssignments): number {
  return getSpeakerIds(event).length;
}

function getVolunteerIds(event: EventWithAssignments): string[] {
  const parsed = parseDetails(event.volunteerDetails);
  if (parsed) return Object.keys(parsed);
  if (event.assignedVolunteerIds && event.assignedVolunteerIds.length > 0) {
    return event.assignedVolunteerIds;
  }
  return [];
}

/**
 * Get count of volunteers assigned
 */
export function getVolunteerCount(event: EventWithAssignments): number {
  return getVolunteerIds(event).length;
}

/**
 * Get unfilled counts for an event
 */
export function getUnfilledCounts(event: EventWithAssignments & {
  driversNeeded?: number | null;
  speakersNeeded?: number | null;
  volunteersNeeded?: number | null;
}): {
  driversNeeded: number;
  driversAssigned: number;
  driversUnfilled: number;
  speakersNeeded: number;
  speakersAssigned: number;
  speakersUnfilled: number;
  volunteersNeeded: number;
  volunteersAssigned: number;
  volunteersUnfilled: number;
  hasUnfilledNeeds: boolean;
} {
  const driversNeeded = event.driversNeeded || 0;
  const driversAssigned = getTotalDriverCount(event);
  const driversUnfilled = Math.max(0, driversNeeded - driversAssigned);

  // Speaker role retired: keep the historical needed/assigned counts in the
  // return shape but force unfilled to 0 so speakers never contribute to
  // "has unfilled needs" (mirrors client/src/lib/assignment-utils.ts).
  const speakersNeeded = event.speakersNeeded || 0;
  const speakersAssigned = getSpeakerCount(event);
  const speakersUnfilled = 0;

  const volunteersNeeded = event.volunteersNeeded || 0;
  const volunteersAssigned = getVolunteerCount(event);
  const volunteersUnfilled = Math.max(0, volunteersNeeded - volunteersAssigned);

  return {
    driversNeeded,
    driversAssigned,
    driversUnfilled,
    speakersNeeded,
    speakersAssigned,
    speakersUnfilled,
    volunteersNeeded,
    volunteersAssigned,
    volunteersUnfilled,
    hasUnfilledNeeds: driversUnfilled > 0 || volunteersUnfilled > 0,
  };
}
