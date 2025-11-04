import { Router } from 'express';
import { z } from 'zod';
import { SMSProviderFactory } from '../sms-providers/provider-factory';
import { logger } from '../utils/production-safe-logger';

const router = Router();

const sendQuickSMSSchema = z.object({
  phoneNumber: z.string().min(10, 'Phone number must be at least 10 digits'),
  appSection: z.string(),
  sectionLabel: z.string(),
  customMessage: z.string().optional(),
});

router.post('/send', async (req, res) => {
  try {
    const { phoneNumber, appSection, sectionLabel, customMessage } = sendQuickSMSSchema.parse(req.body);

    // Get the SMS provider
    const smsFactory = SMSProviderFactory.getInstance();
    const smsProvider = smsFactory.getProvider();

    if (!smsProvider || !smsProvider.isConfigured()) {
      logger.error('SMS provider not configured');
      return res.status(500).json({
        success: false,
        message: 'SMS service not available. Please contact your administrator.',
      });
    }

    // Build the app URL
    const appUrl = process.env.REPLIT_DOMAIN
      ? `https://${process.env.REPLIT_DOMAIN}`
      : 'https://your-app.replit.app';
    
    // Build the direct link to the app section
    const directLink = `${appUrl}/${appSection}`;

    // Build the message
    let message: string;
    if (customMessage) {
      message = `${customMessage}\n\n${sectionLabel}: ${directLink}`;
    } else {
      message = `Here's the link to ${sectionLabel} in The Sandwich Project app:\n\n${directLink}`;
    }

    // Send the SMS
    const result = await smsProvider.sendSMS({
      to: phoneNumber,
      body: message,
    });

    if (result.success) {
      logger.log(`✅ Quick SMS link sent to ${phoneNumber} for ${sectionLabel}`);
      return res.json({
        success: true,
        message: 'Link sent successfully!',
        sentTo: phoneNumber,
        section: sectionLabel,
      });
    } else {
      logger.error(`Failed to send SMS: ${result.message}`);
      return res.status(500).json({
        success: false,
        message: result.message || 'Failed to send SMS',
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: error.errors,
      });
    }

    logger.error('Error sending quick SMS:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while sending the link',
    });
  }
});

export default router;
