/**
 * Event Requests - Lifecycle and Status Routes
 *
 * Handles lifecycle-oriented updates such as scheduling follow-up calls,
 * toggling MLK Day flags, and manually triggering admin auto-complete jobs.
 * Split from event-requests-legacy.ts for better organization.
 */

import { Router, Response } from 'express';
import { storage } from '../../storage-wrapper';
import { isAuthenticated } from '../../auth';
import { requirePermission } from '../../middleware/auth';
import { AuditLogger } from '../../audit-logger';
import { logger } from '../../middleware/logger';
import type { AuthenticatedRequest } from '../../types/express';

const router = Router();

// Enhanced logging function for activity tracking
const logActivity = async (
  req: AuthenticatedRequest,
  res: Response,
  permission: string,
  message: string,
  metadata?: Record<string, unknown>
) => {
  if (metadata) {
    res.locals.eventRequestAuditDetails = metadata;
  }
};

// Schedule a follow-up call
router.patch('/:id/schedule-call', isAuthenticated, requirePermission('EVENT_REQUESTS_EDIT'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { scheduledCallDate } = req.body;

    // Validate the date
    if (!scheduledCallDate) {
      return res.status(400).json({ message: 'Scheduled call date is required' });
    }

    // Get original data for audit logging
    const originalEvent = await storage.getEventRequestById(id);
    if (!originalEvent) {
      return res.status(404).json({ message: 'Event request not found' });
    }

    // Update the event request with the scheduled call date
    const updatedEventRequest = await storage.updateEventRequest(id, {
      scheduledCallDate: new Date(scheduledCallDate),
      callScheduledAt: new Date(),
      scheduledBy: req.user?.id,
    });

    if (!updatedEventRequest) {
      return res.status(404).json({ message: 'Event request not found' });
    }

    // Log the change
    await AuditLogger.logEventRequestChange(
      id.toString(),
      originalEvent,
      updatedEventRequest,
      {
        userId: req.user?.id,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
        sessionId: req.session?.id || req.sessionID,
      }
    );

    await logActivity(
      req,
      res,
      'EVENT_REQUESTS_SCHEDULE_CALL',
      `Scheduled call for event request: ${id}`,
      { scheduledCallDate }
    );

    res.json(updatedEventRequest);
  } catch (error) {
    logger.error('Error scheduling call:', error);
    res.status(500).json({
      message: 'Failed to schedule call',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Mark event as MLK Day event
router.patch('/:id/mlk-day', isAuthenticated, requirePermission('EVENT_REQUESTS_EDIT'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { isMlkDayEvent } = req.body;

    // Get original data for audit logging
    const originalEvent = await storage.getEventRequestById(id);
    if (!originalEvent) {
      return res.status(404).json({ message: 'Event request not found' });
    }

    // Update the event request
    const updatedEventRequest = await storage.updateEventRequest(id, {
      isMlkDayEvent,
      mlkDayMarkedAt: isMlkDayEvent ? new Date() : null,
      mlkDayMarkedBy: isMlkDayEvent ? req.user?.id : null,
    });

    if (!updatedEventRequest) {
      return res.status(404).json({ message: 'Event request not found' });
    }

    // Log the change
    await AuditLogger.logEventRequestChange(
      id.toString(),
      originalEvent,
      updatedEventRequest,
      {
        userId: req.user?.id,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
        sessionId: req.session?.id || req.sessionID,
      }
    );

    await logActivity(
      req,
      res,
      'EVENT_REQUESTS_MLK_DAY_UPDATE',
      `${isMlkDayEvent ? 'Marked' : 'Unmarked'} event as MLK Day event: ${id}`,
      { isMlkDayEvent }
    );

    res.json(updatedEventRequest);
  } catch (error) {
    logger.error('Error updating MLK Day status:', error);
    res.status(500).json({
      message: 'Failed to update MLK Day status',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Manually trigger auto-complete for past events (admin only)
router.post('/admin/auto-complete-passed', isAuthenticated, requirePermission('ADMIN_ACCESS'), async (req, res) => {
  try {
    const { autoCompletePassedEvents } = await import('../../services/cron-jobs');
    const result = await autoCompletePassedEvents();

    res.json({
      message: `Auto-complete completed: ${result.eventsCompleted} events moved to completed status`,
      eventsCompleted: result.eventsCompleted,
      errors: result.errors,
      timestamp: result.timestamp,
    });
  } catch (error) {
    logger.error('Error running manual auto-complete:', error);
    res.status(500).json({
      message: 'Failed to run auto-complete',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
