import { Router } from 'express';
import { isAuthenticated } from '../temp-auth';
import { storage } from '../storage-wrapper';
import { z } from 'zod';

const router = Router();

const smsOptInSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required'),
  consent: z.boolean(),
});

/**
 * Get user's SMS status
 */
router.get('/users/sms-status', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await storage.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const metadata = user.metadata || {};
    const smsConsent = metadata.smsConsent || {};
    
    res.json({
      hasOptedIn: !!smsConsent.enabled,
      phoneNumber: smsConsent.phoneNumber || null,
    });
  } catch (error) {
    console.error('Error getting SMS status:', error);
    res.status(500).json({
      error: 'Failed to get SMS status',
      message: error.message,
    });
  }
});

/**
 * SMS opt-in endpoint
 */
router.post('/users/sms-opt-in', isAuthenticated, async (req, res) => {
  try {
    const { phoneNumber, consent } = smsOptInSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!consent) {
      return res.status(400).json({ error: 'Consent is required for SMS opt-in' });
    }

    // Clean and format phone number
    const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `+1${cleanPhone}` : cleanPhone;

    // Validate phone number format (basic US phone number validation)
    if (!/^\+1\d{10}$/.test(formattedPhone)) {
      return res.status(400).json({ 
        error: 'Invalid phone number format. Please enter a valid US phone number.' 
      });
    }

    // Get current user
    const user = await storage.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user metadata with SMS consent
    const updatedMetadata = {
      ...user.metadata,
      smsConsent: {
        enabled: true,
        phoneNumber: formattedPhone,
        consentTimestamp: new Date().toISOString(),
        consentVersion: '1.0',
      },
    };

    await storage.updateUser(userId, { metadata: updatedMetadata });

    // Send welcome SMS to confirm opt-in
    try {
      // Check if Twilio is configured
      const twilioConfigured = process.env.TWILIO_ACCOUNT_SID &&
                              process.env.TWILIO_AUTH_TOKEN &&
                              process.env.TWILIO_PHONE_NUMBER;

      if (twilioConfigured) {
        const Twilio = await import('twilio');
        const twilioClient = Twilio.default(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );

        const welcomeMessage = `Welcome to The Sandwich Project SMS reminders! 🥪\n\nYou'll receive text reminders when weekly sandwich counts are missing.\n\nTo stop receiving messages, reply STOP at any time or visit the app settings.`;

        const result = await twilioClient.messages.create({
          body: welcomeMessage,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: formattedPhone,
        });

        console.log(`✅ Welcome SMS sent to ${formattedPhone}, Message SID: ${result.sid}`);
      } else {
        console.warn('⚠️ Twilio not configured - skipping welcome SMS');
        console.log('Missing Twilio config:', {
          hasAccountSid: !!process.env.TWILIO_ACCOUNT_SID,
          hasAuthToken: !!process.env.TWILIO_AUTH_TOKEN,
          hasPhoneNumber: !!process.env.TWILIO_PHONE_NUMBER
        });
      }
    } catch (smsError) {
      // Log the error but don't fail the opt-in
      console.error('Failed to send welcome SMS:', smsError);
      console.error('Error details:', {
        message: smsError.message,
        code: smsError.code,
        moreInfo: smsError.moreInfo
      });
    }

    console.log(`✅ SMS opt-in successful for user ${user.email} (${formattedPhone})`);

    res.json({
      success: true,
      message: 'Successfully opted in to SMS reminders',
      phoneNumber: formattedPhone,
    });
  } catch (error) {
    console.error('Error processing SMS opt-in:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Failed to opt in to SMS reminders',
      message: error.message,
    });
  }
});

/**
 * SMS opt-out endpoint
 */
router.post('/users/sms-opt-out', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get current user
    const user = await storage.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user metadata to disable SMS consent
    const updatedMetadata = {
      ...user.metadata,
      smsConsent: {
        enabled: false,
        phoneNumber: null,
        optOutTimestamp: new Date().toISOString(),
      },
    };

    await storage.updateUser(userId, { metadata: updatedMetadata });

    console.log(`✅ SMS opt-out successful for user ${user.email}`);

    res.json({
      success: true,
      message: 'Successfully opted out of SMS reminders',
    });
  } catch (error) {
    console.error('Error processing SMS opt-out:', error);
    res.status(500).json({
      error: 'Failed to opt out of SMS reminders',
      message: error.message,
    });
  }
});

export { router as smsUserRoutes };