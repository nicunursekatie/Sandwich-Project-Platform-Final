/**
 * Helper functions for generating contextual action buttons based on event state
 */
import type { EventRequest } from '@shared/schema';
import { getMissingIntakeInfo } from './event-request-validation';
import { needsRefrigerationConfirmation } from './refrigeration-utils';

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
      label: 'Add Sandwich Count',
      field: 'sandwiches',
      priority: 80,
      action: 'edit',
    };
  }

  // Priority 4: Event Start Time (if speakers needed)
  if (missingInfo.includes('Event Start Time')) {
    return {
      label: 'Set Event Time',
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
      label: 'Add Sandwich Count',
      field: 'sandwiches',
      priority: 80,
      action: 'edit',
    });
  }

  if (missingInfo.includes('Event Start Time')) {
    actions.push({
      label: 'Set Event Time',
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
    eventStartTime: 'Set the event start time for speaker scheduling',
    desiredEventDate: 'Set the desired event date',
    hasRefrigeration: 'Confirm if refrigeration is available for perishable sandwiches',
    status: 'All required info is complete - ready to schedule this event',
  };

  return tooltips[action.field] || 'Edit this event';
}
