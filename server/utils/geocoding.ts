import { logger } from './production-safe-logger';

/**
 * Geocode using Google Geocoding API (fallback when OpenStreetMap fails)
 */
async function geocodeWithGoogle(address: string): Promise<{ latitude: string; longitude: string } | null> {
  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  
  if (!apiKey) {
    logger.warn('Google Geocoding API key not configured, skipping Google fallback');
    return null;
  }

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
    );

    if (!response.ok) {
      logger.error(`Google Geocoding API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      logger.log(`✅ Google Geocoding SUCCESS: ${address} -> (${location.lat}, ${location.lng})`);
      return {
        latitude: location.lat.toString(),
        longitude: location.lng.toString(),
      };
    }

    logger.warn(`Google Geocoding returned status: ${data.status} for address: "${address}"`);
    return null;
  } catch (error) {
    logger.error('Error with Google Geocoding:', error);
    return null;
  }
}

/**
 * Geocode an address to latitude and longitude
 * Primary: OpenStreetMap Nominatim API (free, no API key)
 * Fallback: Google Geocoding API (when OpenStreetMap fails)
 * 
 * @param address - Full address string to geocode
 * @returns Object with latitude and longitude, or null if geocoding failed
 */
export async function geocodeAddress(address: string): Promise<{ latitude: string; longitude: string } | null> {
  if (!address || address.trim() === '') {
    return null;
  }

  try {
    // Try OpenStreetMap Nominatim first (free, no API key required)
    logger.log(`🗺️ Trying OpenStreetMap for: ${address}`);
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      {
        headers: {
          'User-Agent': 'TheSandwichProject/1.0 (nonprofit organization)',
        },
      }
    );

    if (!response.ok) {
      logger.error(`OpenStreetMap API error: ${response.status} ${response.statusText}`);
    } else {
      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        logger.log(`✅ OpenStreetMap SUCCESS: ${address} -> (${result.lat}, ${result.lon})`);
        return {
          latitude: result.lat,
          longitude: result.lon,
        };
      }

      logger.warn(`OpenStreetMap returned 0 results for: "${address}"`);
    }

    // Fallback to Google Geocoding if OpenStreetMap fails
    logger.log(`🔄 Falling back to Google Geocoding for: ${address}`);
    const googleResult = await geocodeWithGoogle(address);
    
    if (googleResult) {
      return googleResult;
    }

    logger.error(`❌ ALL GEOCODING FAILED for address: "${address}"`);
    return null;
  } catch (error) {
    logger.error('Error geocoding address:', error);
    
    // Try Google as last resort
    try {
      logger.log(`🔄 Exception fallback to Google Geocoding for: ${address}`);
      return await geocodeWithGoogle(address);
    } catch (fallbackError) {
      logger.error('Google fallback also failed:', fallbackError);
      return null;
    }
  }
}

/**
 * Batch geocode multiple addresses with rate limiting (1 request per second for Nominatim)
 * 
 * @param addresses - Array of address strings to geocode
 * @returns Array of geocoded results (null for failed geocoding)
 */
export async function geocodeAddresses(addresses: string[]): Promise<(
{ latitude: string; longitude: string } | null)[]> {
  const results: ({ latitude: string; longitude: string } | null)[] = [];

  for (const address of addresses) {
    const result = await geocodeAddress(address);
    results.push(result);

    // Rate limit: 1 request per second for Nominatim
    if (addresses.indexOf(address) < addresses.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}
