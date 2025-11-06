import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage-wrapper';
import {
  requirePermission,
  requireOwnershipPermission,
} from '../middleware/auth';
import { logger } from '../middleware/logger';
import { insertAvailabilitySlotSchema } from '@shared/schema';

const availabilityRouter = Router();

availabilityRouter.get('/', requirePermission('AVAILABILITY_VIEW'), async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    let slots;

    if (userId && startDate && endDate) {
      const userSlots = await storage.getAvailabilitySlotsByUserId(userId);
      const start = new Date(startDate);
      const end = new Date(endDate);
      slots = userSlots.filter(
        slot =>
          new Date(slot.startAt) <= end && new Date(slot.endAt) >= start
      );
    } else if (userId) {
      slots = await storage.getAvailabilitySlotsByUserId(userId);
    } else if (startDate && endDate) {
      slots = await storage.getAvailabilitySlotsByDateRange(
        new Date(startDate),
        new Date(endDate)
      );
    } else {
      slots = await storage.getAllAvailabilitySlots();
    }

    res.json(slots);
  } catch (error) {
    logger.error('Failed to fetch availability slots', error);
    res.status(500).json({ message: 'Failed to fetch availability slots' });
  }
});

availabilityRouter.get('/:id', requirePermission('AVAILABILITY_VIEW'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid availability slot ID' });
    }

    const slot = await storage.getAvailabilitySlotById(id);
    if (!slot) {
      return res.status(404).json({ message: 'Availability slot not found' });
    }

    res.json(slot);
  } catch (error) {
    logger.error('Failed to fetch availability slot', error);
    res.status(500).json({ message: 'Failed to fetch availability slot' });
  }
});

availabilityRouter.post('/', requirePermission('AVAILABILITY_ADD'), async (req, res) => {
  try {
    const user = req.user || req.session?.user;
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const slotData = insertAvailabilitySlotSchema.parse({
      ...req.body,
      userId: user.id,
    });

    const slot = await storage.createAvailabilitySlot(slotData);

    res.status(201).json(slot);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid availability slot input', {
        error: error.errors,
        ip: req.ip,
      });
      res
        .status(400)
        .json({ message: 'Invalid availability slot data', errors: error.errors });
    } else {
      logger.error('Failed to create availability slot', error);
      res.status(500).json({ message: 'Failed to create availability slot' });
    }
  }
});

availabilityRouter.put(
  '/:id',
  requireOwnershipPermission(
    'AVAILABILITY_EDIT_OWN',
    'AVAILABILITY_EDIT_ALL',
    async (req) => {
      const id = parseInt(req.params.id);
      const slot = await storage.getAvailabilitySlotById(id);
      return slot?.userId || null;
    }
  ),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid availability slot ID' });
      }

      const updates = req.body;
      const slot = await storage.updateAvailabilitySlot(id, updates);
      
      if (!slot) {
        return res.status(404).json({ message: 'Availability slot not found' });
      }

      res.json(slot);
    } catch (error) {
      logger.error('Failed to update availability slot', error);
      res.status(500).json({ message: 'Failed to update availability slot' });
    }
  }
);

availabilityRouter.delete(
  '/:id',
  requireOwnershipPermission(
    'AVAILABILITY_DELETE_OWN',
    'AVAILABILITY_DELETE_ALL',
    async (req) => {
      const id = parseInt(req.params.id);
      const slot = await storage.getAvailabilitySlotById(id);
      return slot?.userId || null;
    }
  ),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid availability slot ID' });
      }

      const slot = await storage.getAvailabilitySlotById(id);
      if (!slot) {
        return res.status(404).json({ message: 'Availability slot not found' });
      }

      await storage.deleteAvailabilitySlot(id);

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete availability slot', error);
      res.status(500).json({ message: 'Failed to delete availability slot' });
    }
  }
);

export default availabilityRouter;
