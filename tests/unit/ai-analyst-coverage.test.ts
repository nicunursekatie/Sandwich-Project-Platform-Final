import { daysSince } from '../../shared/ai-analyst-contract';

/**
 * The AI Analyst reports totals over time windows. Without a freshness signal
 * it cannot tell "nothing was collected" from "nothing was logged" -- both
 * present as zero, and a zero reported as a real figure turns a data-entry gap
 * into an apparent collapse.
 *
 * This is not hypothetical: the production collections log stopped receiving
 * records on 2026-02-27 while the app kept running for months afterwards.
 */
describe('AI Analyst data coverage', () => {
  it('measures a real reporting gap in whole days', () => {
    // The production case: last collection logged 2026-02-27, asked in September.
    expect(daysSince('2026-02-27', '2026-09-17')).toBe(202);
  });

  it('reports zero for a record dated today', () => {
    expect(daysSince('2026-09-17', '2026-09-17')).toBe(0);
  });

  it('never reports a negative gap for a future-dated record', () => {
    // Events are legitimately scheduled ahead. A future date means "current",
    // not "-75 days", which would read as nonsense in the prompt.
    expect(daysSince('2026-12-01', '2026-09-17')).toBe(0);
  });

  it('is unaffected by daylight saving transitions', () => {
    // US DST ends 2026-11-01. A naive hour-based difference would round to 89.
    expect(daysSince('2026-10-04', '2026-12-31')).toBe(88);
  });

  it('returns null rather than NaN for an unparseable date', () => {
    // collection_date is a text column, so non-ISO values do occur.
    expect(daysSince('not-a-date', '2026-09-17')).toBeNull();
    expect(daysSince('3/15/2026', '2026-09-17')).toBeNull();
  });

  it('counts a single day across a month boundary', () => {
    expect(daysSince('2026-02-28', '2026-03-01')).toBe(1);
  });
});
