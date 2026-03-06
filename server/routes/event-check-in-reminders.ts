import express from 'express';
import { db } from '../db';
import { eventCheckInReminders, eventRequests } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';

const router = express.Router();

function calculateNextDue(frequency: string, fromDate: Date = new Date()): Date {
  const next = new Date(fromDate);
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'every_3_days':
      next.setDate(next.getDate() + 3);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    default:
      next.setDate(next.getDate() + 7);
  }
  // Set to 9 AM for the next due date
  next.setHours(9, 0, 0, 0);
  return next;
}

// GET /api/event-check-in-reminders/:eventRequestId
// Get reminder settings for a specific event request
router.get('/:eventRequestId', async (req: any, res) => {
  try {
    const eventRequestId = parseInt(req.params.eventRequestId);
    if (isNaN(eventRequestId)) {
      return res.status(400).json({ error: 'Invalid event request ID' });
    }

    const [reminder] = await db
      .select()
      .from(eventCheckInReminders)
      .where(
        and(
          eq(eventCheckInReminders.eventRequestId, eventRequestId),
          eq(eventCheckInReminders.userId, req.user.id)
        )
      )
      .limit(1);

    res.json({ reminder: reminder || null });
  } catch (error) {
    logger.error('Error getting check-in reminder:', error);
    res.status(500).json({ error: 'Failed to get reminder settings' });
  }
});

// POST /api/event-check-in-reminders
// Create or update reminder settings for an event request
router.post('/', async (req: any, res) => {
  try {
    const { eventRequestId, enabled, frequency, channel } = req.body;
    const userId = req.user.id;

    if (!eventRequestId) {
      return res.status(400).json({ error: 'eventRequestId is required' });
    }

    // Verify the event exists
    const [event] = await db
      .select({ id: eventRequests.id })
      .from(eventRequests)
      .where(eq(eventRequests.id, eventRequestId))
      .limit(1);

    if (!event) {
      return res.status(404).json({ error: 'Event request not found' });
    }

    const validFrequencies = ['daily', 'every_3_days', 'weekly', 'biweekly'];
    const validChannels = ['email', 'sms', 'both'];
    const safeFrequency = validFrequencies.includes(frequency) ? frequency : 'weekly';
    const safeChannel = validChannels.includes(channel) ? channel : 'email';
    const isEnabled = enabled !== false;

    const nextDueAt = isEnabled ? calculateNextDue(safeFrequency) : null;

    // Upsert: check if one already exists
    const [existing] = await db
      .select()
      .from(eventCheckInReminders)
      .where(
        and(
          eq(eventCheckInReminders.eventRequestId, eventRequestId),
          eq(eventCheckInReminders.userId, userId)
        )
      )
      .limit(1);

    let reminder;
    if (existing) {
      [reminder] = await db
        .update(eventCheckInReminders)
        .set({
          enabled: isEnabled,
          frequency: safeFrequency,
          channel: safeChannel,
          nextDueAt,
          updatedAt: new Date(),
        })
        .where(eq(eventCheckInReminders.id, existing.id))
        .returning();
    } else {
      [reminder] = await db
        .insert(eventCheckInReminders)
        .values({
          eventRequestId,
          userId,
          enabled: isEnabled,
          frequency: safeFrequency,
          channel: safeChannel,
          nextDueAt,
        })
        .returning();
    }

    logger.info(`Check-in reminder ${existing ? 'updated' : 'created'} for event ${eventRequestId} by user ${userId}: ${isEnabled ? 'ON' : 'OFF'}, ${safeFrequency}, ${safeChannel}`);

    res.json({ reminder });
  } catch (error) {
    logger.error('Error saving check-in reminder:', error);
    res.status(500).json({ error: 'Failed to save reminder settings' });
  }
});

// DELETE /api/event-check-in-reminders/:eventRequestId
// Remove reminder for an event request
router.delete('/:eventRequestId', async (req: any, res) => {
  try {
    const eventRequestId = parseInt(req.params.eventRequestId);
    if (isNaN(eventRequestId)) {
      return res.status(400).json({ error: 'Invalid event request ID' });
    }

    await db
      .delete(eventCheckInReminders)
      .where(
        and(
          eq(eventCheckInReminders.eventRequestId, eventRequestId),
          eq(eventCheckInReminders.userId, req.user.id)
        )
      );

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting check-in reminder:', error);
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

export default router;
