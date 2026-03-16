import express from 'express';
import { db } from '../db';
import { eventCheckInReminders, eventReminderSnoozes, eventRequests, REMINDER_RULE_TYPES } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';
import { calculateNextDue } from '../utils/reminder-scheduling';

const router = express.Router();

const VALID_RULE_TYPES = Object.values(REMINDER_RULE_TYPES);
const VALID_FREQUENCIES = ['daily', 'every_3_days', 'weekly', 'biweekly'];
const VALID_CHANNELS = ['email', 'sms', 'both'];

// GET /api/event-check-in-reminders/:eventRequestId
// Get ALL reminder rules for a specific event request (for current user)
router.get('/:eventRequestId', async (req: any, res) => {
  try {
    const eventRequestId = parseInt(req.params.eventRequestId);
    if (isNaN(eventRequestId)) {
      return res.status(400).json({ error: 'Invalid event request ID' });
    }

    const reminders = await db
      .select()
      .from(eventCheckInReminders)
      .where(
        and(
          eq(eventCheckInReminders.eventRequestId, eventRequestId),
          eq(eventCheckInReminders.userId, req.user.id)
        )
      );

    // Also return as a map by ruleType for easy client-side access
    const rulesMap: Record<string, typeof reminders[0]> = {};
    for (const r of reminders) {
      rulesMap[r.ruleType] = r;
    }

    // Backward compatibility: return single "reminder" if only one exists (general_checkin)
    const legacyReminder = rulesMap['general_checkin'] || null;

    res.json({ reminders, rulesMap, reminder: legacyReminder });
  } catch (error) {
    logger.error('Error getting check-in reminders:', error);
    res.status(500).json({ error: 'Failed to get reminder settings' });
  }
});

// POST /api/event-check-in-reminders
// Create or update a specific reminder rule for an event request
router.post('/', async (req: any, res) => {
  try {
    const { eventRequestId, ruleType, enabled, frequency, channel, thresholdDays } = req.body;
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

    const safeRuleType = VALID_RULE_TYPES.includes(ruleType) ? ruleType : 'general_checkin';
    const safeFrequency = VALID_FREQUENCIES.includes(frequency) ? frequency : 'weekly';
    const safeChannel = VALID_CHANNELS.includes(channel) ? channel : 'email';
    const safeThreshold = typeof thresholdDays === 'number' && thresholdDays > 0 ? thresholdDays : 7;
    const isEnabled = enabled !== false;

    const nextDueAt = isEnabled ? calculateNextDue(safeFrequency) : null;

    // Upsert: check if rule of this type already exists for this event+user
    const [existing] = await db
      .select()
      .from(eventCheckInReminders)
      .where(
        and(
          eq(eventCheckInReminders.eventRequestId, eventRequestId),
          eq(eventCheckInReminders.userId, userId),
          eq(eventCheckInReminders.ruleType, safeRuleType)
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
          thresholdDays: safeThreshold,
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
          ruleType: safeRuleType,
          enabled: isEnabled,
          frequency: safeFrequency,
          channel: safeChannel,
          thresholdDays: safeThreshold,
          nextDueAt,
        })
        .returning();
    }

    logger.info(`Reminder rule ${existing ? 'updated' : 'created'} for event ${eventRequestId} by user ${userId}: type=${safeRuleType}, ${isEnabled ? 'ON' : 'OFF'}, threshold=${safeThreshold}d, ${safeFrequency}, ${safeChannel}`);

    res.json({ reminder });
  } catch (error) {
    logger.error('Error saving check-in reminder:', error);
    res.status(500).json({ error: 'Failed to save reminder settings' });
  }
});

// POST /api/event-check-in-reminders/bulk
// Save multiple reminder rules at once for an event
router.post('/bulk', async (req: any, res) => {
  try {
    const { eventRequestId, rules } = req.body;
    const userId = req.user.id;

    if (!eventRequestId || !Array.isArray(rules)) {
      return res.status(400).json({ error: 'eventRequestId and rules array are required' });
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

    const savedRules = [];

    for (const rule of rules) {
      const safeRuleType = VALID_RULE_TYPES.includes(rule.ruleType) ? rule.ruleType : 'general_checkin';
      const safeFrequency = VALID_FREQUENCIES.includes(rule.frequency) ? rule.frequency : 'weekly';
      const safeChannel = VALID_CHANNELS.includes(rule.channel) ? rule.channel : 'email';
      const safeThreshold = typeof rule.thresholdDays === 'number' && rule.thresholdDays > 0 ? rule.thresholdDays : 7;
      const isEnabled = rule.enabled !== false;
      const nextDueAt = isEnabled ? calculateNextDue(safeFrequency) : null;

      const [existing] = await db
        .select()
        .from(eventCheckInReminders)
        .where(
          and(
            eq(eventCheckInReminders.eventRequestId, eventRequestId),
            eq(eventCheckInReminders.userId, userId),
            eq(eventCheckInReminders.ruleType, safeRuleType)
          )
        )
        .limit(1);

      let saved;
      if (existing) {
        [saved] = await db
          .update(eventCheckInReminders)
          .set({
            enabled: isEnabled,
            frequency: safeFrequency,
            channel: safeChannel,
            thresholdDays: safeThreshold,
            nextDueAt,
            updatedAt: new Date(),
          })
          .where(eq(eventCheckInReminders.id, existing.id))
          .returning();
      } else {
        [saved] = await db
          .insert(eventCheckInReminders)
          .values({
            eventRequestId,
            userId,
            ruleType: safeRuleType,
            enabled: isEnabled,
            frequency: safeFrequency,
            channel: safeChannel,
            thresholdDays: safeThreshold,
            nextDueAt,
          })
          .returning();
      }
      savedRules.push(saved);
    }

    logger.info(`Bulk saved ${savedRules.length} reminder rules for event ${eventRequestId} by user ${userId}`);
    res.json({ reminders: savedRules });
  } catch (error) {
    logger.error('Error bulk saving reminder rules:', error);
    res.status(500).json({ error: 'Failed to save reminder rules' });
  }
});

// DELETE /api/event-check-in-reminders/:eventRequestId
// Remove all reminders for an event request (for current user)
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
    logger.error('Error deleting check-in reminders:', error);
    res.status(500).json({ error: 'Failed to delete reminders' });
  }
});

