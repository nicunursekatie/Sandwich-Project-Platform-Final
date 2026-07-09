/**
 * Shared event validation and contextual action utilities
 * Used by both client and server for consistent validation logic
 */
import type { EventRequest } from './schema';
import { parseDateOnly, getTodayString } from './date-utils';

// ============================================================================
// EVENT DATE RESOLUTION
// ============================================================================

/**
 * Return the date the app should treat as "the" date for this event.
 *
 * Rule:
 *   - If the event has been scheduled, the scheduled date wins.
 *   - Otherwise fall back to the originally requested (desired) date.
 *   - If neither is set, returns `null`.
 *
 * Why a helper instead of an inline `||` everywhere: this rule used to live
 * in ~200 callsites across client + server. Every one was a potential drift
 * point (someone copies the wrong half, someone reverses the fallback,
 * someone forgets the fallback entirely and uses the wrong field). One
 * helper, one place to look, one place to change if the rule ever evolves.
 *
 * NOTE on context:
 *   - `desiredEventDate` is "the date the organizer originally asked for"
 *     and is retained for historical/audit purposes even after scheduling.
 *   - `scheduledEventDate` is "the actual date the event was scheduled for"
 *     and may differ from the desired date.
 *
 * When you SHOULD NOT use this helper:
 *   - When you're specifically displaying the original request date (e.g.,
 *     "Originally requested for: …" in audit/history UI).
 *   - When you're specifically working with the scheduled date and want to
 *     treat unscheduled events as "no date" (e.g., the main conflict-
 *     detection check that only fires on scheduled events).
 *   - When you're parsing / writing to one specific field via the schema.
 *
 * For all other cases — display, sorting, calendar placement, email
 * insertion, reminder timing, follow-up scheduling — this is what you want.
 *
 * Generic on the date field type so callers preserve whatever type they had
 * before migration: server callers usually have `Date | null` (Drizzle
 * timestamps); client callers usually have `string | null` (ISO strings via
 * JSON serialization). Either flows through unchanged.
 */
export function getEffectiveEventDate<T>(
  event:
    | { scheduledEventDate?: T | null; desiredEventDate?: T | null }
    | null
    | undefined
): T | null {
  if (!event) return null;
  return event.scheduledEventDate ?? event.desiredEventDate ?? null;
}

// ============================================================================
// REFRIGERATION VALIDATION
// ============================================================================

export interface SandwichType {
  type: string;
  quantity: number;
}

/**
 * Sandwich types that require refrigeration
 */
const PERISHABLE_SANDWICH_TYPES = ['turkey', 'ham', 'deli', 'cheese'];

/**
 * Check if a sandwich type requires refrigeration
 */
export function isPerishableSandwichType(type: string): boolean {
  const normalizedType = type.toLowerCase().trim();
  return PERISHABLE_SANDWICH_TYPES.some(perishable =>
    normalizedType.includes(perishable)
  );
}

/**
 * Check if an event has perishable sandwiches planned
 */
export function hasPerishableSandwiches(sandwichTypes: SandwichType[] | null | undefined): boolean {
  if (!sandwichTypes || !Array.isArray(sandwichTypes) || sandwichTypes.length === 0) {
    return false;
  }

  return sandwichTypes.some(sandwich =>
    sandwich.quantity > 0 && isPerishableSandwichType(sandwich.type)
  );
}

/**
 * Check if refrigeration status needs to be confirmed
 * Returns true if status is null/undefined (not answered)
 */
export function needsRefrigerationConfirmation(hasRefrigeration: boolean | null | undefined): boolean {
  return hasRefrigeration === null || hasRefrigeration === undefined;
}

/**
 * CRITICAL: Check if event has perishable sandwiches but NO refrigeration
 * This is a serious food safety issue
 */
export function hasCriticalRefrigerationIssue(
  sandwichTypes: SandwichType[] | null | undefined,
  hasRefrigeration: boolean | null | undefined
): boolean {
  return hasPerishableSandwiches(sandwichTypes) && hasRefrigeration === false;
}

/**
 * Get user-friendly message about refrigeration requirements
 */
