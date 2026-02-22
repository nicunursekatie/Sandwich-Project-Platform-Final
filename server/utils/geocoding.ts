import { logger } from './production-safe-logger';
import { RATE_LIMITS, normalizeAddressForGeocoding } from '../config/constants';

export type GeocodingResult = {
  latitude: string;
  longitude: string;
  source: 'google' | 'openstreetmap';
} | null;

/**
 * Geocode using Google Geocoding API (primary - better at parsing typos and messy addresses)
 */
async function geocodeWithGoogle(
  address: string
): Promise<{ latitude: string; longitude: string } | null> {
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;

  if (!apiKey) {
    logger.warn('Google Geocoding API key not configured');
    return null;
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    );

    if (!response.ok) {
      logger.error(
        `Google Geocoding API error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      logger.log(
        `✅ Google Geocoding SUCCESS: ${address} -> (${location.lat}, ${location.lng})`
      );
      return {
        latitude: location.lat.toString(),
        longitude: location.lng.toString(),
      };
    }

    logger.warn(
      `Google Geocoding returned status: ${data.status} for address: "${address}"`
    );
    return null;
  } catch (error) {
    logger.error('Error with Google Geocoding:', error);
    return null;
  }
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
  if (!address || address.trim() === '') {
    return null;
  }

  // Normalize address: append "Georgia, USA" if no state/region info present
  const normalizedAddress = normalizeAddressForGeocoding(address.trim());

  try {
    // Try Google first (more accurate, handles address variations better)
    logger.log(`🗺️ Trying Google Geocoding for: ${normalizedAddress}`);
    const googleResult = await geocodeWithGoogle(normalizedAddress);

    if (googleResult) {
      return { ...googleResult, source: 'google' };
    }

    // Fallback to OpenStreetMap if Google fails or is not configured
    // Track that we're about to hit OpenStreetMap for rate limiting purposes
    logger.log(`🔄 Falling back to OpenStreetMap for: ${normalizedAddress}`);

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(normalizedAddress)}&limit=1`,
      {
        headers: {
          'User-Agent': 'TheSandwichProject/1.0 (nonprofit organization)',
        },
      }
    );

    if (!response.ok) {
      logger.error(
        `OpenStreetMap API error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = await response.json();

    if (data && data.length > 0) {
      const result = data[0];
      logger.log(
        `✅ OpenStreetMap SUCCESS: ${address} -> (${result.lat}, ${result.lon})`
      );
      return {
        latitude: result.lat,
        longitude: result.lon,
        source: 'openstreetmap',
      };
    }

    logger.warn(`OpenStreetMap returned 0 results for: "${normalizedAddress}"`);
    logger.error(`❌ ALL GEOCODING FAILED for address: "${normalizedAddress}" (original: "${address}")`);
    return null;
  } catch (error) {
    logger.error('Error geocoding address:', error);
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
