import { describe, expect, it } from 'vitest';
import { isMapReady, parseLatLng } from '../map-coords';

describe('parseLatLng', () => {
  it('parses finite coordinate strings', () => {
    expect(parseLatLng('33.75', '-84.39')).toEqual([33.75, -84.39]);
  });

  it('rejects empty, non-numeric, and out-of-range values', () => {
    expect(parseLatLng('', '-84.39')).toBeNull();
    expect(parseLatLng('abc', '-84.39')).toBeNull();
    expect(parseLatLng('NaN', 'NaN')).toBeNull();
    expect(parseLatLng('91', '-84.39')).toBeNull();
    expect(parseLatLng('33.75', '-181')).toBeNull();
    expect(parseLatLng(null, '-84.39')).toBeNull();
  });
});

describe('isMapReady', () => {
  it('requires a positive finite size and loaded map', () => {
    expect(isMapReady({ getSize: () => ({ x: 800, y: 600 }), _loaded: true })).toBe(true);
    expect(isMapReady({ getSize: () => ({ x: 0, y: 600 }), _loaded: true })).toBe(false);
    expect(isMapReady({ getSize: () => ({ x: 800, y: 600 }), _loaded: false })).toBe(false);
    expect(isMapReady({ getSize: () => ({ x: NaN, y: 600 }) })).toBe(false);
  });
});
