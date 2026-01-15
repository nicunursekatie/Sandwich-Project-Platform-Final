/**
 * Volunteer management routes for event requests
 */
import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../../storage-wrapper';
import { insertEventVolunteerSchema } from '@shared/schema';
import { isAuthenticated } from '../../auth';
import { logger } from '../../middleware/logger';
import type { AuthenticatedRequest } from '../../types/express';

const router = Router();

// Get all event volunteers for a specific event
router.get('/:eventId/volunteers', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ error: 'Valid event ID required' });
    }

    const volunteers = await storage.getEventVolunteersByEventId(eventId);

    res.json(volunteers);
  } catch (error) {
    logger.error('Error fetching event volunteers:', error);
    res.status(500).json({ error: 'Failed to fetch event volunteers' });
  }
});

// Sign up a user as a volunteer for an event
router.post('/:eventId/volunteers', isAuthenticated, async (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const userId = req.user?.id;

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ error: 'Valid event ID required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User authentication required' });
    }

    // Validate request body against schema
    const volunteerData = insertEventVolunteerSchema.parse({
      ...req.body,
      eventRequestId: eventId,
      volunteerUserId: userId,
    });

    // Check if user is already signed up for this event with the same role
    const existingVolunteers = await storage.getEventVolunteersByEventId(eventId);
    const alreadySignedUp = existingVolunteers.find(
      (v) => v.volunteerUserId === userId && v.role === volunteerData.role
    );

    if (alreadySignedUp) {
      return res.status(400).json({
        error: `You are already signed up as a ${volunteerData.role} for this event`,
      });
    }

    const newVolunteer = await storage.createEventVolunteer(volunteerData);

    res.status(201).json(newVolunteer);
  } catch (error) {
    logger.error('Error creating event volunteer signup:', error);
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: 'Invalid volunteer data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to sign up for event' });
  }
});

// Update volunteer status or assignment
router.patch('/volunteers/:volunteerId', isAuthenticated, async (req, res) => {
  try {
    const volunteerId = parseInt(req.params.volunteerId);

    if (!volunteerId || isNaN(volunteerId)) {
      return res.status(400).json({ error: 'Valid volunteer ID required' });
    }

    const updates = req.body;

    const updatedVolunteer = await storage.updateEventVolunteer(
      volunteerId,
      updates
    );

    if (!updatedVolunteer) {
      return res.status(404).json({ error: 'Volunteer assignment not found' });
    }

    res.json(updatedVolunteer);
  } catch (error) {
    logger.error('Error updating event volunteer:', error);
    res.status(500).json({ error: 'Failed to update volunteer assignment' });
  }
});

// Remove volunteer from event
router.delete('/volunteers/:volunteerId', isAuthenticated, async (req, res) => {
  try {
    const volunteerId = parseInt(req.params.volunteerId);

    if (!volunteerId || isNaN(volunteerId)) {
      return res.status(400).json({ error: 'Valid volunteer ID required' });
    }

    const deleted = await storage.deleteEventVolunteer(volunteerId);

    if (!deleted) {
      return res.status(404).json({ error: 'Volunteer assignment not found' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error removing event volunteer:', error);
    res.status(500).json({ error: 'Failed to remove volunteer assignment' });
  }
});

// Get all event volunteers (for admin search/filtering)
router.get('/all-volunteers', isAuthenticated, async (req, res) => {
  try {
    const allVolunteers = await storage.getAllEventVolunteers();
    res.json(allVolunteers);
  } catch (error) {
    logger.error('Error fetching all event volunteers:', error);
    res.status(500).json({ error: 'Failed to fetch all event volunteers' });
  }
});

// Get all volunteer signups for the current user
router.get('/my-volunteers', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({ error: 'User authentication required' });
    }

    const myVolunteers = await storage.getEventVolunteersByUserId(userId);
    res.json(myVolunteers);
  } catch (error) {
    logger.error('Error fetching user volunteer signups:', error);
    res.status(500).json({ error: 'Failed to fetch your volunteer signups' });
  }
});

export { router as volunteersRouter };
