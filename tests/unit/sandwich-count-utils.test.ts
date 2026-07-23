import {
  getReportableSandwichCount,
  hasActiveSandwichRange,
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
