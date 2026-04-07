import { logger } from './production-safe-logger';
import { RATE_LIMITS, normalizeAddressForGeocoding } from '../config/constants';

export type GeocodingResult = {
  latitude: string;
  longitude: string;
  source: 'google' | 'openstreetmap';
} | null;

export type GeocodingFailureReason =
  | 'no_address'
  | 'google_no_key'
  | 'google_http_error'
  | 'google_request_denied'
  | 'google_over_query_limit'
  | 'google_invalid_request'
  | 'google_zero_results'
  | 'google_unknown_error'
  | 'google_exception'
  | 'osm_http_error'
  | 'osm_zero_results'
  | 'osm_exception'
  | 'all_failed';

// Stores the last failure reason for diagnostic purposes
let lastFailureReason: GeocodingFailureReason | null = null;
let lastFailureDetail: string = '';

export function getLastGeocodingFailure(): { reason: GeocodingFailureReason | null; detail: string } {
  return { reason: lastFailureReason, detail: lastFailureDetail };
}

function setFailure(reason: GeocodingFailureReason, detail: string) {
  lastFailureReason = reason;
  lastFailureDetail = detail;
}

/**
 * Geocode using Google Geocoding API (primary - better at parsing typos and messy addresses)
 */
async function geocodeWithGoogle(
  address: string
): Promise<{ latitude: string; longitude: string } | null> {
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;

  if (!apiKey) {
    logger.warn('Google Geocoding API key not configured — set GOOGLE_GEOCODING_API_KEY env var');
    setFailure('google_no_key', 'GOOGLE_GEOCODING_API_KEY not set');
    return null;
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    );

    if (!response.ok) {
      const detail = `HTTP ${response.status} ${response.statusText}`;
      logger.error(`Google Geocoding API HTTP error for "${address}": ${detail}`);
      setFailure('google_http_error', detail);
      return null;
    }

    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      logger.info(
        `Google Geocoding SUCCESS: "${address}" -> (${location.lat}, ${location.lng})`
      );
      return {
        latitude: location.lat.toString(),
        longitude: location.lng.toString(),
      };
    }

    // Map Google status to our failure reasons
    const statusMap: Record<string, GeocodingFailureReason> = {
      'REQUEST_DENIED': 'google_request_denied',
      'OVER_QUERY_LIMIT': 'google_over_query_limit',
      'INVALID_REQUEST': 'google_invalid_request',
      'ZERO_RESULTS': 'google_zero_results',
    };
    const failureReason = statusMap[data.status] || 'google_unknown_error';
    const detail = `Google returned "${data.status}"${data.error_message ? `: ${data.error_message}` : ''}`;

    logger.warn(`Google Geocoding FAILED for "${address}": ${detail}`);
    setFailure(failureReason, detail);
    return null;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.error(`Google Geocoding exception for "${address}": ${detail}`);
    setFailure('google_exception', detail);
    return null;
  }
}

/**
 * Parse an address string into structured components for OSM structured query
 */
function parseAddressComponents(address: string): { street?: string; city?: string; state?: string; postalcode?: string; country?: string } {
  // Split by comma and trim each part
  const parts = address.split(',').map(p => p.trim()).filter(Boolean);

  if (parts.length === 0) return {};

  const result: { street?: string; city?: string; state?: string; postalcode?: string; country?: string } = {};
  result.country = 'US';

  if (parts.length >= 3) {
    // Typical format: "123 Street, City, State Zip" or "123 Street, City, State, Zip"
    result.street = parts[0];
    result.city = parts[1];

    // Last part(s) might be "GA 30024" or "GA, 30024" or "Georgia"
    const stateZipPart = parts.slice(2).join(' ');
    const stateZipMatch = stateZipPart.match(/^\s*(GA|Georgia)\s*,?\s*(\d{5})?\s*$/i);
    if (stateZipMatch) {
      result.state = 'GA';
      if (stateZipMatch[2]) result.postalcode = stateZipMatch[2];
    } else {
      // Just use what we have
      result.state = parts[2];
      if (parts[3]) result.postalcode = parts[3].replace(/\D/g, '').slice(0, 5);
    }
  } else if (parts.length === 2) {
    result.street = parts[0];
    result.city = parts[1];
    result.state = 'GA';
  } else {
    // Single part — just use as-is
    result.street = parts[0];
    result.state = 'GA';
  }

  return result;
}

/**
 * Geocode using OpenStreetMap Nominatim API
 * Tries structured query first (more reliable), then falls back to free-form
 */
