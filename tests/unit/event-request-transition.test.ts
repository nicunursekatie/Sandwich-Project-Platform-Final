import {
  applyEventRequestTransition,
  type EventTransitionContext,
} from '@shared/event-status-workflow';

// applyEventRequestTransition is the single, pure home for every status-derived
// side-effect of an event-request PATCH (extracted from the server handler in
// save-path PR-B). These tests lock the behavior that used to live inline so the
// extraction is verifiably faithful.

const NOW = new Date('2026-07-04T12:00:00.000Z');
const ctx: EventTransitionContext = { now: NOW, userId: 'user-123' };

describe('applyEventRequestTransition — validation gates', () => {
  it('rejects an invalid transition without mutating anything', () => {
    const patch = { status: 'scheduled' };
    const result = applyEventRequestTransition({ status: 'new' }, patch, ctx);
    expect(result.error).toEqual({
      code: 'INVALID_STATUS_TRANSITION',
      message: expect.any(String),
      currentStatus: 'new',
      requestedStatus: 'scheduled',
    });
    // The input patch is never mutated.
    expect(patch).toEqual({ status: 'scheduled' });
  });

  it('rejects a reason-required transition with no reason', () => {
    const result = applyEventRequestTransition({ status: 'new' }, { status: 'declined' }, ctx);
    expect(result.error).toEqual({
      code: 'MISSING_REASON',
      message: expect.stringContaining('declined'),
      requestedStatus: 'declined',
      reasonField: 'declinedReason',
    });
  });

  it('accepts a reason-required transition when the structured reason is present', () => {
    const result = applyEventRequestTransition(
      { status: 'new' },
      { status: 'declined', declinedReason: 'Group cancelled' },
      ctx,
    );
    expect(result.error).toBeUndefined();
    expect(result.patch.declinedAt).toBe(NOW);
    expect(result.patch.declinedBy).toBe('user-123');
  });

  it('accepts a reason recorded in general notes (full-form path)', () => {
    const result = applyEventRequestTransition(
      { status: 'in_process' },
      { status: 'non_event', planningNotes: 'Was a duplicate submission' },
      ctx,
    );
    expect(result.error).toBeUndefined();
    expect(result.patch.nonEventAt).toBe(NOW);
    expect(result.patch.nonEventBy).toBe('user-123');
  });
});

describe('applyEventRequestTransition — scheduling side-effects', () => {
  it('stamps statusChangedAt, auto-confirms, and exposes on the hub', () => {
    const result = applyEventRequestTransition(
      { status: 'in_process', desiredEventDate: '2026-08-01', showOnVolunteerHub: false },
      { status: 'scheduled' },
      ctx,
    );
    expect(result.error).toBeUndefined();
    expect(result.patch.statusChangedAt).toBe(NOW);
    expect(result.patch.isConfirmed).toBe(true);
    expect(result.patch.showOnVolunteerHub).toBe(true);
    // No scheduled date supplied → falls back to the desired date.
    expect(result.patch.scheduledEventDate).toBe('2026-08-01');
  });

  it('respects an explicit isConfirmed:false alongside scheduling', () => {
    const result = applyEventRequestTransition(
      { status: 'in_process', desiredEventDate: '2026-08-01' },
      { status: 'scheduled', isConfirmed: false },
      ctx,
    );
    expect(result.patch.isConfirmed).toBe(false);
  });

  it('does not re-expose on the hub when the event was already shown', () => {
    const result = applyEventRequestTransition(
      { status: 'in_process', showOnVolunteerHub: true },
      { status: 'scheduled' },
      ctx,
    );
    // Only set on the transition when it was previously off; never forced.
    expect(result.patch.showOnVolunteerHub).toBeUndefined();
  });

  it('keeps an explicitly-provided scheduled date over the desired fallback', () => {
    const result = applyEventRequestTransition(
      { status: 'in_process', desiredEventDate: '2026-08-01' },
      { status: 'scheduled', scheduledEventDate: '2026-08-15' },
      ctx,
    );
    expect(result.patch.scheduledEventDate).toBe('2026-08-15');
  });
});

describe('applyEventRequestTransition — terminal + reschedule metadata', () => {
  it('auto-confirms on completion', () => {
    const result = applyEventRequestTransition({ status: 'scheduled' }, { status: 'completed' }, ctx);
    expect(result.patch.isConfirmed).toBe(true);
    expect(result.patch.statusChangedAt).toBe(NOW);
  });

  it('stamps cancelled metadata (with a reason)', () => {
    const result = applyEventRequestTransition(
      { status: 'scheduled' },
      { status: 'cancelled', cancelledReason: 'Weather' },
      ctx,
    );
    expect(result.error).toBeUndefined();
    expect(result.patch.cancelledAt).toBe(NOW);
    expect(result.patch.cancelledBy).toBe('user-123');
  });

  it('preserves the original scheduled date and flags a postponement on reschedule', () => {
    const result = applyEventRequestTransition(
      { status: 'scheduled', scheduledEventDate: '2026-08-01' },
      { status: 'rescheduled' },
      ctx,
    );
    expect(result.error).toBeUndefined();
    expect(result.patch.originalScheduledDate).toBe('2026-08-01');
    expect(result.patch.wasPostponed).toBe(true);
  });
});

describe('applyEventRequestTransition — date/confirm coupling without a status change', () => {
  it('auto-confirms when a scheduled date is first set', () => {
    const result = applyEventRequestTransition(
      { status: 'scheduled', scheduledEventDate: null },
      { scheduledEventDate: '2026-08-01' },
      ctx,
    );
    expect(result.patch.isConfirmed).toBe(true);
    // No status change → no statusChangedAt.
    expect(result.patch.statusChangedAt).toBeUndefined();
  });

  it('respects an explicit isConfirmed:false when first setting a date', () => {
    const result = applyEventRequestTransition(
      { status: 'scheduled', scheduledEventDate: null },
      { scheduledEventDate: '2026-08-01', isConfirmed: false },
      ctx,
    );
    expect(result.patch.isConfirmed).toBe(false);
  });

  it('keeps a completed event confirmed even on an unrelated edit', () => {
    const result = applyEventRequestTransition(
      { status: 'completed' },
      { planningNotes: 'follow-up sent' },
      ctx,
    );
    expect(result.patch.isConfirmed).toBe(true);
  });

  it('is a no-op (no side-effect fields) when nothing status-related changes', () => {
    const result = applyEventRequestTransition(
      { status: 'in_process' },
      { planningNotes: 'called the org' },
      ctx,
    );
    expect(result.error).toBeUndefined();
    expect(result.patch).toEqual({ planningNotes: 'called the org' });
  });
});
