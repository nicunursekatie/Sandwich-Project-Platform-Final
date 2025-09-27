import { Router } from 'express';
import { isAuthenticated } from '../temp-auth';
import { storage } from '../storage-wrapper';
import { z } from 'zod';
import { generateVerificationCode, sendConfirmationSMS, submitTollFreeVerification, checkTollFreeVerificationStatus } from '../sms-service';
import twilio from 'twilio';
const { validateRequest } = twilio;
// Note: SMS functionality now uses the provider abstraction from sms-service

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

    // Send provider-appropriate welcome SMS to confirm opt-in
    try {
      const { sendWelcomeSMS } = await import('../sms-service');
      
      // Use the new sendWelcomeSMS function which sends provider-appropriate messages
      const result = await sendWelcomeSMS(formattedPhone);
      
      if (result.success) {
        console.log(`✅ Welcome SMS sent to ${formattedPhone}`);
      } else {
        console.warn(`⚠️ Welcome SMS failed: ${result.message}`);
      }
    } catch (smsError) {
      // Log the error but don't fail the opt-in
      console.error('Failed to send welcome SMS:', smsError);
      console.error('Error details:', {
        message: (smsError as any).message
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
    const isValidRequest = validateRequest(
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

/**
 * Twilio status webhook endpoint for message delivery status
 * This endpoint tracks delivery status of outbound SMS messages
 */
router.post('/users/sms-webhook/status', async (req, res) => {
  try {
    console.log('📱 Received Twilio status webhook:', req.body);

    const { MessageSid, MessageStatus, ErrorCode, To, From } = req.body;

    if (MessageStatus === 'undelivered' || MessageStatus === 'failed') {
      console.error(`❌ SMS delivery failed:`, {
        sid: MessageSid,
        status: MessageStatus,
        errorCode: ErrorCode,
        to: To,
        from: From,
      });

      // Log specific error code details
      if (ErrorCode === '30032') {
        console.error('⚠️ Error 30032: Carrier unreachable. This may be due to:');
        console.error('- The number may be a landline');
        console.error('- Carrier-specific filtering (AT&T/Verizon may block unregistered numbers)');
        console.error('- The number needs to be registered with A2P 10DLC');
        console.error('- Try texting "START" to the Twilio number from the recipient phone first');
      } else if (ErrorCode === '30005') {
        console.error('⚠️ Error 30005: Unknown destination handset');
        console.error('- The phone number format may be incorrect');
        console.error('- The number may not exist or be deactivated');
      } else if (ErrorCode === '30003') {
        console.error('⚠️ Error 30003: Unreachable destination handset');
        console.error('- The phone is likely turned off or out of service area');
      } else if (ErrorCode === '30006') {
        console.error('⚠️ Error 30006: Landline or unreachable carrier');
        console.error('- The number is likely a landline that cannot receive SMS');
      } else if (ErrorCode === '30007') {
        console.error('⚠️ Error 30007: Carrier violation');
        console.error('- Message content was blocked by the carrier');
        console.error('- May need to register for A2P 10DLC');
      } else if (ErrorCode === '30008') {
        console.error('⚠️ Error 30008: Unknown error');
        console.error('- Carrier returned an unknown error');
      }

      // Update user's SMS status if delivery fails with certain error codes
      if (['30032', '30005', '30006'].includes(ErrorCode)) {
        // These errors indicate the number cannot receive SMS
        const allUsers = await storage.getAllUsers();
        const affectedUser = allUsers.find((user) => {
          const metadata = user.metadata as any || {};
          const smsConsent = metadata.smsConsent || {};
          return smsConsent.phoneNumber === To;
        });

        if (affectedUser) {
          const metadata = affectedUser.metadata as any || {};
          const updatedMetadata = {
            ...metadata,
            smsConsent: {
              ...metadata.smsConsent,
              lastDeliveryError: {
                errorCode: ErrorCode,
                errorTime: new Date().toISOString(),
                messageSid: MessageSid,
              },
            },
          };

          await storage.updateUser(affectedUser.id, { metadata: updatedMetadata });
          console.log(`📝 Updated user ${affectedUser.email} with delivery error information`);
        }
      }
    } else if (MessageStatus === 'delivered') {
      console.log(`✅ SMS delivered successfully:`, {
        sid: MessageSid,
        to: To,
      });
    }

    // Always respond with 200 OK to Twilio
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error processing SMS status webhook:', error);
    // Always respond with 200 OK to Twilio even on errors
    res.status(200).send('OK');
  }
});

/**
 * Submit toll-free verification request
 */
router.post('/users/toll-free-verification/submit', isAuthenticated, async (req, res) => {
  try {
    // Only admin users can submit toll-free verification
    const userPermissions = typeof req.user?.permissions === 'number' ? req.user.permissions : 0;
    if (!req.user?.permissions || userPermissions < 80) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const result = await submitTollFreeVerification();

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        verificationSid: result.verificationSid,
        status: result.status
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error submitting toll-free verification:', error);
    res.status(500).json({
      error: 'Failed to submit toll-free verification',
      message: (error as Error).message,
    });
  }
});

/**
 * Check toll-free verification status
 */
router.get('/users/toll-free-verification/status', isAuthenticated, async (req, res) => {
  try {
    // Only admin users can check toll-free verification
    const userPermissions = typeof req.user?.permissions === 'number' ? req.user.permissions : 0;
    if (!req.user?.permissions || userPermissions < 80) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const verificationSid = req.query.verificationSid as string;
    const result = await checkTollFreeVerificationStatus(verificationSid);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        verificationSid: result.verificationSid,
        status: result.status
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error checking toll-free verification status:', error);
    res.status(500).json({
      error: 'Failed to check toll-free verification status',
      message: (error as Error).message,
    });
  }
});

export { router as smsUserRoutes };