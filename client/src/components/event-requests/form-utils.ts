/**
 * EventSchedulingForm - Utility Functions
 *
 * Extracted from EventSchedulingForm.tsx to:
 * 1. Eliminate duplication in form data serialization
 * 2. Make change detection logic testable
 * 3. Simplify the performSubmit function
 */

import { FIELD_MAPPINGS } from './fieldConfig';
import type { EventFormData } from './form-sections/types';

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

  const eventData: Record<string, any> = {
    // Status logic: different handling per mode
    ...(hasEventRequest && mode === 'schedule' ? { status: 'scheduled' } : {}),
    ...(!hasEventRequest ? { status: formData.status || 'new' } : {}),
    ...(hasEventRequest && mode === 'edit' ? { status: formData.status || eventRequestStatus || 'new' } : {}),

    // Date fields - always include desiredEventDate so it can be set or cleared intentionally
    desiredEventDate: serializeDateToISO(formData.eventDate),
    dateFlexible: formData.dateFlexible,
    backupDates: formData.backupDates.filter(d => d).map(d => serializeDateToISO(d)),
    // In schedule mode OR when status is 'scheduled', always sync scheduledEventDate with the event date
    ...(formData.status === 'scheduled' || mode === 'schedule'
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
    firstName: formData.firstName || null,
    lastName: formData.lastName || null,
    email: formData.email || null,
    phone: formData.phone || null,
    organizationName: formData.organizationName || null,
    department: formData.department || null,
    organizationCategory: formData.organizationCategory || null,
    schoolClassification: formData.schoolClassification || null,

    // Backup contact
    backupContactFirstName: formData.backupContactFirstName || null,
    backupContactLastName: formData.backupContactLastName || null,
    backupContactEmail: formData.backupContactEmail || null,
    backupContactPhone: formData.backupContactPhone || null,
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
      const date = fieldOverrides?.standbyExpectedDate || formData.standbyExpectedDate;
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
    eventData.estimatedSandwichCount = formData.sandwichTypes.reduce((sum, item) => sum + item.quantity, 0);
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
 * Normalize a date string for comparison.
 * Extracts YYYY-MM-DD from ISO strings.
 */
function normalizeDateForCompare(value: any): string | null {
  if (!value) return null;
  if (typeof value !== 'string') return String(value);
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : value;
}

/** Date field names that need special comparison logic (both server and client names) */
const DATE_COMPARE_FIELDS = [
  'desiredEventDate', 'eventDate', 'scheduledEventDate', 'toolkitSentDate',
  'socialMediaPostRequestedDate', 'socialMediaPostCompletedDate', 'actualSandwichCountRecordedDate',
  'followUpOneDayDate', 'followUpOneMonthDate', 'standbyExpectedDate',
];

/**
 * Detect which fields have changed between the original form data and the
 * new server payload. Returns only the changed fields.
 *
 * This is used to send minimal PATCH payloads, preventing accidental
 * overwrites of fields the user didn't touch.
 */
export function detectChangedFields(
  eventData: Record<string, any>,
  originalFormData: Record<string, any>,
  mode: 'schedule' | 'edit' | 'create'
): Record<string, any> {
  const filteredEventData: Record<string, any> = {};

  // Extended mapping: scheduledEventDate maps back to eventDate in the form
  // since the form uses eventDate for both desired and scheduled dates
  const getOriginalFieldKey = (serverKey: string): string => {
    if (serverKey === 'scheduledEventDate') return 'eventDate';
    return (FIELD_MAPPINGS.serverToClient as Record<string, string>)[serverKey] || serverKey;
  };

  const hasChanged = (key: string, newValue: any): boolean => {
    const formDataKey = getOriginalFieldKey(key);
    const originalValue = originalFormData[formDataKey];

    // Array comparison
    if (Array.isArray(newValue) && Array.isArray(originalValue)) {
      const normalizedNew = newValue.map(v => normalizeDateForCompare(v));
      const normalizedOrig = originalValue.map(v => normalizeDateForCompare(v));
      return JSON.stringify(normalizedNew) !== JSON.stringify(normalizedOrig);
    }

    // Date field comparison - use normalization so "2024-03-15" matches "2024-03-15T00:00:00.000Z"
    if (DATE_COMPARE_FIELDS.includes(key) || DATE_COMPARE_FIELDS.includes(formDataKey)) {
      return normalizeDateForCompare(newValue) !== normalizeDateForCompare(originalValue);
    }

    // Null/empty/undefined equivalence
    const normalizedNew = newValue === '' || newValue === null || newValue === undefined ? null : newValue;
    const normalizedOrig = originalValue === '' || originalValue === null || originalValue === undefined ? null : originalValue;

    return normalizedNew !== normalizedOrig;
  };

  // Include only fields that actually changed
  Object.keys(eventData).forEach(key => {
    if (hasChanged(key, eventData[key])) {
      filteredEventData[key] = eventData[key];
    }
  });

  // Schedule mode safety: always ensure status and date are present
  if (mode === 'schedule') {
    filteredEventData.status = 'scheduled';
    // Always include scheduledEventDate in schedule mode - use the date from eventData
    const schedDate = eventData.scheduledEventDate || eventData.desiredEventDate;
    if (schedDate) {
      filteredEventData.scheduledEventDate = schedDate;
    }
    // Also always include desiredEventDate if it has a value, so the date is never lost
    // when scheduling an event
    if (eventData.desiredEventDate) {
      filteredEventData.desiredEventDate = eventData.desiredEventDate;
    }
  }

  return filteredEventData;
}

/**
 * Determine sandwich mode from existing event data.
 */
export function determineSandwichMode(
  sandwichTypes: any,
  estimatedSandwichCountMin: any,
  estimatedSandwichCountMax: any
): 'total' | 'range' | 'types' {
  const parsed = sandwichTypes ?
    (typeof sandwichTypes === 'string' ? JSON.parse(sandwichTypes) : sandwichTypes) : [];
  const hasTypesData = Array.isArray(parsed) && parsed.length > 0;
  const hasRangeData = estimatedSandwichCountMin && estimatedSandwichCountMax;
  return hasTypesData ? 'types' : hasRangeData ? 'range' : 'total';
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
