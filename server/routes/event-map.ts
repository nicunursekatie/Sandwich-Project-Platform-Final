import { Router } from 'express';
import { db } from '../db';
import { eventRequests } from '@shared/schema';
import { isNotNull, and, or, ne, eq } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';
import { geocodeAddress } from '../utils/geocoding';
import { rateLimiter } from '../utils/rate-limiter';

const router = Router();

/**
 * Clean address for geocoding by removing suite/building/apartment numbers
 * that often cause geocoding failures
 */
function cleanAddressForGeocoding(address: string): string {
  let cleaned = address;

  // Remove suite/building/apartment numbers with various patterns
  const patternsToRemove = [
    /\s+building\s+\d+/gi,
    /\s+bldg\.?\s+\d+/gi,
    /\s+suite\s+[a-z0-9-]+/gi,
    /\s+ste\.?\s+[a-z0-9-]+/gi,
    /\s+apt\.?\s+[a-z0-9-]+/gi,
    /\s+apartment\s+[a-z0-9-]+/gi,
    /\s+unit\s+[a-z0-9-]+/gi,
    /\s+#\s*[a-z0-9-]+/gi,
    /\s+floor\s+\d+/gi,
    /\s+\d+(st|nd|rd|th)\s+floor/gi,
  ];

  for (const pattern of patternsToRemove) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Clean up extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Remove trailing commas that might be left after removal
  cleaned = cleaned.replace(/,\s*,/g, ',').replace(/,\s*$/, '');

  return cleaned;
}

/**
 * GET /api/event-map
 * Fetch all event requests that have addresses with their coordinates for map display
 */
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;

    // Build query conditions
    const conditions = [
      isNotNull(eventRequests.eventAddress),
      ne(eventRequests.eventAddress, ''),
    ];

    // Filter by status if provided
    if (status && typeof status === 'string' && status !== 'all') {
      conditions.push(eq(eventRequests.status, status));
    }

    const events = await db
      .select({
        id: eventRequests.id,
        organizationName: eventRequests.organizationName,
        organizationCategory: eventRequests.organizationCategory,
        department: eventRequests.department,
        firstName: eventRequests.firstName,
        lastName: eventRequests.lastName,
        email: eventRequests.email,
        phone: eventRequests.phone,
        eventAddress: eventRequests.eventAddress,
        latitude: eventRequests.latitude,
        longitude: eventRequests.longitude,
        desiredEventDate: eventRequests.desiredEventDate,
        scheduledEventDate: eventRequests.scheduledEventDate,
        status: eventRequests.status,
        estimatedSandwichCount: eventRequests.estimatedSandwichCount,
        tspContact: eventRequests.tspContact,
        eventStartTime: eventRequests.eventStartTime,
        eventEndTime: eventRequests.eventEndTime,
      })
      .from(eventRequests)
      .where(and(...conditions));

    res.json(events);
  } catch (error) {
    logger.error('Error fetching event map data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch event map data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/event-map/geocode/:id
 * Geocode a specific event request's address
 * RATE LIMITED: 1 request per second to comply with Nominatim usage policy
 */
router.post('/geocode/:id', async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);

    // Fetch event
    const event = await db
      .select({
        id: eventRequests.id,
        eventAddress: eventRequests.eventAddress,
      })
      .from(eventRequests)
      .where(eq(eventRequests.id, eventId))
      .limit(1);

    if (!event || event.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!event[0].eventAddress) {
      return res.status(400).json({ error: 'Event has no address to geocode' });
    }

    // Rate limit: Wait if needed to comply with Nominatim 1 req/sec policy
    await rateLimiter.checkAndWait('geocode', 1000);
    
    // Clean address for geocoding (remove suite/building numbers)
    const originalAddress = event[0].eventAddress;
    const cleanedAddress = cleanAddressForGeocoding(originalAddress);
    
    logger.log(`Geocoding event ${eventId}:`);
    logger.log(`  Original: ${originalAddress}`);
    logger.log(`  Cleaned:  ${cleanedAddress}`);

    // Geocode the cleaned address
    const coordinates = await geocodeAddress(cleanedAddress);

    if (!coordinates) {
      logger.warn(`Geocoding failed for event ${eventId}: "${cleanedAddress}" (original: "${originalAddress}")`);
      return res.status(400).json({
        error: 'Failed to geocode address',
        details: `Could not find coordinates for address: "${originalAddress}". The address may be incomplete or not recognized by the geocoding service. Tried cleaning to: "${cleanedAddress}"`
      });
    }

    // Update event with coordinates
    await db
      .update(eventRequests)
      .set({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        updatedAt: new Date(),
      })
      .where(eq(eventRequests.id, eventId));

    res.json({
      success: true,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    });
  } catch (error) {
    logger.error('Error geocoding event address:', error);
    res.status(500).json({ 
      error: 'Failed to geocode address',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
