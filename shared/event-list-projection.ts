import type { EventRequest } from './schema';

/**
 * Single source of truth for the lightweight event-list projection.
 *
 * `GET /api/event-requests/list` returns exactly this shape. The exported
 * `LightweightEventRequest` type (`ReturnType<typeof toLightweightEventRequest>`)
 * is derived from it. Once the client types the list query / card props as
 * `LightweightEventRequest`, the server payload and the client type can no
 * longer drift — a field a card reads but the list doesn't send would become a
 * compile error instead of a blank card ("Cause B").
 *
 * NOTE: that client-side adoption is NOT wired up yet (deferred — it's entangled
 * with schema type debt; see PR notes). Today this centralizes the list shape in
 * one place and fixes known drift; it does not yet enforce the contract at
 * compile time.
 *
 * To expose a new field to the cards: add it here, once.
 *
 * Keep this a pure projection (field copies + the few documented computed
 * fields). Anything heavier belongs in the full-record endpoint.
 */
export function toLightweightEventRequest(event: EventRequest) {
  return {
    // ========== IDENTITY ==========
    id: event.id,

    // ========== ORGANIZATION (All cards) ==========
    organizationName: event.organizationName,
    organizationCategory: event.organizationCategory,
    department: event.department,
    partnerOrganizations: event.partnerOrganizations,

    // ========== CONTACT (All cards, IntakeCallDialog) ==========
    firstName: event.firstName,
    lastName: event.lastName,
    email: event.email,
    phone: event.phone,
    backupContactFirstName: event.backupContactFirstName,
    backupContactLastName: event.backupContactLastName,
    backupContactEmail: event.backupContactEmail,
    backupContactPhone: event.backupContactPhone,
    backupContactRole: event.backupContactRole,

    // ========== DATES (All cards) ==========
    desiredEventDate: event.desiredEventDate,
    scheduledEventDate: event.scheduledEventDate,
    isConfirmed: event.isConfirmed,
    backupDates: event.backupDates,

    // ========== STATUS & WORKFLOW ==========
    status: event.status,
    statusChangedAt: event.statusChangedAt,
    assignedTo: event.assignedTo,
    nextAction: event.nextAction,
    message: event.message,
    scheduledCallDate: event.scheduledCallDate,

    // ========== LOCATION (ScheduledCard, NewRequestCard) ==========
    eventAddress: event.eventAddress,
    latitude: event.latitude,
    longitude: event.longitude,

    // ========== SANDWICH COUNTS & TYPES ==========
    estimatedSandwichCount: event.estimatedSandwichCount,
    estimatedSandwichCountMin: event.estimatedSandwichCountMin,
    estimatedSandwichCountMax: event.estimatedSandwichCountMax,
    estimatedSandwichRangeType: event.estimatedSandwichRangeType,
    actualSandwichCount: event.actualSandwichCount,
    sandwichTypes: event.sandwichTypes,
    hasRefrigeration: event.hasRefrigeration,
    volunteerCount: event.volunteerCount,
    actualAttendance: event.actualAttendance,
    estimatedAttendance: event.estimatedAttendance,
    attendanceAdults: event.attendanceAdults,
    attendanceTeens: event.attendanceTeens,
    attendanceKids: event.attendanceKids,

    // ========== DRIVER STAFFING ==========
    driversNeeded: event.driversNeeded,
    assignedDriverIds: event.assignedDriverIds,
    driverDetails: event.driverDetails,
    selfTransport: event.selfTransport,
    tentativeDriverIds: event.tentativeDriverIds,

    // ========== SPEAKER STAFFING ==========
    speakersNeeded: event.speakersNeeded,
    assignedSpeakerIds: event.assignedSpeakerIds,
    tentativeSpeakerIds: event.tentativeSpeakerIds,
    speakerDetails: event.speakerDetails,

    // ========== VOLUNTEER STAFFING ==========
    volunteersNeeded: event.volunteersNeeded,
    assignedVolunteerIds: event.assignedVolunteerIds,
    tentativeVolunteerIds: event.tentativeVolunteerIds,
    volunteerDetails: event.volunteerDetails,

    // ========== VAN DRIVER ==========
    vanDriverNeeded: event.vanDriverNeeded,
    vanNeededLikely: event.vanNeededLikely, // read by InProcess/Scheduled cards — was missing from the list (live Cause B)
    assignedVanDriverId: event.assignedVanDriverId,
    isDhlVan: event.isDhlVan,
    customVanDriverName: event.customVanDriverName,

    // ========== TSP CONTACT (All cards) ==========
    tspContact: event.tspContact,
    tspContactAssigned: event.tspContactAssigned,
    customTspContact: event.customTspContact,
    tspContactAssignedDate: event.tspContactAssignedDate,

    // ========== TOOLKIT STATUS ==========
    toolkitSent: event.toolkitSent,
    toolkitStatus: event.toolkitStatus,

    // ========== TIMES (ScheduledCard, EventEditDialog) ==========
    eventStartTime: event.eventStartTime,
    eventEndTime: event.eventEndTime,
    pickupTime: event.pickupTime,
    pickupDateTime: event.pickupDateTime,
    pickupTimeWindow: event.pickupTimeWindow,

    // ========== TRACKING FLAGS ==========
    addedToOfficialSheet: event.addedToOfficialSheet,
    addedToOfficialSheetAt: event.addedToOfficialSheetAt,
    showOnVolunteerHub: event.showOnVolunteerHub,
    isUnresponsive: event.isUnresponsive,
    contactAttempts: event.contactAttempts,
    lastContactAttempt: event.lastContactAttempt,
    hasHostedBefore: event.previouslyHosted === 'yes', // computed from previouslyHosted
    previouslyHosted: event.previouslyHosted,

    // ========== NOTES (ScheduledCard, ScheduledCardEnhanced) ==========
    planningNotes: event.planningNotes,
    schedulingNotes: event.schedulingNotes,
    contactAttemptsLog: event.contactAttemptsLog,
    unresponsiveNotes: event.unresponsiveNotes,
    followUpNotes: event.followUpNotes,
    distributionNotes: event.distributionNotes,
    duplicateNotes: event.duplicateNotes,
    socialMediaPostNotes: event.socialMediaPostNotes,
    socialMediaPostRequested: event.socialMediaPostRequested,
    socialMediaPostRequestedDate: event.socialMediaPostRequestedDate,
    socialMediaPostCompleted: event.socialMediaPostCompleted,
    socialMediaPostCompletedDate: event.socialMediaPostCompletedDate,
    socialMediaPostLink: event.socialMediaPostLink,

    // ========== RECIPIENT ALLOCATION (ScheduledCard, SpreadsheetView) ==========
    assignedRecipientIds: event.assignedRecipientIds,
    recipientAllocations: event.recipientAllocations,

    // ========== SPECIAL FLAGS ==========
    isMlkDayEvent: event.isMlkDayEvent,
    isCorporatePriority: event.isCorporatePriority,
    externalId: event.externalId,
    overnightHoldingLocation: event.overnightHoldingLocation,

    // ========== POSTPONEMENT (PostponedCard) ==========
    tentativeNewDate: event.tentativeNewDate,
    postponementReason: event.postponementReason,

    // ========== NON-EVENT (NonEventCard) ==========
    // Added with the §B9 projection: these were read by NonEventCard but were
    // missing from the old hand-maintained mapper, so the reason/notes rendered
    // blank on Non-Event cards (a live "Cause B" instance).
    nonEventReason: event.nonEventReason,
    nonEventNotes: event.nonEventNotes,
    nonEventBy: event.nonEventBy,
    nonEventAt: event.nonEventAt,

    // ========== TIMESTAMPS ==========
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

/**
 * The exact shape returned by `GET /api/event-requests/list`. Derived from the
 * projection above so it can never drift from what the server actually sends.
 */
export type LightweightEventRequest = ReturnType<typeof toLightweightEventRequest>;
