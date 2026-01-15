/**
 * Communication routes for event requests (SMS, Email)
 */
import { Router, Response } from 'express';
import { storage } from '../../storage-wrapper';
import { requirePermission } from '../../middleware/auth';
import { isAuthenticated } from '../../auth';
import { logger } from '../../middleware/logger';
import type { AuthenticatedRequest } from '../../types/express';

const router = Router();

// Helper for logging activity
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

// Send event details via SMS to selected users
router.post('/:id/send-details-sms', isAuthenticated, requirePermission('EVENT_REQUESTS_VIEW'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'Please select at least one user' });
    }

    // Get event details
    const event = await storage.getEventRequestById(id);
    if (!event) {
      return res.status(404).json({ message: 'Event request not found' });
    }

    // Import SMS service
    const { SMSProviderFactory } = await import('../../sms-providers/provider-factory');
    const factory = SMSProviderFactory.getInstance();
    const smsProvider = factory.getProvider();

    if (!smsProvider || !smsProvider.isConfigured()) {
      return res.status(500).json({ message: 'SMS service not configured' });
    }

    // Get users and their phone numbers
    const users = await Promise.all(
      userIds.map(userId => storage.getUserById(userId))
    );

    const results = [];
    for (const user of users) {
      if (!user) {
        results.push({ userId: 'unknown', success: false, error: 'User not found' });
        continue;
      }

      // Verify SMS consent
      const smsConsent = (user.metadata as any)?.smsConsent;
      if (!smsConsent || smsConsent.status !== 'confirmed' || !smsConsent.enabled || !smsConsent.phoneNumber) {
        results.push({
          userId: user.id,
          userName: user.displayName || user.email,
          success: false,
          error: 'User has not confirmed SMS opt-in'
        });
        continue;
      }

      const phoneNumber = smsConsent.phoneNumber;

      // Format event details for SMS
      const organizationName = event.organizationName || 'Organization';
      const contactName = event.firstName && event.lastName
        ? `${event.firstName} ${event.lastName}`
        : event.firstName || 'Contact';

      const eventDate = event.scheduledEventDate
        ? new Date(event.scheduledEventDate).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric'
          })
        : 'TBD';

      const eventTime = event.eventStartTime && event.eventEndTime
        ? `${event.eventStartTime} - ${event.eventEndTime}`
        : event.pickupDateTime
          ? `Pickup at ${event.pickupDateTime.split('T')[1]?.substring(0, 5) || ''}`
          : 'Time TBD';

      // Create Google Maps link if address exists
      let locationText = event.eventAddress || 'Location TBD';
      if (event.eventAddress) {
        const mapsLink = `https://maps.google.com/?q=${encodeURIComponent(event.eventAddress)}`;
        locationText = `${event.eventAddress}\n📍 ${mapsLink}`;
      }

      // Build SMS message
      const message = `🥪 The Sandwich Project Event Details

Organization: ${organizationName}
Date: ${eventDate}
Time: ${eventTime}

Location:
${locationText}

Contact: ${contactName}
${event.phone ? `Phone: ${event.phone}` : ''}
${event.email ? `Email: ${event.email}` : ''}

Thank you for volunteering!`;

      try {
        const result = await smsProvider.sendSMS({
          to: phoneNumber,
          body: message,
        });

        results.push({
          userId: user.id,
          userName: user.displayName || user.email,
          phone: phoneNumber.replace(/\d(?=\d{4})/g, '*'),
          success: result.success,
          messageId: result.messageId,
        });
      } catch (error) {
        results.push({
          userId: user.id,
          userName: user.displayName || user.email,
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    await logActivity(
      req,
      res,
      'EVENT_DETAILS_SMS_SENT',
      `Sent event details for event ${id} to ${successCount}/${results.length} users`,
      { eventId: id, results }
    );

    res.json({
      success: true,
      message: `Sent to ${successCount} of ${results.length} users`,
      results,
    });
  } catch (error) {
    logger.error('Error sending event details SMS:', error);
    res.status(500).json({
      message: 'Failed to send event details',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Send correction SMS for event details
router.post('/:id/send-correction-sms', isAuthenticated, requirePermission('EVENT_REQUESTS_SEND_SMS'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { userIds, customMessage } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ message: 'Please select at least one user' });
    }

    if (!customMessage || typeof customMessage !== 'string' || customMessage.trim().length === 0) {
      return res.status(400).json({ message: 'Please provide a correction message' });
    }

    const event = await storage.getEventRequestById(id);
    if (!event) {
      return res.status(404).json({ message: 'Event request not found' });
    }

    const { SMSProviderFactory } = await import('../../sms-providers/provider-factory');
    const factory = SMSProviderFactory.getInstance();
    const smsProvider = factory.getProvider();

    if (!smsProvider || !smsProvider.isConfigured()) {
      return res.status(500).json({ message: 'SMS service not configured' });
    }

    const users = await Promise.all(
      userIds.map(userId => storage.getUserById(userId))
    );

    const results = [];
    for (const user of users) {
      if (!user) {
        results.push({ userId: 'unknown', success: false, error: 'User not found' });
        continue;
      }

      const smsConsent = (user.metadata as any)?.smsConsent;
      if (!smsConsent || smsConsent.status !== 'confirmed' || !smsConsent.enabled || !smsConsent.phoneNumber) {
        results.push({
          userId: user.id,
          userName: user.displayName || user.email,
          success: false,
          error: 'User has not confirmed SMS opt-in'
        });
        continue;
      }

      const phoneNumber = smsConsent.phoneNumber;

      const message = `🥪 The Sandwich Project - CORRECTION

${customMessage.trim()}

We apologize for any confusion!`;

      try {
        const result = await smsProvider.sendSMS({
          to: phoneNumber,
          body: message,
        });

        results.push({
          userId: user.id,
          userName: user.displayName || user.email,
          phone: phoneNumber.replace(/\d(?=\d{4})/g, '*'),
          success: result.success,
          messageId: result.messageId,
        });
      } catch (error) {
        results.push({
          userId: user.id,
          userName: user.displayName || user.email,
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;

    await logActivity(
      req,
      res,
      'EVENT_CORRECTION_SMS_SENT',
      `Sent correction SMS for event ${id} to ${successCount}/${results.length} users`,
      { eventId: id, results }
    );

    res.json({
      success: true,
      message: `Sent correction to ${successCount} of ${results.length} users`,
      results,
    });
  } catch (error) {
    logger.error('Error sending correction SMS:', error);
    res.status(500).json({
      message: 'Failed to send correction SMS',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as communicationsRouter };
