import { logger } from './production-safe-logger';

/**
 * Geocode an address to latitude and longitude using OpenStreetMap Nominatim API
 * Free, no API key required, but limited to 1 request per second
 * 
 * @param address - Full address string to geocode
 * @returns Object with latitude and longitude, or null if geocoding failed
 */
export async function geocodeAddress(address: string): Promise<{ latitude: string; longitude: string } | null> {
  if (!address || address.trim() === '') {
    return null;
  }

  try {
    // Nominatim requires a User-Agent header
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      {
        headers: {
          'User-Agent': 'TheSandwichProject/1.0 (nonprofit organization)',
        },
      }
    );

    if (!response.ok) {
      logger.error(`Geocoding API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();

    if (data && data.length > 0) {
      const result = data[0];
      return {
        latitude: result.lat,
        longitude: result.lon,
      };
    }

    logger.warn(`No geocoding results found for address: ${address}`);
    return null;
  } catch (error) {
    logger.error('Error geocoding address:', error);
    return null;
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
