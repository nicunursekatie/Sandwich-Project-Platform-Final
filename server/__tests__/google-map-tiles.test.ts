import {
  getMapConfig,
  isValidTileCoord,
  isValidViewport,
  redactMapSecrets,
  safeReasonFromGoogle,
} from '../services/google-map-tiles';

describe('google map tiles', () => {
  const originalKey = process.env.GOOGLE_MAPS_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = originalKey;
  });

  it('accepts only in-range XYZ tile coordinates', () => {
    expect(isValidTileCoord(10, 271, 410)).toBe(true);
    expect(isValidTileCoord(0, 0, 0)).toBe(true);
    expect(isValidTileCoord(-1, 0, 0)).toBe(false);
    expect(isValidTileCoord(23, 0, 0)).toBe(false);
    expect(isValidTileCoord(10, 5000, 0)).toBe(false);
    expect(isValidTileCoord(1.2, 0, 0)).toBe(false);
  });

  it('rejects a viewport whose north edge is south of its south edge', () => {
    expect(
      isValidViewport({ north: 34, south: 33, east: -84, west: -85, zoom: 10 })
    ).toBe(true);
    expect(
      isValidViewport({ north: 33, south: 34, east: -84, west: -85, zoom: 10 })
    ).toBe(false);
    expect(
      isValidViewport({ north: 34, south: 33, east: -84, west: -85, zoom: 30 })
    ).toBe(false);
  });

  it('keeps the map on the backup tiles when the server key is missing', async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    await expect(getMapConfig()).resolves.toEqual({
      provider: 'carto',
      reason: 'GOOGLE_MAPS_API_KEY is not set on the server.',
    });
  });

  it('tells you to allow the key when the API is already enabled', () => {
    const body = JSON.stringify({
      error: {
        code: 403,
        message: 'Requests to this API tile.googleapis.com are blocked.',
        status: 'PERMISSION_DENIED',
        details: [{ reason: 'API_KEY_SERVICE_BLOCKED' }],
      },
    });

    expect(safeReasonFromGoogle(403, body)).toContain('this key is not allowed to call it');
  });

  it('strips the API key out of logged errors', () => {
    process.env.GOOGLE_MAPS_API_KEY = 'secret-key-value';
    const redacted = redactMapSecrets('request failed for key=secret-key-value');
    expect(redacted).not.toContain('secret-key-value');
    expect(redacted).toContain('[redacted]');
  });
});
