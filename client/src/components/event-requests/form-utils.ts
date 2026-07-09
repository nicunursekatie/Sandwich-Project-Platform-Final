/**
 * EventSchedulingForm - Utility Functions
 *
 * Extracted from EventSchedulingForm.tsx to:
 * 1. Eliminate duplication in form data serialization
 * 2. Make payload-building / serialization logic testable
 * 3. Simplify the performSubmit function
 */

import type { EventFormData } from './form-sections/types';
export { findMismatchedSavedFields, getDroppedServerFields } from '@/lib/event-save-verification';

/**
 * Serialize a date string for the backend.
 * Sends bare YYYY-MM-DD so parseDateOnly uses its safe local-noon path.
 * Returns null for empty/falsy strings.
 */
export function serializeDateToISO(dateString: string): string | null {
  if (!dateString || !dateString.trim()) return null;
  // Extract YYYY-MM-DD portion
  const dateOnly = dateString.split('T')[0];
  // Validate it looks like a date before sending
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return null;
  return dateOnly;
}

/**
 * Build the event data payload for the server from form state.
 *
 * This is the SINGLE place where form fields are mapped to server fields.
 * Used by both create and update mutations.
 */
export function buildEventDataForServer(
  formData: EventFormData,
  options: {
    mode: 'schedule' | 'edit' | 'create';
    hasEventRequest: boolean;
    eventRequestStatus?: string;
    sandwichMode: 'total' | 'range' | 'types';
    actualSandwichMode: 'total' | 'types';
    fieldOverrides?: Record<string, any>;
  }
): Record<string, any> {
  const { mode, hasEventRequest, eventRequestStatus, sandwichMode, actualSandwichMode, fieldOverrides } = options;

  // Resolve the effective status once so the status field and the scheduled-date
  // coupling stay consistent. (Schedule mode defaults to 'scheduled'.)
  const resolvedStatus = !hasEventRequest
    ? (formData.status || 'new')
    : mode === 'schedule'
      ? (formData.status || 'scheduled')
      : (formData.status || eventRequestStatus || 'new');

  const eventData: Record<string, any> = {
    // Status logic: different handling per mode (all resolve via resolvedStatus)
    ...(hasEventRequest && mode === 'schedule' ? { status: resolvedStatus } : {}),
    ...(!hasEventRequest ? { status: resolvedStatus } : {}),
    ...(hasEventRequest && mode === 'edit' ? { status: resolvedStatus } : {}),

    // Date fields - always include desiredEventDate so it can be set or cleared intentionally
    desiredEventDate: serializeDateToISO(formData.eventDate),
    dateFlexible: formData.dateFlexible,
    backupDates: formData.backupDates.filter(d => d).map(d => serializeDateToISO(d)),
    // Attach the confirmed scheduled date only when the resolved status is
    // 'scheduled'. (Previously also attached whenever mode === 'schedule', which
    // over-included it for non-scheduled picks like Standby and required a
    // downstream strip in detectChangedFields — removed with full-form save.)
    ...(resolvedStatus === 'scheduled'
      ? { scheduledEventDate: serializeDateToISO(formData.eventDate) }
      : {}),

    // Time fields
    eventStartTime: formData.eventStartTime || null,
    eventEndTime: formData.eventEndTime || null,
    pickupTime: formData.pickupTime || null,
    pickupDateTime: (() => {
      if (formData.pickupDate && formData.pickupTimeSeparate) {
        return `${formData.pickupDate}T${formData.pickupTimeSeparate}`;
      }
      return formData.pickupDateTime || null;
    })(),

    // Location
    eventAddress: formData.eventAddress || null,
    deliveryDestination: formData.deliveryDestination || null,
    overnightHoldingLocation: formData.overnightHoldingLocation || null,
    overnightPickupTime: formData.overnightPickupTime || null,

    // Refrigeration
    hasRefrigeration: formData.hasRefrigeration === 'true' ? true :
                      formData.hasRefrigeration === 'false' ? false : null,

    // Transport & Resources
    driversNeeded: formData.selfTransport ? 0 : (parseInt(formData.driversNeeded?.toString() || '0') || 0),
    selfTransport: formData.selfTransport || false,
    vanDriverNeeded: formData.selfTransport ? false : ((formData.vanDriverNeeded || false) || formData.isDhlVan),
    speakersNeeded: parseInt(formData.speakersNeeded?.toString() || '0') || 0,
    volunteersNeeded: parseInt(formData.volunteersNeeded?.toString() || '0') || 0,
    estimatedAttendance: parseInt(formData.estimatedAttendance?.toString() || '0') || null,

    // Contacts
    tspContact: formData.tspContact || null,
    customTspContact: formData.customTspContact?.trim() || null,

    // Notes
    message: formData.message || null,
    schedulingNotes: formData.schedulingNotes || null,
    planningNotes: formData.planningNotes || null,
    nextAction: formData.nextAction || null,
    driverInstructions: formData.driverInstructions || null,
    volunteerInstructions: formData.volunteerInstructions || null,
    speakerInstructions: formData.speakerInstructions || null,

    // Manual entry
    manualEntrySource: formData.manualEntrySource || null,

    // Contact information
    firstName: formData.firstName?.trim() || null,
    lastName: formData.lastName?.trim() || null,
    email: formData.email?.trim() || null,
    phone: formData.phone?.trim() || null,
    organizationName: formData.organizationName?.trim() || null,
    department: formData.department || null,
    organizationCategory: formData.organizationCategory || null,
    schoolClassification: formData.schoolClassification || null,

    // Backup contact
    backupContactFirstName: formData.backupContactFirstName?.trim() || null,
    backupContactLastName: formData.backupContactLastName?.trim() || null,
    backupContactEmail: formData.backupContactEmail?.trim() || null,
    backupContactPhone: formData.backupContactPhone?.trim() || null,
    backupContactRole: formData.backupContactRole || null,

    // Misc
    previouslyHosted: formData.previouslyHosted || null,
    speakerAudienceType: formData.speakerAudienceType || null,
    speakerDuration: formData.speakerDuration || null,
    deliveryTimeWindow: formData.deliveryTimeWindow || null,
    deliveryParkingAccess: formData.deliveryParkingAccess || null,

    // Van driver
    assignedVanDriverId: formData.isDhlVan
      ? null
      : (formData.assignedVanDriverId && formData.assignedVanDriverId !== 'none')
        ? formData.assignedVanDriverId
        : null,
    isDhlVan: formData.selfTransport ? false : !!formData.isDhlVan,

    // Toolkit
    toolkitSent: formData.toolkitSent || false,
    toolkitStatus: formData.toolkitStatus || null,
    toolkitSentDate: serializeDateToISO(formData.toolkitSentDate),

    // Corporate priority
    isCorporatePriority: formData.isCorporatePriority || false,

    // Standby
    standbyExpectedDate: (() => {
      // Respect an EXPLICIT null/empty override (the "No reminder" choice in
      // the standby dialog must clear the date, not fall back to the stale
      // formData value from the closure) — only fall back when the override
      // key wasn't provided at all.
      const date =
        fieldOverrides && 'standbyExpectedDate' in fieldOverrides
          ? fieldOverrides.standbyExpectedDate
          : formData.standbyExpectedDate;
      return formData.status === 'standby' && date
        ? serializeDateToISO(typeof date === 'string' ? date : new Date(date).toISOString().split('T')[0])
        : null;
    })(),
  };

  // Sandwich data based on mode
  if (sandwichMode === 'total') {
    eventData.estimatedSandwichCount = formData.totalSandwichCount;
    eventData.sandwichTypes = null;
    eventData.estimatedSandwichCountMin = null;
    eventData.estimatedSandwichCountMax = null;
  } else if (sandwichMode === 'range') {
    eventData.estimatedSandwichCountMin = formData.estimatedSandwichCountMin || null;
    eventData.estimatedSandwichCountMax = formData.estimatedSandwichCountMax || null;
    eventData.estimatedSandwichRangeType = formData.rangeSandwichType || null;
    eventData.estimatedSandwichCount = null;
    eventData.sandwichTypes = null;
  } else {
    eventData.sandwichTypes = JSON.stringify(formData.sandwichTypes);
    eventData.estimatedSandwichCount = sumSandwichTypeQuantities(formData.sandwichTypes);
    eventData.estimatedSandwichCountMin = null;
    eventData.estimatedSandwichCountMax = null;
  }

  // Attendee counts
  eventData.volunteerCount = formData.volunteerCount || 0;
  eventData.adultCount = formData.adultCount || 0;
  eventData.childrenCount = formData.childrenCount || 0;
  eventData.kidsAgeRange = formData.kidsAgeRange || null;

  // Completed event tracking
  eventData.socialMediaPostRequested = formData.socialMediaPostRequested;
  eventData.socialMediaPostRequestedDate = serializeDateToISO(formData.socialMediaPostRequestedDate);
  eventData.socialMediaPostCompleted = formData.socialMediaPostCompleted;
  eventData.socialMediaPostCompletedDate = serializeDateToISO(formData.socialMediaPostCompletedDate);
  eventData.socialMediaPostNotes = formData.socialMediaPostNotes || null;

  // Actual sandwich data
  if (actualSandwichMode === 'total') {
    eventData.actualSandwichCount = formData.actualSandwichCount;
    eventData.actualSandwichTypes = null;
  } else {
    eventData.actualSandwichTypes = JSON.stringify(formData.actualSandwichTypes);
    eventData.actualSandwichCount = formData.actualSandwichTypes.reduce((sum, item) => sum + item.quantity, 0);
  }
  eventData.actualSandwichCountRecordedDate = serializeDateToISO(formData.actualSandwichCountRecordedDate);
  eventData.actualSandwichCountRecordedBy = formData.actualSandwichCountRecordedBy || null;

  // Follow-up tracking
  eventData.followUpOneDayCompleted = formData.followUpOneDayCompleted;
  eventData.followUpOneDayDate = serializeDateToISO(formData.followUpOneDayDate);
  eventData.followUpOneMonthCompleted = formData.followUpOneMonthCompleted;
  eventData.followUpOneMonthDate = serializeDateToISO(formData.followUpOneMonthDate);
  eventData.followUpNotes = formData.followUpNotes || null;

  // Recipients
  eventData.assignedRecipientIds = formData.assignedRecipientIds || [];

  return eventData;
}

