import {
  elapsedToDuration,
  easternWorkDate,
  MAX_TIMER_MINUTES,
} from '../../server/utils/work-log-timer';

describe('elapsedToDuration', () => {
  it('rounds to the nearest minute', () => {
    expect(elapsedToDuration(90)).toMatchObject({ hours: 0, minutes: 2 });
    expect(elapsedToDuration(89)).toMatchObject({ hours: 0, minutes: 1 });
  });

  it('splits into hours and minutes', () => {
    expect(elapsedToDuration(2 * 3600 + 34 * 60)).toMatchObject({
      hours: 2,
      minutes: 34,
      capped: false,
    });
  });

  it('counts a very short session as one minute rather than zero', () => {
    expect(elapsedToDuration(3)).toMatchObject({ hours: 0, minutes: 1 });
    expect(elapsedToDuration(0)).toMatchObject({ hours: 0, minutes: 1 });
  });

  it('caps a forgotten timer at 24 hours and flags it', () => {
    const threeDays = 3 * 24 * 3600;
    expect(elapsedToDuration(threeDays)).toMatchObject({
      hours: 24,
      minutes: 0,
      totalMinutes: MAX_TIMER_MINUTES,
      capped: true,
    });
  });

  it('does not flag a session that lands exactly on the cap', () => {
    expect(elapsedToDuration(MAX_TIMER_MINUTES * 60).capped).toBe(false);
  });

  it('tolerates nonsense input', () => {
    expect(elapsedToDuration(-500)).toMatchObject({ hours: 0, minutes: 1 });
    expect(elapsedToDuration(NaN)).toMatchObject({ hours: 0, minutes: 1 });
  });
});

describe('easternWorkDate', () => {
  it('uses the Eastern calendar day, not the UTC one', () => {
    // 01:30 UTC on Jan 2 is still 8:30pm Eastern on Jan 1.
    const workDate = easternWorkDate(new Date('2026-01-02T01:30:00Z'));
    expect(workDate.getFullYear()).toBe(2026);
    expect(workDate.getMonth()).toBe(0);
    expect(workDate.getDate()).toBe(1);
  });

  it('handles daylight saving offsets', () => {
    // 02:30 UTC on Jul 2 is 10:30pm Eastern on Jul 1 (EDT, UTC-4).
    const workDate = easternWorkDate(new Date('2026-07-02T02:30:00Z'));
    expect(workDate.getMonth()).toBe(6);
    expect(workDate.getDate()).toBe(1);
  });

  it('anchors at noon so display never rolls to the previous day', () => {
    const workDate = easternWorkDate(new Date('2026-07-01T16:00:00Z'));
    expect(workDate.getHours()).toBe(12);
  });
});