export function getRefrigerationMessage(
  sandwichTypes: SandwichType[] | null | undefined,
  hasRefrigeration: boolean | null | undefined
): {
  type: 'error' | 'warning' | 'info' | null;
  message: string;
} | null {
  const hasPerishable = hasPerishableSandwiches(sandwichTypes);
  const needsConfirmation = needsRefrigerationConfirmation(hasRefrigeration);

  // Critical issue: perishable sandwiches with no refrigeration
  if (hasCriticalRefrigerationIssue(sandwichTypes, hasRefrigeration)) {
    return {
      type: 'error',
      message: 'CRITICAL: This event has turkey/ham/deli sandwiches planned but NO refrigeration! This is a food safety issue.',
    };
  }

  // Warning: refrigeration not confirmed yet
  if (needsConfirmation) {
    if (hasPerishable) {
      return {
        type: 'warning',
        message: 'Refrigeration status not confirmed. This event has perishable sandwiches planned.',
      };
    }
    return {
      type: 'warning',
      message: 'Refrigeration status not confirmed.',
    };
  }

  // Info: has refrigeration (good!)
  if (hasRefrigeration === true && hasPerishable) {
    return {
      type: 'info',
      message: 'Refrigeration confirmed - suitable for all sandwich types.',
    };
  }

  // Info: no refrigeration but no perishable sandwiches (that's fine)
  if (hasRefrigeration === false && !hasPerishable) {
    return {
      type: 'info',
      message: 'No refrigeration - plan for PB&J sandwiches only.',
    };
  }

  return null;
}

/**
 * Get list of perishable sandwich types from an array
 */
export function getPerishableSandwichTypes(sandwichTypes: SandwichType[] | null | undefined): string[] {
  if (!sandwichTypes || !Array.isArray(sandwichTypes)) {
    return [];
  }

  return sandwichTypes
    .filter(sandwich => sandwich.quantity > 0 && isPerishableSandwichType(sandwich.type))
    .map(sandwich => sandwich.type);
}

// ============================================================================
// EVENT REQUEST VALIDATION
// ============================================================================

/**
 * Validates event request intake information and returns list of missing critical data
 * Checks all canonical fields including contact info, sandwich details, and addresses
 */
export function getMissingIntakeInfo(request: EventRequest): string[] {
  const missing: string[] = [];

  // Check for contact info (email OR phone)
  const hasContactInfo = request.email || request.phone;

  if (!hasContactInfo) {
    missing.push('Contact Info');
  }

  // Check for sandwich count - this is the critical info we need
  const hasSandwichCount =
    (request.estimatedSandwichCount && request.estimatedSandwichCount > 0) ||
    (request.estimatedSandwichCountMin && request.estimatedSandwichCountMin > 0) ||
    (request.estimatedSandwichCountMax && request.estimatedSandwichCountMax > 0);

  if (!hasSandwichCount) {
    missing.push('Sandwich Info');
  }

  // Check for address (event address, delivery destination, or overnight holding location)
  // Skip address requirement if organization is delivering themselves (no drivers/van driver needed)
  const organizationDelivering =
    (!request.driversNeeded || request.driversNeeded === 0) &&
    !request.vanDriverNeeded;

  if (!organizationDelivering) {
    const hasAddress =
      (request.eventAddress && request.eventAddress.trim() !== '') ||
      (request.deliveryDestination && request.deliveryDestination.trim() !== '') ||
      (request.overnightHoldingLocation && request.overnightHoldingLocation.trim() !== '');

    if (!hasAddress) {
      missing.push('Address');
    }
  }

  // (Speaker role retired: the former "speakers needed ⇒ event start time
  // required" rule was removed. Start time is no longer gated on speakers.)

  return missing;
}

// ============================================================================
// MY ASSIGNMENTS DASHBOARD WARNINGS
// ============================================================================

/** Calendar-day difference: end minus start (can be negative). */
export function calendarDaysBetween(start: Date, end: Date): number {
  const msPerDay = 86400000;
  const startNorm = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endNorm = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endNorm.getTime() - startNorm.getTime()) / msPerDay);
}