async function geocodeWithOSM(
  normalizedAddress: string,
  originalAddress: string
): Promise<{ latitude: string; longitude: string } | null> {
  const headers = {
    'User-Agent': 'TheSandwichProject/1.0 (nonprofit organization)',
  };

  // Attempt 1: Structured query (more reliable for specific addresses)
  const components = parseAddressComponents(normalizedAddress);
  if (components.street && (components.city || components.postalcode)) {
    const params = new URLSearchParams({ format: 'json', limit: '1' });
    if (components.street) params.set('street', components.street);
    if (components.city) params.set('city', components.city);
    if (components.state) params.set('state', components.state);
    if (components.postalcode) params.set('postalcode', components.postalcode);
    if (components.country) params.set('country', components.country);

    logger.info(`OSM structured query: ${params.toString()}`);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        { headers }
      );

      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          logger.info(`OpenStreetMap structured SUCCESS: "${originalAddress}" -> (${data[0].lat}, ${data[0].lon})`);
          return { latitude: data[0].lat, longitude: data[0].lon };
        }
      }
      logger.info(`OSM structured query returned no results, trying free-form`);
    } catch (error) {
      logger.warn(`OSM structured query error, trying free-form: ${error}`);
    }

    // Rate limit between OSM requests
    await new Promise(resolve => setTimeout(resolve, 1100));
  }

  // Attempt 2: Free-form query (original approach)
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(normalizedAddress)}&limit=1`,
      { headers }
    );

    if (!response.ok) {
      const detail = `HTTP ${response.status} ${response.statusText}`;
      logger.error(`OpenStreetMap API error for "${normalizedAddress}": ${detail}`);
      setFailure('osm_http_error', detail);
      return null;
    }

    const data = await response.json();

    if (data && data.length > 0) {
      logger.info(`OpenStreetMap free-form SUCCESS: "${originalAddress}" -> (${data[0].lat}, ${data[0].lon})`);
      return { latitude: data[0].lat, longitude: data[0].lon };
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.error(`OpenStreetMap exception for "${normalizedAddress}": ${detail}`);
    setFailure('osm_exception', detail);
    return null;
  }

  setFailure('osm_zero_results', `No results for "${normalizedAddress}"`);
  return null;
}

/**
 * Geocode an address to latitude and longitude
 * Primary: Google Geocoding API (more accurate, handles address variations better)
 * Fallback: OpenStreetMap Nominatim API (free, when Google unavailable)
 *
 * @param address - Full address string to geocode
 * @returns Object with latitude, longitude, and source service, or null if failed
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult> {
  // Reset failure tracking for this call
  lastFailureReason = null;
  lastFailureDetail = '';

  if (!address || address.trim() === '') {
    setFailure('no_address', 'Empty or missing address');
    return null;
  }

  // Normalize address: append "Georgia, USA" if no state/region info present
  const normalizedAddress = normalizeAddressForGeocoding(address.trim());

  try {
    // Try Google first (more accurate, handles address variations better)
    logger.info(`Geocoding attempt: "${normalizedAddress}" (original: "${address}")`);
    const googleResult = await geocodeWithGoogle(normalizedAddress);

    if (googleResult) {
      return { ...googleResult, source: 'google' };
    }

    // Capture Google failure reason before OSM attempts overwrite it
    const googleFailureReason = lastFailureReason;
    const googleFailureDetail = lastFailureDetail;

    // Fallback to OpenStreetMap if Google fails or is not configured
    logger.info(`Falling back to OpenStreetMap for: "${normalizedAddress}"`);

    // Try structured query first (more reliable for specific addresses)
    const osmResult = await geocodeWithOSM(normalizedAddress, address);

    if (osmResult) {
      return { ...osmResult, source: 'openstreetmap' as const };
    }

    logger.warn(`OpenStreetMap returned 0 results for: "${normalizedAddress}"`);
    setFailure('all_failed', `Google: ${googleFailureDetail || googleFailureReason || 'unknown'}. OpenStreetMap: zero results for "${normalizedAddress}"`);
    logger.error(`ALL GEOCODING FAILED for address: "${normalizedAddress}" (original: "${address}")`);
    return null;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.error(`Geocoding exception for "${normalizedAddress}": ${detail}`);
    setFailure('osm_exception', detail);
    return null;
  }
}

// Rate limits by service - use centralized config
const SERVICE_RATE_LIMITS = {
  google: RATE_LIMITS.GOOGLE_GEOCODING,
  openstreetmap: RATE_LIMITS.OPENSTREETMAP,
};

/**
 * Batch geocode multiple addresses with adaptive rate limiting
 * Adjusts delay based on which service was actually used for each request
 *
 * @param addresses - Array of address strings to geocode
 * @returns Array of geocoded results (null for failed geocoding)
 */
export async function geocodeAddresses(addresses: string[]): Promise<GeocodingResult[]> {
  const results: GeocodingResult[] = [];
  let lastSource: 'google' | 'openstreetmap' = 'google';

  for (let i = 0; i < addresses.length; i++) {
    const result = await geocodeAddress(addresses[i]);
    results.push(result);

    // Track which service was last attempted for rate limiting
    // If result exists, use its source. If null, OpenStreetMap was last attempted (as fallback)
    lastSource = result ? result.source : 'openstreetmap';

    // Rate limit between requests based on the service that was actually used
    if (i < addresses.length - 1) {
      const delayMs = SERVICE_RATE_LIMITS[lastSource];
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
