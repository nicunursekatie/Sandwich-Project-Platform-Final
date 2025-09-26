import { Router } from 'express';
import { isAuthenticated } from '../temp-auth';
import { storage } from '../storage-wrapper';
import { z } from 'zod';
import { generateVerificationCode, sendConfirmationSMS } from '../sms-service';
import Twilio from 'twilio';

const router = Router();

const smsOptInSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required'),
  consent: z.boolean(),
});

const smsConfirmationSchema = z.object({
  verificationCode: z.string().min(1, 'Verification code is required'),
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

    const metadata = user.metadata as any || {};
    const smsConsent = metadata.smsConsent || {};
    
    // Determine SMS status based on the new schema
    const status = smsConsent.status || (smsConsent.enabled ? 'confirmed' : 'not_opted_in');
    const hasConfirmedOptIn = status === 'confirmed' && smsConsent.enabled;
    const isPendingConfirmation = status === 'pending_confirmation';
    
    res.json({
      hasOptedIn: hasConfirmedOptIn,
      phoneNumber: smsConsent.phoneNumber || null,
      status: status,
      isPendingConfirmation: isPendingConfirmation,
      hasConfirmedOptIn: hasConfirmedOptIn,
      confirmedAt: smsConsent.confirmedAt || null,
      confirmationMethod: smsConsent.confirmationMethod || null,
    });
  } catch (error) {
    console.error('Error getting SMS status:', error);
    res.status(500).json({
      error: 'Failed to get SMS status',
      message: (error as Error).message,
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

    // Generate verification code and send confirmation SMS
    const verificationCode = generateVerificationCode();
    const confirmationResult = await sendConfirmationSMS(formattedPhone, verificationCode);

    if (!confirmationResult.success) {
      return res.status(500).json({
        error: 'Failed to send confirmation SMS',
        message: confirmationResult.message,
      });
    }

    // Update user metadata with pending SMS consent
    const updatedMetadata = {
      ...(user.metadata as any || {}),
      smsConsent: {
        status: 'pending_confirmation',
        phoneNumber: formattedPhone,
        verificationCode,
        verificationCodeExpiry: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
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
        message: (smsError as any).message,
        code: (smsError as any).code,
        moreInfo: (smsError as any).moreInfo
      });
    }

    console.log(`✅ SMS opt-in successful for user ${user.email} (${formattedPhone})`);

    res.json({
      success: true,
      message: 'Confirmation SMS sent! Please reply with your verification code or "YES" to complete signup.',
      phoneNumber: formattedPhone,
      status: 'pending_confirmation',
    });
  } catch (error) {
    console.error('Error processing SMS opt-in:', error);
    
    if ((error as any).name === 'ZodError') {
      return res.status(400).json({
        error: 'Invalid request data',
        details: (error as any).errors,
      });
    }

    res.status(500).json({
      error: 'Failed to opt in to SMS reminders',
      message: (error as Error).message,
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
      ...(user.metadata as any || {}),
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
      message: (error as Error).message,
    });
  }
});

/**
 * Manual SMS confirmation endpoint (for verification codes)
 */
router.post('/users/sms-confirm', isAuthenticated, async (req, res) => {
  try {
    const { verificationCode } = smsConfirmationSchema.parse(req.body);
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get current user
    const user = await storage.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const metadata = user.metadata as any || {};
    const smsConsent = metadata.smsConsent || {};

    // Check if user has pending confirmation
    if (smsConsent.status !== 'pending_confirmation') {
      return res.status(400).json({ 
        error: 'No pending SMS confirmation found' 
      });
    }

    // Check if verification code matches
    if (smsConsent.verificationCode !== verificationCode) {
      return res.status(400).json({ 
        error: 'Invalid verification code' 
      });
    }

    // Check if verification code has expired
    const expiry = new Date(smsConsent.verificationCodeExpiry);
    if (new Date() > expiry) {
      return res.status(400).json({ 
        error: 'Verification code has expired. Please request a new one.' 
      });
    }

    // Confirm SMS consent
    const updatedMetadata = {
      ...(user.metadata as any || {}),
      smsConsent: {
        ...smsConsent,
        status: 'confirmed',
        enabled: true,
        confirmedAt: new Date().toISOString(),
        verificationCode: undefined, // Remove verification code after confirmation
        verificationCodeExpiry: undefined,
      },
    };

    await storage.updateUser(userId, { metadata: updatedMetadata });

    console.log(`✅ SMS confirmation successful for user ${user.email} (${smsConsent.phoneNumber})`);

    res.json({
      success: true,
      message: 'SMS notifications confirmed! You will now receive weekly reminders.',
      phoneNumber: smsConsent.phoneNumber,
      status: 'confirmed',
    });
  } catch (error) {
    console.error('Error confirming SMS:', error);
    
    if ((error as any).name === 'ZodError') {
      return res.status(400).json({
        error: 'Invalid request data',
        details: (error as any).errors,
      });
    }

    res.status(500).json({
      error: 'Failed to confirm SMS',
      message: (error as Error).message,
    });
  }
});

