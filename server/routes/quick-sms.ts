import { Router } from 'express';
import { z } from 'zod';
import { SMSProviderFactory } from '../sms-providers/provider-factory';
import { logger } from '../utils/production-safe-logger';
import { storage } from '../storage';
import { getUserMetadata } from '../../shared/types';

const router = Router();

const sendQuickSMSSchema = z.object({
  phoneNumber: z.string()
    .min(10, 'Phone number must be at least 10 digits')
    .transform((val) => val.replace(/[\s\-\(\)]/g, '')), // Strip formatting
  appSection: z.string(),
  sectionLabel: z.string(),
  customMessage: z.string().optional(),
});

router.post('/send', async (req, res) => {
  try {
    const { phoneNumber, appSection, sectionLabel, customMessage } = sendQuickSMSSchema.parse(req.body);

    // Normalize phone number (remove formatting, ensure it starts with +)
    let normalizedPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
    if (!normalizedPhone.startsWith('+')) {
      // Default to US country code if not provided
      normalizedPhone = normalizedPhone.startsWith('1') ? `+${normalizedPhone}` : `+1${normalizedPhone}`;
    }

    // Check if recipient has opted in to receive SMS
    const allUsers = await storage.getAllUsers();
    const recipientUser = allUsers.find((user) => {
      const metadata = getUserMetadata(user);
      const smsConsent = metadata.smsConsent;
      // Match against stored phone number (normalized)
      const storedPhone = smsConsent?.phoneNumber?.replace(/[\s\-\(\)]/g, '');
      return storedPhone === normalizedPhone;
    });

    if (recipientUser) {
      const metadata = getUserMetadata(recipientUser);
      const smsConsent = metadata.smsConsent;

      // Check if they've opted in and consented
      if (smsConsent?.status !== 'confirmed' || !smsConsent.enabled) {
        logger.warn(`Attempted to send SMS to ${normalizedPhone} who has not opted in`);
        return res.status(403).json({
          success: false,
          message: 'This user has not opted in to receive text messages. They need to enable SMS notifications in their profile settings first.',
        });
      }
    } else {
      // Phone number not found in any user profile
      logger.warn(`Attempted to send SMS to ${normalizedPhone} which is not registered`);
      return res.status(404).json({
        success: false,
        message: 'This phone number is not registered in the system or has not opted in to receive texts. The recipient must enable SMS notifications in their profile first.',
      });
    }

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

    // Build the app URL using the same logic as the rest of the app
    let appUrl: string;
    if (process.env.REPLIT_DEV_DOMAIN) {
      appUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
    } else if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
      appUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
    } else {
      // Fallback to request origin
      appUrl = req.headers.origin || 'https://sandwich-project-platform-final-katielong2316.replit.app';
    }
    
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
      to: normalizedPhone,
      body: message,
    });

    if (result.success) {
      logger.log(`✅ Quick SMS link sent to ${normalizedPhone} for ${sectionLabel}`);
      return res.json({
        success: true,
        message: 'Link sent successfully!',
        sentTo: normalizedPhone,
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
