/**
 * Event Requests - Conflict Detection Routes
 *
 * Handles checking for scheduling conflicts, date conflicts, and returning organizations.
 * Split from event-requests-legacy.ts for better organization.
 */

import { Router } from 'express';
import { isAuthenticated } from '../../auth';
import { logger } from '../../middleware/logger';

const router = Router();

// ============================================================================
// Conflict Detection Routes
// ============================================================================

/**
 * Optimistic conflict checking for event scheduling
 * POST /api/event-requests/check-conflicts
 *
 * Returns conflicts/warnings without blocking event creation
 */
router.post('/check-conflicts', isAuthenticated, async (req, res) => {
  try {
    const { checkEventConflicts } = await import('../../services/event-conflict-detection');

    const eventData = {
      id: req.body.id,
      scheduledEventDate: req.body.scheduledEventDate,
      eventStartTime: req.body.eventStartTime,
      eventEndTime: req.body.eventEndTime,
      pickupTime: req.body.pickupTime,
      vanDriverNeeded: req.body.vanDriverNeeded,
      isDhlVan: req.body.isDhlVan,
      selfTransport: req.body.selfTransport,
      assignedVanDriverId: req.body.assignedVanDriverId,
      assignedSpeakerIds: req.body.assignedSpeakerIds,
      assignedRecipientIds: req.body.assignedRecipientIds,
      organizationName: req.body.organizationName,
      // Legacy fields
      vanBooked: req.body.vanBooked,
      driverName: req.body.driverName,
      recipientId: req.body.recipientId,
    };

    const result = await checkEventConflicts(eventData);

    res.json(result);
  } catch (error) {
    logger.error('Error checking event conflicts:', error);
    res.status(500).json({
      hasConflicts: false,
      warnings: [],
      summary: 'Error checking conflicts',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get all conflicts for a specific date
 * GET /api/event-requests/conflicts-for-date?date=2024-01-15
 */
router.get('/conflicts-for-date', isAuthenticated, async (req, res) => {
  try {
    const dateStr = req.query.date as string;
    if (!dateStr) {
      return res.status(400).json({ error: 'Date parameter required' });
    }

    const { getConflictsForDate } = await import('../../services/event-conflict-detection');
    const date = new Date(dateStr);

    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const result = await getConflictsForDate(date);
    res.json(result);
  } catch (error) {
    logger.error('Error getting conflicts for date:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Other events on the same date also requesting the org van (in process or scheduled).
 * GET /api/event-requests/van-requests-for-date?date=2024-01-15&excludeEventId=123
 */
router.get('/van-requests-for-date', isAuthenticated, async (req, res) => {
  try {
    const dateStr = req.query.date as string;
    if (!dateStr) {
      return res.status(400).json({ error: 'Date parameter required' });
    }

    const excludeEventId = req.query.excludeEventId
      ? parseInt(req.query.excludeEventId as string, 10)
      : undefined;

    const { getOtherVanRequestsOnDate } = await import('../../services/event-conflict-detection');
    const date = new Date(dateStr);

    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const result = await getOtherVanRequestsOnDate(date, excludeEventId);
    res.json(result);
  } catch (error) {
    logger.error('Error getting van requests for date:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Whole-calendar scan for van scheduling conflicts.
 * GET /api/event-requests/van-conflict-dates
 *
 * Returns every date that has 2+ in-process / scheduled / rescheduled events
 * promised the org van, grouped into:
 *   - `confirmed`: 2+ events with vanDriverNeeded=true (must resolve)
 *   - `potential`: 2+ van events including at least one vanNeededLikely
 *
 * Excludes self-transport orgs and DHL-van events (they don't use TSP's van).
 */
router.get('/van-conflict-dates', isAuthenticated, async (_req, res) => {
  try {
    const { getAllVanConflictDates } = await import('../../services/event-conflict-detection');
    const result = await getAllVanConflictDates();
    res.json(result);
  } catch (error) {
    logger.error('Error scanning van conflict dates:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get weekly capacity summary for a date range
 * GET /api/event-requests/weekly-capacity?start=2026-03-01&end=2026-04-30
 *
 * Returns sandwich totals and event counts per week for the given range.
 * Used by calendar view to highlight light vs heavy weeks.
 */
router.get('/weekly-capacity', isAuthenticated, async (req, res) => {
  try {
    const startStr = req.query.start as string;
    const endStr = req.query.end as string;
    if (!startStr || !endStr) {
      return res.status(400).json({ error: 'start and end date parameters required' });
    }

    const { getWeeklyCapacity } = await import('../../services/event-conflict-detection');
    const result = await getWeeklyCapacity(new Date(startStr), new Date(endStr));
    res.json(result);
  } catch (error) {
    logger.error('Error getting weekly capacity:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

/**
 * Check if an organization is a returning organization
 * GET /api/event-requests/check-returning-org?orgName=...&currentEventId=...&contactEmail=...&contactName=...&contactPhone=...
 *
 * This endpoint helps the intake team identify organizations that have worked with us before,
 * so they can personalize their outreach instead of sending generic first-time emails.
 *
 * IMPORTANT: Contact matching requires email OR (name + phone) match to prevent
 * false positives from people with the same name.
 *
 * Returns:
 * - isReturning: boolean - Whether the organization has past events/collections
 * - isReturningContact: boolean - Whether the contact person has been involved in past events
 * - pastEventCount: number - Number of past events
 * - collectionCount: number - Number of sandwich collections
 * - mostRecentEvent: object - Most recent event info (if any)
 * - pastContactName: string - Name of the most recent past contact (for context)
 */
router.get('/check-returning-org', isAuthenticated, async (req, res) => {
  try {
    const orgName = req.query.orgName as string;
    const currentEventId = req.query.currentEventId ? parseInt(req.query.currentEventId as string) : undefined;
    const contactEmail = req.query.contactEmail as string | undefined;
    const contactName = req.query.contactName as string | undefined;
    const contactPhone = req.query.contactPhone as string | undefined;
    const department = req.query.department as string | undefined;

    if (!orgName) {
      return res.status(400).json({ error: 'Organization name required' });
    }

    const { checkReturningOrganization } = await import('../../services/organizations/returning-organization');
    const result = await checkReturningOrganization(orgName, currentEventId, contactEmail, contactName, contactPhone, department);

    res.json(result);
  } catch (error) {
    logger.error('Error checking returning organization:', error);
    res.status(500).json({
      isReturning: false,
      isReturningContact: false,
      pastEventCount: 0,
      collectionCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Batch returning-org checks for visible event lists (one request per tab).
 * POST /api/event-requests/check-returning-org/bulk
 */
router.post('/check-returning-org/bulk', isAuthenticated, async (req, res) => {
  try {
    const { z } = await import('zod');
    const bulkSchema = z.object({
      items: z
        .array(
          z.object({
            eventId: z.number().int().positive(),
            orgName: z.string().min(1).max(500),
            contactEmail: z.string().max(320).optional().nullable(),
            contactName: z.string().max(200).optional().nullable(),
            contactPhone: z.string().max(50).optional().nullable(),
            department: z.string().max(200).optional().nullable(),
          })
        )
        .max(100),
    });

    const { items } = bulkSchema.parse(req.body);
    const { checkReturningOrganizationsBulk } = await import(
      '../../services/organizations/returning-organization'
    );
    const data = await checkReturningOrganizationsBulk(items);
    res.json({ data });
  } catch (error) {
    logger.error('Error in bulk returning organization check:', error);
    res.status(500).json({
      data: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