/**
 * Reset SMS opt-in status (clear pending confirmation)
 */
router.post('/users/sms-reset', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await storage.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const metadata = user.metadata as any || {};
    const smsConsent = metadata.smsConsent || {};

    // Clear SMS consent data
    const updatedMetadata = {
      ...(user.metadata as any || {}),
      smsConsent: {
        enabled: false,
        status: 'not_opted_in',
        phoneNumber: null,
        verificationCode: undefined,
        verificationCodeExpiry: undefined,
        resetAt: new Date().toISOString(),
      },
    };

    await storage.updateUser(userId, { metadata: updatedMetadata });

    console.log(`✅ SMS status reset for user ${user.email}`);

    res.json({
      success: true,
      message: 'SMS opt-in status has been reset. You can now start the opt-in process again.',
    });
  } catch (error) {
    console.error('Error resetting SMS status:', error);
    res.status(500).json({
      error: 'Failed to reset SMS status',
      message: (error as Error).message,
    });
  }
});

/**
 * Resend SMS verification code
 */
router.post('/users/sms-resend', isAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await storage.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const metadata = user.metadata as any || {};
    const smsConsent = metadata.smsConsent || {};

    // Check if there's a pending confirmation
    if (smsConsent.status !== 'pending_confirmation') {
      return res.status(400).json({
        error: 'No pending SMS confirmation to resend',
        currentStatus: smsConsent.status || 'not_opted_in'
      });
    }

    const phoneNumber = smsConsent.phoneNumber;
    if (!phoneNumber) {
      return res.status(400).json({
        error: 'No phone number found for pending confirmation'
      });
    }

    // Generate new verification code
    const verificationCode = generateVerificationCode();

    // Send new confirmation SMS
    const confirmationResult = await sendConfirmationSMS(phoneNumber, verificationCode);

    if (!confirmationResult.success) {
      return res.status(500).json({
        error: 'Failed to resend confirmation SMS',
        message: confirmationResult.message,
      });
    }

    // Update verification code and expiry
    const updatedMetadata = {
      ...(user.metadata as any || {}),
      smsConsent: {
        ...smsConsent,
        verificationCode,
        verificationCodeExpiry: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        lastResendAt: new Date().toISOString(),
      },
    };

    await storage.updateUser(userId, { metadata: updatedMetadata });

    console.log(`✅ Verification code resent to ${phoneNumber} for user ${user.email}`);

    res.json({
      success: true,
      message: 'New verification code sent! Please check your phone.',
      phoneNumber: phoneNumber,
    });
  } catch (error) {
    console.error('Error resending verification code:', error);
    res.status(500).json({
      error: 'Failed to resend verification code',
      message: (error as Error).message,
    });
  }
});

/**
 * Twilio webhook endpoint for incoming SMS messages
 * SECURITY: Validates Twilio request signature to prevent spoofing
 */
