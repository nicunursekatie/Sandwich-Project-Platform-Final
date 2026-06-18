import {
  requiresReason,
  getReasonField,
  getReasonSatisfyingFields,
  getScheduledDateDefault,
  STATUS_REASON_FIELD,
} from '@shared/event-status-workflow';

// These helpers are the single source of truth for "which transitions need a
// reason" and the pure "scheduled -> default to desired date" side-effect.
// Both the client status handler and the server PATCH handler consume them, so
// the rules can't drift between layers.

describe('requiresReason / getReasonField', () => {
  it('requires a reason for declined, cancelled, and non_event', () => {
    expect(requiresReason('declined')).toBe(true);
    expect(requiresReason('cancelled')).toBe(true);
    expect(requiresReason('non_event')).toBe(true);
  });

  it('does NOT require a reason for other statuses', () => {
    // rescheduled needs a date (not a reason); standby/stalled are optional by design
    for (const s of ['new', 'in_process', 'scheduled', 'rescheduled', 'completed', 'standby', 'stalled'] as const) {
      expect(requiresReason(s)).toBe(false);
    }
  });

  it('maps each reason-required status to its reason column', () => {
    expect(getReasonField('declined')).toBe('declinedReason');
    expect(getReasonField('cancelled')).toBe('cancelledReason');
    expect(getReasonField('non_event')).toBe('nonEventReason');
    expect(getReasonField('scheduled')).toBeUndefined();
  });

  it('keeps STATUS_REASON_FIELD and the helpers in sync', () => {
    for (const status of Object.keys(STATUS_REASON_FIELD)) {
      expect(requiresReason(status as any)).toBe(true);
      expect(getReasonField(status as any)).toBe((STATUS_REASON_FIELD as any)[status]);
    }
  });

  it('does not treat prototype keys as reason-required (own-property check)', () => {
    for (const key of ['toString', 'constructor', 'hasOwnProperty', '__proto__']) {
      expect(requiresReason(key as any)).toBe(false);
      expect(getReasonField(key as any)).toBeUndefined();
      expect(getReasonSatisfyingFields(key as any)).toEqual([]);
    }
  });
});

describe('getReasonSatisfyingFields', () => {
  it('accepts the structured reason, the matching notes, and general notes', () => {
    // The full-form scheduling path records the reason in planning/scheduling
    // notes rather than the structured column, so those must satisfy the guard.
    expect(getReasonSatisfyingFields('declined')).toEqual(
      expect.arrayContaining(['declinedReason', 'declinedNotes', 'planningNotes', 'schedulingNotes']),
    );
    expect(getReasonSatisfyingFields('cancelled')).toEqual(
      expect.arrayContaining(['cancelledReason', 'cancelledNotes', 'planningNotes', 'schedulingNotes']),
    );
    expect(getReasonSatisfyingFields('non_event')).toEqual(
      expect.arrayContaining(['nonEventReason', 'nonEventNotes', 'planningNotes', 'schedulingNotes']),
    );
  });

  it('prefers the structured reason column first', () => {
    expect(getReasonSatisfyingFields('declined')[0]).toBe('declinedReason');
  });

  it('returns nothing for statuses that do not require a reason', () => {
    expect(getReasonSatisfyingFields('scheduled')).toEqual([]);
    expect(getReasonSatisfyingFields('standby')).toEqual([]);
  });
});

describe('getScheduledDateDefault', () => {
  it('defaults to the desired date when scheduling with no scheduled date', () => {
    expect(getScheduledDateDefault('scheduled', null, '2026-07-01')).toBe('2026-07-01');
    expect(getScheduledDateDefault('scheduled', undefined, '2026-07-01')).toBe('2026-07-01');
  });

  it('does not override an existing scheduled date', () => {
    expect(getScheduledDateDefault('scheduled', '2026-06-15', '2026-07-01')).toBeUndefined();
  });

  it('returns undefined when there is no desired date to fall back to', () => {
    expect(getScheduledDateDefault('scheduled', null, null)).toBeUndefined();
    expect(getScheduledDateDefault('scheduled', null, undefined)).toBeUndefined();
  });

  it('only applies to the scheduled status', () => {
    expect(getScheduledDateDefault('completed', null, '2026-07-01')).toBeUndefined();
    expect(getScheduledDateDefault('standby', null, '2026-07-01')).toBeUndefined();
    expect(getScheduledDateDefault('rescheduled', null, '2026-07-01')).toBeUndefined();
  });
});