/** Whole days elapsed since the request was submitted (Eastern calendar days). */
export function daysSinceSubmitted(
  createdAt: Date | string | null | undefined,
  today = parseDateOnly(getTodayString()),
): number | null {
  if (!createdAt || !today) return null;
  const created =
    createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;
  const createdDay =
    parseDateOnly(created.toISOString().slice(0, 10)) ??
    new Date(created.getFullYear(), created.getMonth(), created.getDate());
  return Math.max(0, calendarDaysBetween(createdDay, today));
}

/** Whole days until the effective event date (negative if in the past). */
export function daysUntilEventDate(
  eventDateInput: string | Date | null | undefined,
  today = parseDateOnly(getTodayString()),
): number | null {
  if (!eventDateInput || !today) return null;
  const eventDate =
    eventDateInput instanceof Date
      ? parseDateOnly(eventDateInput.toISOString().slice(0, 10))
      : parseDateOnly(eventDateInput);
  if (!eventDate) return null;
  return calendarDaysBetween(today, eventDate);
}

/**
 * Gaps that need attention for in-process / scheduled events happening within
 * the next N days — missing time, location, or sandwich info.
 */
export function getAssignmentUrgentGaps(
  event: EventRequest,
  withinDays = 7,
  today = parseDateOnly(getTodayString()),
): string[] {
  const status = event.status;
  if (
    status !== 'in_process' &&
    status !== 'scheduled' &&
    status !== 'rescheduled'
  ) {
    return [];
  }

  const eventDateStr = getEffectiveEventDate(event);
  const daysUntil = daysUntilEventDate(eventDateStr, today);
  if (daysUntil === null || daysUntil > withinDays || daysUntil < 0) {
    return [];
  }

  const gaps: string[] = [];

  const hasEventTimes = !!(event.eventStartTime && event.eventEndTime);
  const hasPickupTime = !!(event.pickupTime || event.pickupDateTime);
  if (!hasEventTimes && !hasPickupTime) {
    gaps.push('Missing time');
  }

  const hasLocation =
    !!(event.eventAddress && event.eventAddress.trim()) ||
    !!(event.deliveryDestination && event.deliveryDestination.trim()) ||
    !!(event.overnightHoldingLocation && event.overnightHoldingLocation.trim());
  if (!hasLocation) {
    gaps.push('Missing location');
  }

  const hasSandwichCount =
    (typeof event.estimatedSandwichCount === 'number' &&
      event.estimatedSandwichCount > 0) ||
    (typeof event.estimatedSandwichCountMin === 'number' &&
      event.estimatedSandwichCountMin > 0) ||
    (typeof event.estimatedSandwichCountMax === 'number' &&
      event.estimatedSandwichCountMax > 0);
  const sandwichTypes = event.sandwichTypes as unknown[] | null;
  const hasSandwichTypes =
    Array.isArray(sandwichTypes) && sandwichTypes.length > 0;
  if (!hasSandwichCount && !hasSandwichTypes) {
    gaps.push('Missing sandwich info');
  }

  return gaps;
}

// ============================================================================
// CONTEXTUAL ACTIONS
// ============================================================================

export interface ContextualAction {
  label: string;
  field: string; // The field that needs to be filled
  priority: number; // Higher priority = more important
  action: 'edit' | 'schedule' | 'confirm'; // Type of action
}

/**
 * Get the most critical contextual action for an event
 * Returns a specific action button label based on what's missing
 */
