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

interface TollFreeVerificationResult {
  success: boolean;
  message: string;
  verificationSid?: string;
  status?: string;
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
    // Clean and format phone number
    const cleanPhone = toPhoneNumber.replace(/[^\d+]/g, '');
    const formattedPhone =
      cleanPhone.length === 10 ? `+1${cleanPhone}` : cleanPhone;

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
  verificationCode: string
): Promise<SMSConfirmationResult> {
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
    const confirmationMessage = `Welcome to The Sandwich Project! 🥪\n\nTo complete your SMS signup, please reply with your verification code:\n\n${verificationCode}\n\nOr simply reply "YES" to confirm.\n\nThis confirms you want to receive weekly sandwich collection reminders.`;

    const result = await twilioClient.messages.create({
      body: confirmationMessage,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    console.log(`✅ SMS confirmation sent to ${phoneNumber} (${result.sid})`);

    return {
      success: true,
      message: `Confirmation SMS sent successfully to ${phoneNumber}`,
      verificationCode,
    };
  } catch (error) {
    console.error('Error sending confirmation SMS:', error);
    return {
      success: false,
      message: `Failed to send confirmation SMS: ${(error as Error).message}`,
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

/**
 * Submit toll-free verification request to Twilio
 */
export async function submitTollFreeVerification(): Promise<TollFreeVerificationResult> {
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
    // Submit toll-free verification using REST API directly
    const response = await fetch('https://messaging.twilio.com/v1/Tollfree/Verifications', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        TollfreePhoneNumber: process.env.TWILIO_PHONE_NUMBER,
        BusinessName: 'The Sandwich Project',
        BusinessWebsite: 'https://www.thesandwichproject.org',
        NotificationEmail: 'admin@sandwich.project',
        'UseCaseCategories': 'PUBLIC_SERVICE_ANNOUNCEMENT',
        UseCaseSummary: 'The Sandwich Project is a nonprofit organization that coordinates volunteer-driven sandwich-making events for food insecurity relief. We use SMS to send weekly reminders to volunteers about upcoming sandwich collection submissions and community outreach events.',
        ProductionMessageVolume: '500',
        OptInType: 'WEB_FORM',
        'OptInImageUrls': `${process.env.REPLIT_DOMAIN ? `https://${process.env.REPLIT_DOMAIN}` : 'https://your-app.replit.app'}/profile-notifications-signup.png`,
        MessageSample: 'Reminder: Please submit your sandwich collection data for this week. Visit our app to log your donations. Reply STOP to opt out.',
        BusinessStreetAddress: '123 Main Street',
        BusinessCity: 'Atlanta',
        BusinessStateProvinceRegion: 'GA',
        BusinessPostalCode: '30309',
        BusinessCountry: 'US',
        BusinessContactFirstName: 'Admin',
        BusinessContactLastName: 'User',
        BusinessContactEmail: 'admin@sandwich.project',
        BusinessContactPhone: '+14045551234'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Twilio API error: ${response.status} ${errorText}`);
    }

    const verification = await response.json();
    console.log(`✅ Toll-free verification submitted: ${verification.sid}`);
    
    return {
      success: true,
      message: `Toll-free verification submitted successfully. SID: ${verification.sid}`,
      verificationSid: verification.sid,
      status: verification.status
    };

  } catch (error) {
    console.error('Error submitting toll-free verification:', error);
    return {
      success: false,
      message: `Failed to submit toll-free verification: ${(error as Error).message}`,
    };
  }
}

/**
 * Check status of toll-free verification
 */
export async function checkTollFreeVerificationStatus(verificationSid?: string): Promise<TollFreeVerificationResult> {
  if (!twilioClient) {
    return {
      success: false,
      message: 'SMS service not configured - missing Twilio credentials',
    };
  }

  try {
    if (verificationSid) {
      // Check specific verification using REST API
      const response = await fetch(`https://messaging.twilio.com/v1/Tollfree/Verifications/${verificationSid}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Twilio API error: ${response.status} ${errorText}`);
      }

      const verification = await response.json();
      
      return {
        success: true,
        message: `Verification status: ${verification.status}`,
        verificationSid: verification.sid,
        status: verification.status
      };
    } else {
      // Get all verifications for this account using REST API
      const response = await fetch('https://messaging.twilio.com/v1/Tollfree/Verifications?PageSize=20', {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Twilio API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const verifications = data.verifications || [];
      
      const phoneVerifications = verifications.filter((v: any) => 
        v.tollfree_phone_number === process.env.TWILIO_PHONE_NUMBER
      );

      if (phoneVerifications.length === 0) {
        return {
          success: false,
          message: 'No toll-free verifications found for this phone number',
        };
      }

      const latest = phoneVerifications[0]; // Most recent
      return {
        success: true,
        message: `Latest verification status: ${latest.status}`,
        verificationSid: latest.sid,
        status: latest.status
      };
    }

  } catch (error) {
    console.error('Error checking toll-free verification status:', error);
    return {
      success: false,
      message: `Failed to check verification status: ${(error as Error).message}`,
    };
  }
}
