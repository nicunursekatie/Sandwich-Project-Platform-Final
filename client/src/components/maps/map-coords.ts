/** Parse coordinate strings into a Leaflet-safe [lat, lng], or null if invalid. */
export function parseLatLng(
  latitude: string | number | null | undefined,
  longitude: string | number | null | undefined
): [number, number] | null {
  if (latitude == null || longitude == null) return null;
  const lat =
    typeof latitude === 'number' ? latitude : Number.parseFloat(String(latitude).trim());
  const lng =
    typeof longitude === 'number' ? longitude : Number.parseFloat(String(longitude).trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lat, lng];
}

/** True when a Leaflet map has a usable pixel size and is finished initializing. */
export function isMapReady(map: {
  getSize: () => { x: number; y: number };
  _loaded?: boolean;
}): boolean {
  if (map._loaded === false) return false;
  const size = map.getSize();
  return Number.isFinite(size.x) && Number.isFinite(size.y) && size.x > 0 && size.y > 0;
}