export function getPrimaryContextualAction(request: EventRequest): ContextualAction | null {
  const missingInfo = getMissingIntakeInfo(request);

  // Priority 1: Contact Info (critical for communication)
  if (missingInfo.includes('Contact Info')) {
    return {
      label: 'Add Contact Info',
      field: 'contact',
      priority: 100,
      action: 'edit',
    };
  }

  // Priority 2: Address (critical for delivery)
  if (missingInfo.includes('Address')) {
    return {
      label: 'Add Address',
      field: 'address',
      priority: 90,
      action: 'edit',
    };
  }

  // Priority 3: Sandwich Info (critical for planning)
  if (missingInfo.includes('Sandwich Info')) {
    return {
      label: 'Edit Event',
      field: 'sandwiches',
      priority: 80,
      action: 'edit',
    };
  }

  // Priority 4: Event Start Time
  if (missingInfo.includes('Event Start Time')) {
    return {
      label: 'Edit Event',
      field: 'eventStartTime',
      priority: 70,
      action: 'edit',
    };
  }

  // Priority 5: Event Date (if not set)
  if (!request.desiredEventDate && !request.scheduledEventDate) {
    return {
      label: 'Set Event Date',
      field: 'desiredEventDate',
      priority: 60,
      action: 'edit',
    };
  }

  // Priority 6: Refrigeration confirmation (if perishable sandwiches)
  const needsRefrigeration = needsRefrigerationConfirmation(request.hasRefrigeration);
  const hasSandwichTypes = request.sandwichTypes && Array.isArray(request.sandwichTypes) && request.sandwichTypes.length > 0;
  if (needsRefrigeration && hasSandwichTypes) {
    return {
      label: 'Confirm Refrigeration',
      field: 'hasRefrigeration',
      priority: 50,
      action: 'confirm',
    };
  }

  // Priority 7: Ready to schedule (if in_process and has all info)
  if (request.status === 'in_process' && missingInfo.length === 0 && request.desiredEventDate) {
    return {
      label: 'Schedule Event',
      field: 'status',
      priority: 40,
      action: 'schedule',
    };
  }

  // No critical action needed
  return null;
}

/**
 * Get all contextual actions for an event (for dropdown menus)
 * Returns an array of actions sorted by priority
 */
export function getAllContextualActions(request: EventRequest): ContextualAction[] {
  const actions: ContextualAction[] = [];
  const missingInfo = getMissingIntakeInfo(request);

  if (missingInfo.includes('Contact Info')) {
    actions.push({
      label: 'Add Contact Info',
      field: 'contact',
      priority: 100,
      action: 'edit',
    });
  }

  if (missingInfo.includes('Address')) {
    actions.push({
      label: 'Add Address',
      field: 'address',
      priority: 90,
      action: 'edit',
    });
  }

  if (missingInfo.includes('Sandwich Info')) {
    actions.push({
      label: 'Edit Event',
      field: 'sandwiches',
      priority: 80,
      action: 'edit',
    });
  }

  if (missingInfo.includes('Event Start Time')) {
    actions.push({
      label: 'Edit Event',
      field: 'eventStartTime',
      priority: 70,
      action: 'edit',
    });
  }

  if (!request.desiredEventDate && !request.scheduledEventDate) {
    actions.push({
      label: 'Set Event Date',
      field: 'desiredEventDate',
      priority: 60,
      action: 'edit',
    });
  }

  const needsRefrigeration = needsRefrigerationConfirmation(request.hasRefrigeration);
  const hasSandwichTypes = request.sandwichTypes && Array.isArray(request.sandwichTypes) && request.sandwichTypes.length > 0;
  if (needsRefrigeration && hasSandwichTypes) {
    actions.push({
      label: 'Confirm Refrigeration',
      field: 'hasRefrigeration',
      priority: 50,
      action: 'confirm',
    });
  }

  if (request.status === 'in_process' && missingInfo.length === 0 && request.desiredEventDate) {
    actions.push({
      label: 'Schedule Event',
      field: 'status',
      priority: 40,
      action: 'schedule',
    });
  }

  // Sort by priority (highest first)
  return actions.sort((a, b) => b.priority - a.priority);
}

/**
 * Get a contextual tooltip message explaining what's needed
 */
export function getContextualTooltip(request: EventRequest): string {
  const action = getPrimaryContextualAction(request);
  if (!action) return 'Edit this event';

  const tooltips: Record<string, string> = {
    contact: 'Add email or phone number to contact the organization',
    address: 'Add event address or delivery location',
    sandwiches: 'Specify how many sandwiches are needed',
    eventStartTime: 'Set the event start time',
    desiredEventDate: 'Set the desired event date',
    hasRefrigeration: 'Confirm if refrigeration is available for perishable sandwiches',
    status: 'All required info is complete - ready to schedule this event',
  };

  return tooltips[action.field] || 'Edit this event';
}
