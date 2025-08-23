import { Twilio } from 'twilio';
import { db } from './db';
import { hosts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Initialize Twilio client
let twilioClient: Twilio | null = null;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  twilioClient = new Twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  console.log('✅ Twilio SMS service initialized');
} else {
  console.log('⚠️ Twilio credentials not found - SMS features will be disabled');
}

interface SMSReminderResult {
  success: boolean;
  message: string;
  sentTo?: string;
}

/**
 * Send SMS reminder to a specific host location using opted-in users
 */
export async function sendSMSReminder(
  hostLocation: string,
  appUrl: string = process.env.REPLIT_DOMAIN ? `https://${process.env.REPLIT_DOMAIN}` : 'https://your-app.replit.app'
): Promise<SMSReminderResult> {
  if (!twilioClient) {
    return {
      success: false,
      message: 'SMS service not configured - missing Twilio credentials'
    };
  }

  if (!process.env.TWILIO_PHONE_NUMBER) {
    return {
      success: false,
      message: 'SMS service not configured - missing Twilio phone number'
    };
  }

  try {
    // Import storage to get users who have opted in to SMS
    const { storage } = await import('./storage');
    
    // Get all users who have opted in to SMS
    const allUsers = await storage.getAllUsers();
    const optedInUsers = allUsers.filter(user => {
      const metadata = user.metadata || {};
      const smsConsent = metadata.smsConsent || {};
      return smsConsent.enabled && smsConsent.phoneNumber;
    });

    if (optedInUsers.length === 0) {
      return {
        success: false,
        message: `No users have opted in to SMS reminders yet`
      };
    }

    // Send SMS to each opted-in user
    const results = [];
    for (const user of optedInUsers) {
      try {
        const metadata = user.metadata || {};
        const smsConsent = metadata.smsConsent || {};
        const phoneNumber = smsConsent.phoneNumber;

        const message = `Hi! 🥪 Friendly reminder: The Sandwich Project weekly numbers haven't been submitted yet for ${hostLocation}. Please submit at: ${appUrl} - Thanks for all you do!`;

        const result = await twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: phoneNumber
        });

        results.push({
          user: user.email,
          phone: phoneNumber,
          messageSid: result.sid,
          success: true
        });

        console.log(`✅ SMS sent to ${user.email} (${phoneNumber}) for ${hostLocation}`);
        
      } catch (error) {
        console.error(`❌ Failed to send SMS to ${user.email}:`, error);
        results.push({
          user: user.email,
          phone: user.metadata?.smsConsent?.phoneNumber || 'unknown',
          error: error.message,
          success: false
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    return {
      success: successCount > 0,
      message: `SMS reminders sent: ${successCount}/${totalCount} opted-in users contacted`,
      sentTo: results.filter(r => r.success).map(r => r.user).join(', ')
    };

  } catch (error) {
    console.error('Error sending SMS reminder:', error);
    return {
      success: false,
      message: `Failed to send SMS reminder: ${error.message}`
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
    await new Promise(resolve => setTimeout(resolve, 1000));
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
      message: 'SMS service not configured - missing Twilio credentials'
    };
  }

  if (!process.env.TWILIO_PHONE_NUMBER) {
    return {
      success: false,
      message: 'SMS service not configured - missing Twilio phone number'
    };
  }

  try {
    // Clean and format phone number
    const cleanPhone = toPhoneNumber.replace(/[^\d+]/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `+1${cleanPhone}` : cleanPhone;

    const testMessage = `🧪 Test SMS from The Sandwich Project! This is a test of the SMS reminder system. App link: ${appUrl || 'https://your-app.replit.app'}`;

    const result = await twilioClient.messages.create({
      body: testMessage,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedPhone
    });

    console.log(`✅ Test SMS sent to ${formattedPhone}`);

    return {
      success: true,
      message: `Test SMS sent successfully to ${formattedPhone}`,
      sentTo: formattedPhone
    };

  } catch (error) {
    console.error('Error sending test SMS:', error);
    return {
      success: false,
      message: `Failed to send test SMS: ${error.message}`
    };
  }
}

/**
 * Validate Twilio configuration
 */
export function validateSMSConfig(): { isConfigured: boolean; missingItems: string[] } {
  const missingItems = [];
  
  if (!process.env.TWILIO_ACCOUNT_SID) missingItems.push('TWILIO_ACCOUNT_SID');
  if (!process.env.TWILIO_AUTH_TOKEN) missingItems.push('TWILIO_AUTH_TOKEN');
  if (!process.env.TWILIO_PHONE_NUMBER) missingItems.push('TWILIO_PHONE_NUMBER');

  return {
    isConfigured: missingItems.length === 0,
    missingItems
  };
}