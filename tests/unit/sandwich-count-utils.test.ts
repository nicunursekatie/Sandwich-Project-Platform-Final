import {
  getReportableSandwichCount,
  hasActiveSandwichRange,
  hasActiveSandwichTypes,
  sumSandwichTypeQuantities,
  getRangeMidpoint,
} from '../../shared/sandwich-count-utils';

describe('getRangeMidpoint', () => {
  it('rounds the midpoint of a range (490-506 → 498)', () => {
    expect(getRangeMidpoint(490, 506)).toBe(498);
  });
});

describe('hasActiveSandwichRange', () => {
  it('is false when exact count disagrees with range midpoint (stale range)', () => {
    expect(hasActiveSandwichRange(490, 506, 500)).toBe(false);
  });

  it('is true when exact equals midpoint (imported range)', () => {
    expect(hasActiveSandwichRange(490, 506, 498)).toBe(true);
  });

  it('is true for a pure range with no exact count', () => {
    expect(hasActiveSandwichRange(490, 506, null)).toBe(true);
  });

  it('is false when there is no range', () => {
    expect(hasActiveSandwichRange(null, null, 500)).toBe(false);
  });

  it('is false when only one bound is present (incomplete range)', () => {
    expect(hasActiveSandwichRange(490, null, null)).toBe(false);
    expect(hasActiveSandwichRange(null, 506, null)).toBe(false);
  });
});

describe('getReportableSandwichCount (500 vs 498)', () => {
  it('prefers the exact count over a stale range midpoint', () => {
    expect(
      getReportableSandwichCount({
        estimatedSandwichCount: 500,
        estimatedSandwichCountMin: 490,
        estimatedSandwichCountMax: 506,
      }),
    ).toBe(500);
  });

  it('uses the range midpoint when there is no exact count', () => {
    expect(
      getReportableSandwichCount({
        estimatedSandwichCount: null,
        estimatedSandwichCountMin: 490,
        estimatedSandwichCountMax: 506,
      }),
    ).toBe(498);
  });

  it('uses the exact count when there is no range', () => {
    expect(
      getReportableSandwichCount({
        estimatedSandwichCount: 500,
        estimatedSandwichCountMin: null,
        estimatedSandwichCountMax: null,
      }),
    ).toBe(500);
  });

  it('prefers actual count over everything', () => {
    expect(
      getReportableSandwichCount({
        actualSandwichCount: 512,
        estimatedSandwichCount: 500,
        estimatedSandwichCountMin: 490,
        estimatedSandwichCountMax: 506,
      }),
    ).toBe(512);
  });
});

describe('sumSandwichTypeQuantities', () => {
  it('sums an array', () => {
    expect(
      sumSandwichTypeQuantities([
        { type: 'turkey', quantity: 250 },
        { type: 'pbj', quantity: 248 },
      ]),
    ).toBe(498);
  });

  it('sums a JSON string', () => {
    expect(
      sumSandwichTypeQuantities('[{"type":"turkey","quantity":250},{"type":"pbj","quantity":248}]'),
    ).toBe(498);
  });

  it('returns 0 for null, malformed JSON and non-arrays', () => {
    expect(sumSandwichTypeQuantities(null)).toBe(0);
    expect(sumSandwichTypeQuantities('not json')).toBe(0);
    expect(sumSandwichTypeQuantities('{"type":"turkey"}')).toBe(0);
  });
});

describe('hasActiveSandwichTypes', () => {
  const staleBreakdown = [
    { type: 'turkey', quantity: 250 },
    { type: 'pbj', quantity: 248 },
  ];

  it('is false when the breakdown disagrees with the exact count (stale types)', () => {
    // The 500-saves-as-498 signature: exact 500 next to a breakdown summing 498.
    expect(hasActiveSandwichTypes(staleBreakdown, 500)).toBe(false);
  });

  it('is true when the breakdown sums to the exact count', () => {
    expect(hasActiveSandwichTypes(staleBreakdown, 498)).toBe(true);
  });

  it('is true for a breakdown with no exact count', () => {
    expect(hasActiveSandwichTypes(staleBreakdown, null)).toBe(true);
    expect(hasActiveSandwichTypes(staleBreakdown, undefined)).toBe(true);
  });

  it('is false when there is no breakdown', () => {
    expect(hasActiveSandwichTypes(null, 500)).toBe(false);
    expect(hasActiveSandwichTypes([], 500)).toBe(false);
  });

  it('accepts a JSON string breakdown', () => {
    expect(
      hasActiveSandwichTypes('[{"type":"turkey","quantity":250},{"type":"pbj","quantity":248}]', 500),
    ).toBe(false);
  });

  it('keeps a zero-quantity breakdown active when no exact count contradicts it', () => {
    expect(hasActiveSandwichTypes([{ type: 'turkey', quantity: 0 }], null)).toBe(true);
  });
});