/**
 * Sum quantities from a sandwichTypes value (array or JSON string).
 */
export function sumSandwichTypeQuantities(sandwichTypes: unknown): number {
  if (!sandwichTypes) return 0;
  try {
    const parsed =
      typeof sandwichTypes === 'string' ? JSON.parse(sandwichTypes) : sandwichTypes;
    if (!Array.isArray(parsed)) return 0;
    return parsed.reduce(
      (sum, item) => sum + (Number((item as { quantity?: number })?.quantity) || 0),
      0,
    );
  } catch {
    return 0;
  }
}

/**
 * Determine sandwich mode from existing event data.
 *
 * When estimatedSandwichCount disagrees with a stale sandwichTypes breakdown,
 * prefer Exact Count so a full-form save does not silently revert the total
 * (e.g. user enters 200 but old types still sum to 198).
 */
export function determineSandwichMode(
  sandwichTypes: any,
  estimatedSandwichCountMin: any,
  estimatedSandwichCountMax: any,
  estimatedSandwichCount?: number | null,
): 'total' | 'range' | 'types' {
  const hasRangeData = estimatedSandwichCountMin && estimatedSandwichCountMax;
  if (hasRangeData) return 'range';

  let parsed: unknown[] = [];
  try {
    parsed = sandwichTypes
      ? typeof sandwichTypes === 'string'
        ? JSON.parse(sandwichTypes)
        : sandwichTypes
      : [];
  } catch {
    parsed = [];
  }
  const hasTypesData = Array.isArray(parsed) && parsed.length > 0;
  if (!hasTypesData) return 'total';

  const typesTotal = sumSandwichTypeQuantities(parsed);
  const storedTotal =
    typeof estimatedSandwichCount === 'number' && estimatedSandwichCount > 0
      ? estimatedSandwichCount
      : null;

  if (storedTotal !== null && typesTotal !== storedTotal) {
    return 'total';
  }

  return 'types';
}