router.post('/sms/webhook', async (req, res) => {
  try {
    // SECURITY VALIDATION: Verify Twilio request signature
    const twilioSignature = req.headers['x-twilio-signature'] as string;
    
    if (!twilioSignature) {
      console.warn('⚠️ SECURITY VIOLATION: SMS webhook request missing X-Twilio-Signature header');
      return res.status(403).json({ error: 'Forbidden: Missing signature' });
    }
    
    if (!process.env.TWILIO_AUTH_TOKEN) {
      console.error('❌ SECURITY ERROR: TWILIO_AUTH_TOKEN not configured for webhook validation');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    // Construct the full webhook URL that matches Twilio console configuration
    const protocol = req.secure ? 'https' : 'http';
    const host = req.get('host');
    const webhookUrl = `${protocol}://${host}${req.originalUrl}`;
    
    // Validate the Twilio request signature
    const isValidRequest = Twilio.validateRequest(
      process.env.TWILIO_AUTH_TOKEN,
      twilioSignature,
      webhookUrl,
      req.body
    );
    
    if (!isValidRequest) {
      console.warn(`⚠️ SECURITY VIOLATION: Invalid Twilio signature for webhook request from ${req.ip}`);
      console.warn(`Attempted URL: ${webhookUrl}`);
      console.warn(`Signature: ${twilioSignature}`);
      return res.status(403).json({ error: 'Forbidden: Invalid signature' });
    }
    
    console.log('✅ SECURITY: Twilio webhook signature validated successfully');
    
    const { Body, From } = req.body;
    
    if (!Body || !From) {
      return res.status(400).send('Missing required parameters');
    }

    const messageBody = Body.trim().toUpperCase();
    const phoneNumber = From;

    console.log(`📱 Received SMS from ${phoneNumber}: "${Body}"`);

    // Check if message is "YES" confirmation
    if (messageBody === 'YES') {
      // Find user with this phone number and pending confirmation
      const allUsers = await storage.getAllUsers();
      const userWithPendingConfirmation = allUsers.find((user) => {
        const metadata = user.metadata as any || {};
        const smsConsent = metadata.smsConsent || {};
        return (
          smsConsent.status === 'pending_confirmation' &&
          smsConsent.phoneNumber === phoneNumber
        );
      });

      if (!userWithPendingConfirmation) {
        console.log(`❌ No pending confirmation found for ${phoneNumber}`);
        return res.status(200).send('OK'); // Still return 200 to Twilio
      }

      // Confirm SMS consent via YES reply
      const metadata = userWithPendingConfirmation.metadata as any || {};
      const smsConsent = metadata.smsConsent || {};
      
      const updatedMetadata = {
        ...(userWithPendingConfirmation.metadata as any || {}),
        smsConsent: {
          ...smsConsent,
          status: 'confirmed',
          enabled: true,
          confirmedAt: new Date().toISOString(),
          confirmationMethod: 'sms_reply',
          verificationCode: undefined,
          verificationCodeExpiry: undefined,
        },
      };

      await storage.updateUser(userWithPendingConfirmation.id, { metadata: updatedMetadata });

      console.log(`✅ SMS confirmation via YES reply successful for user ${userWithPendingConfirmation.email} (${phoneNumber})`);
    } 
    // Check if message is a verification code
    else if (/^\d{6}$/.test(messageBody)) {
      // Find user with this phone number and matching verification code
      const allUsers = await storage.getAllUsers();
      const userWithMatchingCode = allUsers.find((user) => {
        const metadata = user.metadata as any || {};
        const smsConsent = metadata.smsConsent || {};
        return (
          smsConsent.status === 'pending_confirmation' &&
          smsConsent.phoneNumber === phoneNumber &&
          smsConsent.verificationCode === messageBody
        );
      });

      if (!userWithMatchingCode) {
        console.log(`❌ No matching verification code found for ${phoneNumber}: ${messageBody}`);
        return res.status(200).send('OK');
      }

      // Check expiry
      const metadata = userWithMatchingCode.metadata as any || {};
      const smsConsent = metadata.smsConsent || {};
      const expiry = new Date(smsConsent.verificationCodeExpiry);
      
      if (new Date() > expiry) {
        console.log(`❌ Verification code expired for ${phoneNumber}`);
        return res.status(200).send('OK');
      }

      // Confirm SMS consent via verification code
      const updatedMetadata = {
        ...(userWithMatchingCode.metadata as any || {}),
        smsConsent: {
          ...smsConsent,
          status: 'confirmed',
          enabled: true,
          confirmedAt: new Date().toISOString(),
          confirmationMethod: 'verification_code',
          verificationCode: undefined,
          verificationCodeExpiry: undefined,
        },
      };

      await storage.updateUser(userWithMatchingCode.id, { metadata: updatedMetadata });

      console.log(`✅ SMS confirmation via verification code successful for user ${userWithMatchingCode.email} (${phoneNumber})`);
    } else {
      console.log(`ℹ️ Unrecognized SMS message from ${phoneNumber}: "${Body}"`);
    }

    // Always respond with 200 OK to Twilio
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing SMS webhook:', error);
    // Always respond with 200 OK to Twilio even on errors
    res.status(200).send('OK');
  }
});

export { router as smsUserRoutes };