jest.mock('@/lib/logger', () => ({ logger: { log() {}, warn() {}, error() {}, info() {} } }));
jest.mock('@/lib/queryClient', () => ({ apiRequest: jest.fn() }));

import {
  findMismatchedSavedFields,
  getDroppedServerFields,
  buildEventDataForServer,
  detectChangedFields,
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

function buildSchedulePayload(formStatus: string) {
  const formData = { ...baseFormData, status: formStatus };
  const original = { ...baseFormData, status: 'in_process' };
  const eventData = buildEventDataForServer(formData, {
    mode: 'schedule',
    hasEventRequest: true,
    eventRequestStatus: 'in_process',
    sandwichMode: 'total',
    actualSandwichMode: 'total',
  });
  return detectChangedFields(eventData, original, 'schedule');
}

describe('Mark Scheduled status handling', () => {
  it('defaults the saved status to "scheduled" and includes the scheduled date', () => {
    const payload = buildSchedulePayload('scheduled');
    expect(payload.status).toBe('scheduled');
    expect(payload.scheduledEventDate).toBe('2026-06-15');
  });

  it('respects an explicit non-scheduled choice (e.g. Standby) instead of forcing scheduled', () => {
    const payload = buildSchedulePayload('standby');
    expect(payload.status).toBe('standby');
    // No scheduled date should be attached when the user is not actually scheduling.
    expect(payload.scheduledEventDate).toBeUndefined();
  });

  it('does NOT leak scheduledEventDate when status is non-scheduled AND the date changed', () => {
    // Regression: opening "Mark Scheduled", picking Standby, and ALSO changing the date.
    // The form is in schedule mode so scheduledEventDate is populated, and because the
    // date differs from the original, change-detection would include it. It must be
    // stripped so a confirmed scheduled date isn't sent alongside a standby status.
    const formData = { ...baseFormData, status: 'standby', eventDate: '2026-07-20' };
    const original = { ...baseFormData, status: 'in_process', eventDate: '2026-06-15' };
    const eventData = buildEventDataForServer(formData, {
      mode: 'schedule',
      hasEventRequest: true,
      eventRequestStatus: 'in_process',
      sandwichMode: 'total',
      actualSandwichMode: 'total',
    });
    const payload = detectChangedFields(eventData, original, 'schedule');

    expect(payload.status).toBe('standby');
    expect(payload.scheduledEventDate).toBeUndefined();
    // The desired date should still flow through so the date change isn't lost.
    expect(payload.desiredEventDate).toBe('2026-07-20');
  });

  it('KEEPS scheduledEventDate for rescheduled (a confirmed-calendar status) when the date changed', () => {
    // Rescheduled is "a previously scheduled event assigned a new confirmed date" and is
    // treated like scheduled, so the new confirmed date must persist on scheduledEventDate.
    const formData = { ...baseFormData, status: 'rescheduled', eventDate: '2026-07-20' };
    const original = { ...baseFormData, status: 'scheduled', eventDate: '2026-06-15' };
    const eventData = buildEventDataForServer(formData, {
      mode: 'schedule',
      hasEventRequest: true,
      eventRequestStatus: 'scheduled',
      sandwichMode: 'total',
      actualSandwichMode: 'total',
    });
    const payload = detectChangedFields(eventData, original, 'schedule');

    expect(payload.status).toBe('rescheduled');
    expect(payload.scheduledEventDate).toBe('2026-07-20');
  });

  it('still sends scheduledEventDate when scheduling AND the date changed', () => {
    const formData = { ...baseFormData, status: 'scheduled', eventDate: '2026-07-20' };
    const original = { ...baseFormData, status: 'in_process', eventDate: '2026-06-15' };
    const eventData = buildEventDataForServer(formData, {
      mode: 'schedule',
      hasEventRequest: true,
      eventRequestStatus: 'in_process',
      sandwichMode: 'total',
      actualSandwichMode: 'total',
    });
    const payload = detectChangedFields(eventData, original, 'schedule');

    expect(payload.status).toBe('scheduled');
    expect(payload.scheduledEventDate).toBe('2026-07-20');
  });

  it('falls back to "scheduled" when the form has no status set', () => {
    const formData = { ...baseFormData };
    delete formData.status;
    const eventData = buildEventDataForServer(formData, {
      mode: 'schedule',
      hasEventRequest: true,
      eventRequestStatus: 'in_process',
      sandwichMode: 'total',
      actualSandwichMode: 'total',
    });
    const payload = detectChangedFields(eventData, { ...baseFormData, status: 'in_process' }, 'schedule');
    expect(payload.status).toBe('scheduled');
  });
});

// Edit mode runs a different code path: the schedule-mode safety block in
// detectChangedFields does NOT run, so scheduledEventDate handling depends entirely
// on buildEventDataForServer including it. These cover the full status x date matrix
// for in-place edits.
describe('Edit mode date/status handling', () => {
  function buildEditPayload(formStatus: string, newDate: string, originalStatus: string, originalDate: string) {
    const formData = { ...baseFormData, status: formStatus, eventDate: newDate };
    const original = { ...baseFormData, status: originalStatus, eventDate: originalDate };
    const eventData = buildEventDataForServer(formData, {
      mode: 'edit',
      hasEventRequest: true,
      eventRequestStatus: originalStatus,
      sandwichMode: 'total',
      actualSandwichMode: 'total',
    });
    return detectChangedFields(eventData, original, 'edit');
  }

  it('persists scheduledEventDate when editing a SCHEDULED event\'s date', () => {
    const payload = buildEditPayload('scheduled', '2026-07-20', 'scheduled', '2026-06-15');
    expect(payload.scheduledEventDate).toBe('2026-07-20');
  });

  it('persists scheduledEventDate when editing a RESCHEDULED event\'s date', () => {
    // Regression: rescheduled is a confirmed-calendar status, so its new date must
    // persist on scheduledEventDate even in edit mode (where the schedule-mode safety
    // block does not run).
    const payload = buildEditPayload('rescheduled', '2026-07-20', 'rescheduled', '2026-06-15');
    expect(payload.scheduledEventDate).toBe('2026-07-20');
  });

  it('persists scheduledEventDate when moving scheduled -> rescheduled with a new date', () => {
    const payload = buildEditPayload('rescheduled', '2026-07-20', 'scheduled', '2026-06-15');
    expect(payload.status).toBe('rescheduled');
    expect(payload.scheduledEventDate).toBe('2026-07-20');
  });

  it('does NOT send scheduledEventDate when editing a non-calendar status (e.g. standby)', () => {
    const payload = buildEditPayload('standby', '2026-07-20', 'standby', '2026-06-15');
    expect(payload.scheduledEventDate).toBeUndefined();
    // Desired date still flows through so the edit isn't lost.
    expect(payload.desiredEventDate).toBe('2026-07-20');
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