/**
 * Determine actual sandwich mode from existing event data.
 */
export function determineActualSandwichMode(actualSandwichTypes: any): 'total' | 'types' {
  const parsed = actualSandwichTypes ?
    (typeof actualSandwichTypes === 'string' ? JSON.parse(actualSandwichTypes) : actualSandwichTypes) : [];
  return Array.isArray(parsed) && parsed.length > 0 ? 'types' : 'total';
}

/**
 * Calculate total relevant sandwiches for speaker warning check.
 * Returns the count of sandwiches that should trigger a speaker recommendation.
 */
export function calculateRelevantSandwichCount(
  formData: EventFormData,
  sandwichMode: 'total' | 'range' | 'types'
): number {
  if (sandwichMode === 'types' && formData.sandwichTypes?.length > 0) {
    return formData.sandwichTypes
      .filter(item => {
        const typeLower = item.type.toLowerCase();
        return typeLower === 'deli' || typeLower.includes('deli') ||
               typeLower === 'turkey' || typeLower === 'deli_turkey' ||
               typeLower === 'unknown';
      })
      .reduce((sum, item) => sum + item.quantity, 0);
  } else if (sandwichMode === 'total' && formData.totalSandwichCount > 500) {
    return formData.totalSandwichCount;
  } else if (sandwichMode === 'range') {
    const maxCount = formData.estimatedSandwichCountMax || formData.estimatedSandwichCountMin || 0;
    return maxCount > 500 ? maxCount : 0;
  }
  return 0;
}
