/**
 * Centralized utilities for reading assignment data.
 *
 * These functions use the JSONB fields (driverDetails, speakerDetails, volunteerDetails)
 * as the source of truth, rather than the legacy array columns.
 *
 * This consolidates the dual-storage pattern where both arrays and JSONB exist.
 */

type EventWithAssignments = {
  driverDetails?: Record<string, any> | null;
  speakerDetails?: Record<string, any> | null;
  volunteerDetails?: Record<string, any> | null;
  assignedVanDriverId?: string | null;
  isDhlVan?: boolean | null;
  // Legacy arrays (still populated but no longer source of truth)
  assignedDriverIds?: string[] | null;
  assignedSpeakerIds?: string[] | null;
  assignedVolunteerIds?: string[] | null;
};

/**
 * Get all driver IDs from the event (excluding van driver)
 */
export function getDriverIds(event: EventWithAssignments): string[] {
  if (!event.driverDetails) return [];
  return Object.keys(event.driverDetails);
}

/**
 * Get count of regular drivers assigned (excluding van driver and DHL)
 */
export function getDriverCount(event: EventWithAssignments): number {
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

/**
 * Check if a specific person is assigned as a driver
 */
export function hasDriver(event: EventWithAssignments, personId: string): boolean {
  return !!(event.driverDetails?.[personId]);
}

/**
 * Get driver details for a specific person
 */
export function getDriverDetail(event: EventWithAssignments, personId: string): any | null {
  return event.driverDetails?.[personId] ?? null;
}

/**
 * Get all speaker IDs from the event
 */
export function getSpeakerIds(event: EventWithAssignments): string[] {
  if (!event.speakerDetails) return [];
  return Object.keys(event.speakerDetails);
}

/**
 * Get count of speakers assigned
 */
export function getSpeakerCount(event: EventWithAssignments): number {
  return getSpeakerIds(event).length;
}

/**
 * Check if a specific person is assigned as a speaker
 */
export function hasSpeaker(event: EventWithAssignments, personId: string): boolean {
  return !!(event.speakerDetails?.[personId]);
}

/**
 * Get speaker details for a specific person
 */
export function getSpeakerDetail(event: EventWithAssignments, personId: string): any | null {
  return event.speakerDetails?.[personId] ?? null;
}

/**
 * Get all volunteer IDs from the event
 */
export function getVolunteerIds(event: EventWithAssignments): string[] {
  if (!event.volunteerDetails) return [];
  return Object.keys(event.volunteerDetails);
}

/**
 * Get count of volunteers assigned
 */
export function getVolunteerCount(event: EventWithAssignments): number {
  return getVolunteerIds(event).length;
}

/**
 * Check if a specific person is assigned as a volunteer
 */
export function hasVolunteer(event: EventWithAssignments, personId: string): boolean {
  return !!(event.volunteerDetails?.[personId]);
}

/**
 * Get volunteer details for a specific person
 */
export function getVolunteerDetail(event: EventWithAssignments, personId: string): any | null {
  return event.volunteerDetails?.[personId] ?? null;
}

/**
 * Check if a person is assigned in any role
 */
export function isPersonAssigned(event: EventWithAssignments, personId: string): boolean {
  return hasDriver(event, personId) ||
         hasSpeaker(event, personId) ||
         hasVolunteer(event, personId) ||
         event.assignedVanDriverId === personId;
}
