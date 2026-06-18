jest.mock('@/lib/logger', () => ({ logger: { log() {}, warn() {}, error() {}, info() {} } }));
jest.mock('@/lib/queryClient', () => ({ apiRequest: jest.fn() }));

import {
  findMismatchedSavedFields,
  getDroppedServerFields,
  buildEventDataForServer,
} from '../form-utils';

const baseFormData: any = {
  eventDate: '2026-06-15',
  backupDates: [],
  sandwichTypes: [],
  totalSandwichCount: 100,
  estimatedSandwichCountMin: 0,
  estimatedSandwichCountMax: 0,
  actualSandwichTypes: [],
  assignedRecipientIds: [],
  speakersNeeded: 0,
  driversNeeded: 0,
  volunteersNeeded: 0,
};

// Full-form save (B5) sends the entire buildEventDataForServer() output every
// time, so these assertions check the builder directly. The schedule-mode
// status/date consistency that used to live in detectChangedFields now lives in
// buildEventDataForServer: the scheduled date is attached only when the resolved
// status is 'scheduled'.
function buildScheduleData(formStatus: string | undefined, eventDate?: string) {
  const formData: any = { ...baseFormData, ...(eventDate ? { eventDate } : {}) };
  if (formStatus === undefined) {
    delete formData.status;
  } else {
    formData.status = formStatus;
  }
  return buildEventDataForServer(formData, {
    mode: 'schedule',
    hasEventRequest: true,
    eventRequestStatus: 'in_process',
    sandwichMode: 'total',
    actualSandwichMode: 'total',
  });
}

describe('Mark Scheduled status handling (full-form save)', () => {
  it('defaults the saved status to "scheduled" and includes the scheduled date', () => {
    const payload = buildScheduleData('scheduled');
    expect(payload.status).toBe('scheduled');
    expect(payload.scheduledEventDate).toBe('2026-06-15');
    expect(payload.desiredEventDate).toBe('2026-06-15');
  });

  it('respects an explicit non-scheduled choice (e.g. Standby) and attaches no scheduled date', () => {
    const payload = buildScheduleData('standby');
    expect(payload.status).toBe('standby');
    // No confirmed scheduled date when the user is not actually scheduling.
    expect(payload.scheduledEventDate).toBeUndefined();
    // The desired date still flows through.
    expect(payload.desiredEventDate).toBe('2026-06-15');
  });

  it('does NOT leak scheduledEventDate when status is non-scheduled AND the date changed', () => {
    // Open "Mark Scheduled", pick Standby, and ALSO change the date. The builder
    // must not stamp a confirmed scheduled date alongside a standby status, but
    // the desired date change must still flow through.
    const payload = buildScheduleData('standby', '2026-07-20');
    expect(payload.status).toBe('standby');
    expect(payload.scheduledEventDate).toBeUndefined();
    expect(payload.desiredEventDate).toBe('2026-07-20');
  });

  it('still sends scheduledEventDate when scheduling AND the date changed', () => {
    const payload = buildScheduleData('scheduled', '2026-07-20');
    expect(payload.status).toBe('scheduled');
    expect(payload.scheduledEventDate).toBe('2026-07-20');
  });

  it('falls back to "scheduled" (and attaches the date) when the form has no status set', () => {
    const payload = buildScheduleData(undefined);
    expect(payload.status).toBe('scheduled');
    expect(payload.scheduledEventDate).toBe('2026-06-15');
  });

  it('always includes the critical van/transport booleans (no longer change-detected)', () => {
    // Previously these relied on ALWAYS_INCLUDE_FIELDS to avoid being dropped.
    // Full-form save sends them unconditionally as part of the built payload.
    const payload = buildScheduleData('scheduled');
    expect(payload).toHaveProperty('vanDriverNeeded');
    expect(payload).toHaveProperty('isDhlVan');
    expect(payload).toHaveProperty('selfTransport');
  });
});

/**
 * Regression coverage for the "Mark Scheduled won't save" bug.
 *
 * A successful (HTTP 200) PATCH used to be treated as a *partial* save — keeping
 * the dialog open and preserving the draft — whenever the heuristic
 * `findMismatchedSavedFields` flagged any field. That heuristic produces false
 * positives for routine server behaviour, so every save looked like it silently
 * failed. The fix: only the server-authoritative `_droppedFields` marker may
 * block save completion.
 */
describe('Mark Scheduled save completion gating', () => {
  it('does NOT block a successful save just because the heuristic comparison flags fields', () => {
    // A realistic PATCH payload sent when marking an event scheduled.
    const sentPayload: Record<string, any> = {
      status: 'scheduled',
      scheduledEventDate: '2026-06-15',
      desiredEventDate: '2026-06-15',
      vanDriverNeeded: false,
      isDhlVan: false,
      selfTransport: false,
      driversNeeded: 0,
      sandwichTypes: JSON.stringify([]),
      assignedRecipientIds: [],
    };

    // A realistic server response: the event WAS saved, but the server transforms
    // / omits some fields (null vs false, auto-bumped counts, join-table arrays,
    // parsed JSON columns). No `_droppedFields` marker => nothing was actually dropped.
    const savedEvent: Record<string, any> = {
      id: 123,
      status: 'scheduled',
      scheduledEventDate: '2026-06-15T12:00:00.000Z',
      desiredEventDate: '2026-06-15T12:00:00.000Z',
      vanDriverNeeded: null, // server stored null, client sent false
      isDhlVan: false,
      selfTransport: false,
      driversNeeded: 2, // server auto-bumped to match assigned drivers
      sandwichTypes: [], // jsonb column returned as a parsed array, not a string
      isConfirmed: true,
      // assignedRecipientIds intentionally absent (stored in a join table)
    };

    // The heuristic comparison flags several fields (this is expected & why it
    // must not be used to block saves)...
    const mismatched = findMismatchedSavedFields(sentPayload, savedEvent);
    expect(mismatched.length).toBeGreaterThan(0);

    // ...but since the server reported no dropped fields, the save must complete.
    expect(getDroppedServerFields(savedEvent)).toEqual([]);
  });

  it('DOES surface a partial save when the server reports dropped fields', () => {
    const savedEvent: Record<string, any> = {
      id: 123,
      status: 'scheduled',
      _droppedFields: [
        { field: 'addedToOfficialSheetAt', reason: 'Database column not available on this branch (migration pending)' },
      ],
    };

    const dropped = getDroppedServerFields(savedEvent);
    expect(dropped).toHaveLength(1);
    expect(dropped[0].field).toBe('addedToOfficialSheetAt');
  });

  it('treats a response with no marker as a clean save', () => {
    expect(getDroppedServerFields({ id: 1, status: 'scheduled' })).toEqual([]);
    expect(getDroppedServerFields(null)).toEqual([]);
    expect(getDroppedServerFields(undefined)).toEqual([]);
  });
});