// DELETE /api/event-check-in-reminders/:eventRequestId/:ruleType
// Remove a specific reminder rule for an event request
router.delete('/:eventRequestId/:ruleType', async (req: any, res) => {
  try {
    const eventRequestId = parseInt(req.params.eventRequestId);
    const { ruleType } = req.params;

    if (isNaN(eventRequestId)) {
      return res.status(400).json({ error: 'Invalid event request ID' });
    }

    await db
      .delete(eventCheckInReminders)
      .where(
        and(
          eq(eventCheckInReminders.eventRequestId, eventRequestId),
          eq(eventCheckInReminders.userId, req.user.id),
          eq(eventCheckInReminders.ruleType, ruleType)
        )
      );

    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting reminder rule:', error);
    res.status(500).json({ error: 'Failed to delete reminder rule' });
  }
});

// ---------------------------------------------------------------------------
// Snooze endpoints
// ---------------------------------------------------------------------------

const VALID_SNOOZE_TYPES = ['timed', 'until_date', 'until_contact'];

// GET /api/event-check-in-reminders/:eventRequestId/snooze
router.get('/:eventRequestId/snooze', async (req: any, res) => {
  try {
    const eventRequestId = parseInt(req.params.eventRequestId);
    if (isNaN(eventRequestId)) return res.status(400).json({ error: 'Invalid event request ID' });

    const [snooze] = await db
      .select()
      .from(eventReminderSnoozes)
      .where(
        and(
          eq(eventReminderSnoozes.eventRequestId, eventRequestId),
          eq(eventReminderSnoozes.userId, req.user.id),
          eq(eventReminderSnoozes.active, true),
        ),
      )
      .limit(1);

    res.json({ snooze: snooze || null });
  } catch (error) {
    logger.error('Error getting snooze:', error);
    res.status(500).json({ error: 'Failed to get snooze status' });
  }
});

// POST /api/event-check-in-reminders/:eventRequestId/snooze
router.post('/:eventRequestId/snooze', async (req: any, res) => {
  try {
    const eventRequestId = parseInt(req.params.eventRequestId);
    if (isNaN(eventRequestId)) return res.status(400).json({ error: 'Invalid event request ID' });

    const { snoozeType, snoozedUntil, reason } = req.body;

    if (!VALID_SNOOZE_TYPES.includes(snoozeType)) {
      return res.status(400).json({ error: 'Invalid snooze type' });
    }

    let computedUntil: Date | null = null;
    if (snoozeType === 'timed') {
      const days = parseInt(snoozedUntil);
      if (!days || days < 1) return res.status(400).json({ error: 'Timed snooze requires a positive number of days' });
      computedUntil = new Date();
      computedUntil.setDate(computedUntil.getDate() + days);
      computedUntil.setHours(9, 0, 0, 0);
    } else if (snoozeType === 'until_date') {
      computedUntil = new Date(snoozedUntil);
      if (isNaN(computedUntil.getTime())) return res.status(400).json({ error: 'Invalid date' });
    }
    // until_contact: computedUntil stays null (open-ended)

    // Upsert: cancel any existing snooze and create a new one
    await db
      .update(eventReminderSnoozes)
      .set({ active: false, cancelledAt: new Date() })
      .where(
        and(
          eq(eventReminderSnoozes.eventRequestId, eventRequestId),
          eq(eventReminderSnoozes.userId, req.user.id),
          eq(eventReminderSnoozes.active, true),
        ),
      );

    const [snooze] = await db
      .insert(eventReminderSnoozes)
      .values({
        eventRequestId,
        userId: req.user.id,
        snoozeType,
        snoozedUntil: computedUntil,
        reason: reason || null,
        active: true,
      })
      .returning();

    logger.info(`Snooze created for event ${eventRequestId} by ${req.user.id}: ${snoozeType}`);
    res.json({ snooze });
  } catch (error) {
    logger.error('Error creating snooze:', error);
    res.status(500).json({ error: 'Failed to create snooze' });
  }
});

// DELETE /api/event-check-in-reminders/:eventRequestId/snooze
router.delete('/:eventRequestId/snooze', async (req: any, res) => {
  try {
    const eventRequestId = parseInt(req.params.eventRequestId);
    if (isNaN(eventRequestId)) return res.status(400).json({ error: 'Invalid event request ID' });

    await db
      .update(eventReminderSnoozes)
      .set({ active: false, cancelledAt: new Date() })
      .where(
        and(
          eq(eventReminderSnoozes.eventRequestId, eventRequestId),
          eq(eventReminderSnoozes.userId, req.user.id),
          eq(eventReminderSnoozes.active, true),
        ),
      );

    res.json({ success: true });
  } catch (error) {
    logger.error('Error cancelling snooze:', error);
    res.status(500).json({ error: 'Failed to cancel snooze' });
  }
});

export default router;
