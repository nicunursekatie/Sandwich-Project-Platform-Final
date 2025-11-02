import { Router } from 'express';
import { db } from '../db';
import { eventRequests } from '@shared/schema';
import { isNotNull, and, or, ne } from 'drizzle-orm';
import { isAuthenticated } from '../middleware';
import { logger } from '../utils/production-safe-logger';
import { geocodeAddress } from '../utils/geocoding';

const router = Router();

/**
 * GET /api/event-map
 * Fetch all event requests that have addresses with their coordinates for map display
 */
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const { status } = req.query;

    // Build query conditions
    const conditions = [
      isNotNull(eventRequests.eventAddress),
      ne(eventRequests.eventAddress, ''),
    ];

    // Filter by status if provided
    if (status && typeof status === 'string' && status !== 'all') {
      conditions.push(or(
        ...status.split(',').map(s => ({ status: s.trim() } as any))
      ) as any);
    }

    const events = await db
      .select({
        id: eventRequests.id,
        organizationName: eventRequests.organizationName,
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
 */
router.post('/geocode/:id', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);

    // Fetch event
    const event = await db
      .select({
        id: eventRequests.id,
        eventAddress: eventRequests.eventAddress,
      })
      .from(eventRequests)
      .where({ id: eventId } as any)
      .limit(1);

    if (!event || event.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (!event[0].eventAddress) {
      return res.status(400).json({ error: 'Event has no address to geocode' });
    }

    // Geocode the address
    const coordinates = await geocodeAddress(event[0].eventAddress);

    if (!coordinates) {
      return res.status(400).json({ error: 'Failed to geocode address' });
    }

    // Update event with coordinates
    await db
      .update(eventRequests)
      .set({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        updatedAt: new Date(),
      })
      .where({ id: eventId } as any);

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
