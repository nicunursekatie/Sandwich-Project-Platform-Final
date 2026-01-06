import { logger } from './production-safe-logger';

/**
 * Geocode using Google Geocoding API (primary - better at parsing typos and messy addresses)
 */
async function geocodeWithGoogle(
  address: string
): Promise<{ latitude: string; longitude: string } | null> {
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;

  if (!apiKey) {
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
 */
async function geocodeWithOpenStreetMap(
  address: string
): Promise<{ latitude: string; longitude: string } | null> {
  try {
    // Try Google first (more accurate, handles address variations better)
    logger.log(`🗺️ Trying Google Geocoding for: ${address}`);
    const googleResult = await geocodeWithGoogle(address);

    if (googleResult) {
      return googleResult;
    }

    // Fallback to OpenStreetMap if Google fails or is not configured
    logger.log(`🔄 Falling back to OpenStreetMap for: ${address}`);

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
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
      };
    }

    logger.warn(`OpenStreetMap returned 0 results for: "${address}"`);
    return null;
  } catch (error) {
    logger.error('Error with OpenStreetMap Geocoding:', error);
    return null;
  }
}

/**

 * Geocode an address to latitude and longitude
 * Primary: Google Geocoding API (better at parsing typos and messy addresses)
 * Fallback: OpenStreetMap Nominatim API (free, no API key required)
 *
 * @param address - Full address string to geocode
 * @returns Object with latitude and longitude, or null if geocoding failed
 */
export async function geocodeAddress(
  address: string
): Promise<{ latitude: string; longitude: string } | null> {
  if (!address || address.trim() === '') {
    return null;
  }

  // Try Google first (better at parsing typos and messy addresses)
  const googleApiKey = process.env.GOOGLE_GEOCODING_API_KEY;

  if (googleApiKey) {
    logger.log(`🗺️ Trying Google Geocoding for: ${address}`);
    const googleResult = await geocodeWithGoogle(address);
    if (googleResult) {
      return googleResult;
    }
    logger.log(
      `🔄 Google failed, falling back to OpenStreetMap for: ${address}`
    );
  } else {
    logger.log(`🗺️ No Google API key, using OpenStreetMap for: ${address}`);
  }

  // Fallback to OpenStreetMap
  const osmResult = await geocodeWithOpenStreetMap(address);
  if (osmResult) {
    return osmResult;
  }

  logger.error(`❌ ALL GEOCODING FAILED for address: "${address}"`);
  return null;
}

/**
 * Batch geocode multiple addresses with rate limiting
 * Google has higher limits, but we still add a small delay for safety
 * Falls back to OpenStreetMap which requires 1 request per second
 *
 * @param addresses - Array of address strings to geocode
 * @returns Array of geocoded results (null for failed geocoding)
 */
export async function geocodeAddresses(
  addresses: string[]
): Promise<({ latitude: string; longitude: string } | null)[]> {
  const results: ({ latitude: string; longitude: string } | null)[] = [];
  const hasGoogleKey = !!process.env.GOOGLE_GEOCODING_API_KEY;

  for (const address of addresses) {
    const result = await geocodeAddress(address);
    results.push(result);
    // Rate limit: 100ms for Google, 1 second if falling back to OpenStreetMap
    if (addresses.indexOf(address) < addresses.length - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, hasGoogleKey ? 100 : 1000)
      );
    }
  }

  return results;
}
