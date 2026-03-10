/**
 * Maps geocoded coordinates (lat/long) to Atlanta Metro region names.
 * Used for "Recipients by Region" when recipients have been geocoded.
 *
 * Bounding boxes are approximate for major Metro Atlanta cities.
 * Order matters: more specific areas should be checked first.
 */

interface BoundingBox {
  name: string;
  latMin: number;
  latMax: number;
  lngMin: number; // more negative = further west
  lngMax: number;
}

// Atlanta Metro cities - approximate bounding boxes (lat/lng)
// Sorted by approximate specificity; first match wins
const ATLANTA_REGIONS: BoundingBox[] = [
  // Downtown / Midtown Atlanta
  { name: 'Atlanta', latMin: 33.72, latMax: 33.81, lngMin: -84.45, lngMax: -84.35 },
  // North Fulton
  { name: 'Alpharetta', latMin: 34.04, latMax: 34.12, lngMin: -84.32, lngMax: -84.24 },
  { name: 'Roswell', latMin: 34.0, latMax: 34.06, lngMin: -84.40, lngMax: -84.32 },
  { name: 'Sandy Springs', latMin: 33.90, latMax: 33.96, lngMin: -84.40, lngMax: -84.34 },
  { name: 'Dunwoody', latMin: 33.92, latMax: 33.98, lngMin: -84.36, lngMax: -84.30 },
  { name: 'Brookhaven', latMin: 33.84, latMax: 33.89, lngMin: -84.36, lngMax: -84.32 },
  // Cobb County
  { name: 'Marietta', latMin: 33.92, latMax: 33.98, lngMin: -84.58, lngMax: -84.50 },
  { name: 'Smyrna', latMin: 33.86, latMax: 33.91, lngMin: -84.54, lngMax: -84.48 },
  { name: 'Austell', latMin: 33.78, latMax: 33.85, lngMin: -84.67, lngMax: -84.58 },
  { name: 'Douglasville', latMin: 33.72, latMax: 33.79, lngMin: -84.78, lngMax: -84.70 },
  // DeKalb County
  { name: 'Decatur', latMin: 33.76, latMax: 33.79, lngMin: -84.32, lngMax: -84.28 },
  { name: 'Stone Mountain', latMin: 33.78, latMax: 33.84, lngMin: -84.20, lngMax: -84.12 },
  { name: 'Clarkston', latMin: 33.79, latMax: 33.83, lngMin: -84.24, lngMax: -84.18 },
  { name: 'Chamblee', latMin: 33.86, latMax: 33.90, lngMin: -84.32, lngMax: -84.26 },
  { name: 'Tucker', latMin: 33.83, latMax: 33.88, lngMin: -84.24, lngMax: -84.18 },
  // South Fulton
  { name: 'East Point', latMin: 33.66, latMax: 33.71, lngMin: -84.46, lngMax: -84.40 },
  { name: 'College Park', latMin: 33.64, latMax: 33.68, lngMin: -84.46, lngMax: -84.42 },
  // Gwinnett County
  { name: 'Lawrenceville', latMin: 33.93, latMax: 33.99, lngMin: -84.02, lngMax: -83.94 },
  { name: 'Norcross', latMin: 33.91, latMax: 33.97, lngMin: -84.24, lngMax: -84.18 },
  { name: 'Duluth', latMin: 33.96, latMax: 34.02, lngMin: -84.18, lngMax: -84.10 },
];

// Metro Atlanta bounds - anything outside is "Outside Metro Atlanta"
const METRO_ATLANTA_BOUNDS = {
  latMin: 33.3,
  latMax: 34.4,
  lngMin: -84.95,
  lngMax: -83.75,
};

/**
 * Get region name from geocoded latitude/longitude.
 * Returns city name if within a known area, or "Outside Metro Atlanta" if in metro bounds but not matched,
 * or "Not geocoded" if coordinates are missing.
 */
export function getRegionFromCoordinates(
  latitude: string | number | null | undefined,
  longitude: string | number | null | undefined
): string {
  const lat = latitude != null ? parseFloat(String(latitude)) : NaN;
  const lng = longitude != null ? parseFloat(String(longitude)) : NaN;

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return 'Not geocoded';
  }

  for (const box of ATLANTA_REGIONS) {
    if (
      lat >= box.latMin &&
      lat <= box.latMax &&
      lng >= box.lngMin &&
      lng <= box.lngMax
    ) {
      return box.name;
    }
  }

  // Within metro bounds but not in a specific city - use broader region
  if (
    lat >= METRO_ATLANTA_BOUNDS.latMin &&
    lat <= METRO_ATLANTA_BOUNDS.latMax &&
    lng >= METRO_ATLANTA_BOUNDS.lngMin &&
    lng <= METRO_ATLANTA_BOUNDS.lngMax
  ) {
    return 'Metro Atlanta (other)';
  }

  return 'Outside Metro Atlanta';
}
