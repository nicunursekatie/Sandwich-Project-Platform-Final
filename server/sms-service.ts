import Twilio from 'twilio';
import { db } from './db';
import { hosts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Initialize Twilio client
let twilioClient: ReturnType<typeof Twilio> | null = null;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = Twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  console.log('✅ Twilio SMS service initialized');
} else {
  console.log(
    '⚠️ Twilio credentials not found - SMS features will be disabled'
  );
}

interface SMSReminderResult {
  success: boolean;
  message: string;
  sentTo?: string;
}

interface SMSConfirmationResult {
  success: boolean;
  message: string;
  verificationCode?: string;
}

/**
 * Send SMS reminder to a specific host location using opted-in users
 */
export async function sendSMSReminder(
  hostLocation: string,
  appUrl: string = process.env.REPLIT_DOMAIN
    ? `https://${process.env.REPLIT_DOMAIN}`
    : 'https://your-app.replit.app'
): Promise<SMSReminderResult> {
  if (!twilioClient) {
    return {
      success: false,
      message: 'SMS service not configured - missing Twilio credentials',
    };
  }

  if (!process.env.TWILIO_PHONE_NUMBER) {
    return {
      success: false,
      message: 'SMS service not configured - missing Twilio phone number',
    };
  }

  try {
    // Import storage to get users who have opted in to SMS
    const { storage } = await import('./storage');

    // Get all users who have confirmed SMS opt-in
    const allUsers = await storage.getAllUsers();
    const optedInUsers = allUsers.filter((user) => {
      const metadata = user.metadata as any || {};
      const smsConsent = metadata.smsConsent || {};
      // Only include users with confirmed status and enabled flag
      return (
        smsConsent.status === 'confirmed' &&
        smsConsent.enabled && 
        smsConsent.phoneNumber
      );
    });

    if (optedInUsers.length === 0) {
      return {
        success: false,
        message: `No users have opted in to SMS reminders yet`,
      };
    }

    // Send SMS to each opted-in user
    const results = [];
    for (const user of optedInUsers) {
      try {
        const metadata = user.metadata as any || {};
        const smsConsent = metadata.smsConsent || {};
        const phoneNumber = smsConsent.phoneNumber;

        const message = `Hi! 🥪 Friendly reminder: The Sandwich Project weekly numbers haven't been submitted yet for ${hostLocation}. Please submit at: ${appUrl} - Thanks for all you do!`;

        const result = await twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneNumber,
        });

        results.push({
          user: user.email,
          phone: phoneNumber,
          messageSid: result.sid,
          success: true,
        });

        console.log(
          `✅ SMS sent to ${user.email} (${phoneNumber}) for ${hostLocation}`
        );
      } catch (error) {
        console.error(`❌ Failed to send SMS to ${user.email}:`, error);
        results.push({
          user: user.email,
          phone: (user.metadata as any)?.smsConsent?.phoneNumber || 'unknown',
          error: (error as Error).message,
          success: false,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const totalCount = results.length;

    return {
      success: successCount > 0,
      message: `SMS reminders sent: ${successCount}/${totalCount} opted-in users contacted`,
      sentTo: results
        .filter((r) => r.success)
        .map((r) => r.user)
        .join(', '),
    };
  } catch (error) {
    console.error('Error sending SMS reminder:', error);
    return {
      success: false,
      message: `Failed to send SMS reminder: ${(error as Error).message}`,
    };
  }
}

/**
 * Send SMS reminders to all missing locations from weekly monitoring
 */
export async function sendWeeklyReminderSMS(
  missingLocations: string[],
  appUrl?: string
): Promise<{ [location: string]: SMSReminderResult }> {
  const results: { [location: string]: SMSReminderResult } = {};

  for (const location of missingLocations) {
    results[location] = await sendSMSReminder(location, appUrl);

    // Add small delay between SMS sends to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return results;
}

/**
 * Test SMS functionality
 */
export async function sendTestSMS(
  toPhoneNumber: string,
  appUrl?: string
): Promise<SMSReminderResult> {
  if (!twilioClient) {
    return {
      success: false,
      message: 'SMS service not configured - missing Twilio credentials',
    };
  }

  if (!process.env.TWILIO_PHONE_NUMBER) {
    return {
      success: false,
      message: 'SMS service not configured - missing Twilio phone number',
    };
  }

  try {
    // Clean and format phone number with improved handling for AT&T
    let formattedPhone = toPhoneNumber.replace(/[^\d+]/g, '');

    // Ensure proper E.164 format for US numbers
    if (formattedPhone.startsWith('1') && formattedPhone.length === 11) {
      formattedPhone = `+${formattedPhone}`;
    } else if (formattedPhone.length === 10) {
      formattedPhone = `+1${formattedPhone}`;
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = `+${formattedPhone}`;
    }

    console.log(`📱 Formatting phone number: ${toPhoneNumber} -> ${formattedPhone}`);

    const testMessage = `🧪 Test SMS from The Sandwich Project! This is a test of the SMS reminder system. App link: ${
      appUrl || 'https://your-app.replit.app'
    }`;

    const result = await twilioClient.messages.create({
      body: testMessage,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone,
    });

    console.log(`✅ Test SMS sent to ${formattedPhone}`);

    return {
      success: true,
      message: `Test SMS sent successfully to ${formattedPhone}`,
      sentTo: formattedPhone,
    };
  } catch (error) {
    console.error('Error sending test SMS:', error);
    return {
      success: false,
      message: `Failed to send test SMS: ${(error as Error).message}`,
    };
  }
}

/**
 * Generate secure verification code for SMS confirmation
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send SMS confirmation message with verification code
 */
export async function sendConfirmationSMS(
  phoneNumber: string,
  verificationCode: string,
  retryCount: number = 0
): Promise<SMSConfirmationResult> {
  console.log('📱 Attempting to send confirmation SMS...');
  console.log('Phone number:', phoneNumber);
  console.log('Verification code:', verificationCode);
  console.log('Retry attempt:', retryCount);
  console.log('Twilio configured:', !!twilioClient);
  console.log('Twilio phone:', process.env.TWILIO_PHONE_NUMBER);

  if (!twilioClient) {
    console.error('❌ Twilio client not initialized');
    return {
      success: false,
      message: 'SMS service not configured - missing Twilio credentials',
    };
  }

  if (!process.env.TWILIO_PHONE_NUMBER) {
    console.error('❌ TWILIO_PHONE_NUMBER not set');
    return {
      success: false,
      message: 'SMS service not configured - missing Twilio phone number',
    };
  }

  try {
    // Format phone number with improved AT&T compatibility
    let formattedPhone = phoneNumber.replace(/[^\d+]/g, '');
    if (formattedPhone.startsWith('1') && formattedPhone.length === 11) {
      formattedPhone = `+${formattedPhone}`;
    } else if (formattedPhone.length === 10) {
      formattedPhone = `+1${formattedPhone}`;
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = `+${formattedPhone}`;
    }

    console.log(`📱 Phone number formatting: ${phoneNumber} -> ${formattedPhone}`);

    // Simplified message to avoid carrier filtering
    const confirmationMessage = `Sandwich Project: Your verification code is ${verificationCode}. Reply with this code or YES to confirm weekly reminders.`;

    console.log('📤 Sending SMS via Twilio...');
    console.log('Message length:', confirmationMessage.length, 'characters');

    const result = await twilioClient.messages.create({
      body: confirmationMessage,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone,
      // Add status callback to track delivery
      statusCallback: process.env.REPLIT_DOMAIN
        ? `https://${process.env.REPLIT_DOMAIN}/api/users/sms-webhook/status`
        : undefined,
    });

    console.log(`✅ SMS confirmation sent to ${phoneNumber} (${result.sid})`);
    console.log('Message status:', result.status);
    console.log('Message price:', result.price);

    return {
      success: true,
      message: `Confirmation SMS sent successfully to ${phoneNumber}`,
      verificationCode,
    };
  } catch (error: any) {
    console.error('❌ Error sending confirmation SMS:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('More info:', error.moreInfo);

    // Check for specific Twilio error codes
    if (error.code === 21211) {
      return {
        success: false,
        message: `Invalid phone number format: ${phoneNumber}. Please use format: +1XXXXXXXXXX`,
      };
    } else if (error.code === 21608) {
      return {
        success: false,
        message: `The phone number ${phoneNumber} is not verified with your Twilio trial account. Add it as a verified number in Twilio console.`,
      };
    } else if (error.code === 21610) {
      return {
        success: false,
        message: `The phone number ${phoneNumber} has opted out of receiving messages. Reply START to opt back in.`,
      };
    } else if (error.code === 30032 || error.code === 30005) {
      // Error 30032: Unknown destination handset (carrier issue)
      // Error 30005: Unknown destination handset (number unreachable)
      console.log(`⚠️ Carrier delivery issue (${error.code}), attempting retry...`);

      if (retryCount < 2) {
        // Wait before retry (exponential backoff)
        const delay = (retryCount + 1) * 2000;
        console.log(`⏱️ Waiting ${delay}ms before retry ${retryCount + 1}...`);
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry with incremented count
        return sendConfirmationSMS(phoneNumber, verificationCode, retryCount + 1);
      }

      return {
        success: false,
        message: `Unable to deliver SMS to ${phoneNumber}. This may be due to carrier restrictions. Please ensure the number can receive SMS messages and try again.`,
      };
    }

    return {
      success: false,
      message: `Failed to send SMS: ${error.message}`,
    };
  }
}

/**
 * Validate Twilio configuration
 */
export function validateSMSConfig(): {
  isConfigured: boolean;
  missingItems: string[];
} {
  const missingItems = [];

  if (!process.env.TWILIO_ACCOUNT_SID) missingItems.push('TWILIO_ACCOUNT_SID');
  if (!process.env.TWILIO_AUTH_TOKEN) missingItems.push('TWILIO_AUTH_TOKEN');
  if (!process.env.TWILIO_PHONE_NUMBER)
    missingItems.push('TWILIO_PHONE_NUMBER');

  return {
    isConfigured: missingItems.length === 0,
    missingItems,
  };
}
