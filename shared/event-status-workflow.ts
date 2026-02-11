/**
 * Event Status Workflow Definitions
 *
 * Central source of truth for event request status definitions,
 * valid transitions, and descriptions for intake team reference.
 *
 * Used by both server (enforcement) and client (UI display + filtering).
 */

export const EVENT_STATUSES = [
  'new',
  'followed_up',
  'in_process',
  'scheduled',
  'completed',
  'declined',
  'postponed',
  'cancelled',
  'standby',
  'stalled',
] as const;

export type EventStatus = typeof EVENT_STATUSES[number];

/**
 * Status definitions with descriptions for intake team.
 * Each status has a label, a short definition, and contextual guidance.
 */
export const STATUS_DEFINITIONS: Record<EventStatus, {
  label: string;
  definition: string;
  guidance: string;
}> = {
  new: {
    label: 'New Request',
    definition: 'A new event request that has not yet been reviewed or contacted.',
    guidance: 'Review the request details and make initial contact with the organizer. Move to In Process once you begin working on it.',
  },
  followed_up: {
    label: 'Followed Up',
    definition: 'Initial follow-up has been completed but coordination is not yet underway.',
    guidance: 'Continue follow-up until an intake call is scheduled or the event moves to In Process.',
  },
  in_process: {
    label: 'In Process',
    definition: 'Actively being coordinated. Intake call has been scheduled or is in progress.',
    guidance: 'Work with the organizer to finalize event details. Once the date is confirmed and logistics are set, move to Scheduled. If they decide not to proceed, move to Declined.',
  },
  scheduled: {
    label: 'Scheduled',
    definition: 'Event date is confirmed and logistics are being finalized.',
    guidance: 'Assign drivers, speakers, and volunteers. If the group needs to change the date, use the Postpone action. Once the event takes place, it moves to Completed.',
  },
  completed: {
    label: 'Completed',
    definition: 'The event has successfully taken place.',
    guidance: 'Complete follow-up tasks: 1-day follow-up, 1-month follow-up, and social media post request.',
  },
  declined: {
    label: 'Declined',
    definition: 'The request was declined or the organizer decided not to proceed. Used for events that never reached the Scheduled stage.',
    guidance: 'This is for events that did not work out before being scheduled. Record the reason if possible.',
  },
  postponed: {
    label: 'Postponed',
    definition: 'A previously scheduled event has been delayed and no new date has been confirmed yet.',
    guidance: 'Follow up with the organizer to determine a new date. Once a new date is confirmed, move back to Scheduled.',
  },
  cancelled: {
    label: 'Cancelled',
    definition: 'A previously scheduled event has been cancelled and will not take place.',
    guidance: 'Only events that were already Scheduled can be cancelled. Record the reason for cancellation.',
  },
  standby: {
    label: 'Standby',
    definition: 'Waiting for the organizer to work out details on their end before we can proceed.',
    guidance: 'Check back periodically. The organizer needs to resolve something (budget approval, internal coordination, etc.) before we can move forward.',
  },
  stalled: {
    label: 'Stalled',
    definition: 'No response from the organizer after multiple outreach attempts.',
    guidance: 'Continue periodic outreach (quarterly). If they eventually respond, move back to the appropriate active status. If they confirm they are no longer interested, move to Declined.',
  },
};

/**
 * Valid status transitions.
 * Maps each status to the list of statuses it can transition to.
 *
 * Key business rules:
 * - Cancelled requires the event to have been Scheduled first
 * - In Process events that don't happen become Declined (not Cancelled)
 * - Postponed events can move back to Scheduled once a new date is confirmed
 * - Completed is typically a terminal state but can be reopened to Scheduled if needed
 */
export const VALID_STATUS_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  new: ['in_process', 'followed_up', 'declined', 'standby', 'stalled'],
  followed_up: ['in_process', 'declined', 'standby', 'stalled'],
  in_process: ['scheduled', 'declined', 'standby', 'stalled'],
  scheduled: ['completed', 'cancelled', 'postponed'],
  completed: ['scheduled'],  // Reopen if needed (e.g., data entry error)
  declined: ['new', 'in_process'],  // Can reactivate if they come back
  postponed: ['scheduled', 'cancelled', 'declined'],  // Reschedule, cancel, or decline
  cancelled: ['scheduled'],  // Can reinstate if the group comes back
  standby: ['in_process', 'declined', 'stalled'],
  stalled: ['in_process', 'declined', 'new'],
};

/**
 * Check if a status transition is valid.
 */
export function isValidTransition(from: EventStatus, to: EventStatus): boolean {
  if (from === to) return true; // No change is always valid
  const allowed = VALID_STATUS_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Get a human-readable error message for an invalid transition.
 */
export function getTransitionError(from: EventStatus, to: EventStatus): string {
  const fromDef = STATUS_DEFINITIONS[from];
  const toDef = STATUS_DEFINITIONS[to];
  const fromLabel = fromDef?.label || from;
  const toLabel = toDef?.label || to;

  // Provide specific guidance for common mistakes
  if (to === 'cancelled' && from !== 'scheduled' && from !== 'postponed' && from !== 'cancelled') {
    return `Cannot cancel an event that is "${fromLabel}". Only Scheduled or Postponed events can be cancelled. If this event won't proceed, mark it as Declined instead.`;
  }

  if (to === 'completed' && from !== 'scheduled' && from !== 'completed') {
    return `Cannot mark a "${fromLabel}" event as Completed. The event must be Scheduled first.`;
  }

  if (to === 'postponed' && from !== 'scheduled') {
    return `Cannot postpone a "${fromLabel}" event. Only Scheduled events can be postponed. If the event hasn't been scheduled yet, keep it in its current status until a date is confirmed.`;
  }

  const allowedLabels = (VALID_STATUS_TRANSITIONS[from] || [])
    .map(s => STATUS_DEFINITIONS[s]?.label || s);

  return `Cannot move from "${fromLabel}" to "${toLabel}". Valid next statuses are: ${allowedLabels.join(', ')}.`;
}
