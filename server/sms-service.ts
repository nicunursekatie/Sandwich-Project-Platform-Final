import { SMSProviderFactory } from './sms-providers/provider-factory';
import { SMSProvider } from './sms-providers/types';
import { db } from './db';
import { hosts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Initialize SMS provider
let smsProvider: SMSProvider | null = null;

try {
  const factory = SMSProviderFactory.getInstance();
  smsProvider = factory.getProvider();
  
  if (smsProvider.isConfigured()) {
    console.log(`✅ ${smsProvider.name} SMS service initialized`);
  } else {
    console.log(`⚠️ ${smsProvider.name} SMS service not configured - SMS features will be limited`);
  }
} catch (error) {
  console.log('⚠️ SMS service initialization failed:', (error as Error).message);
  smsProvider = null;
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
  if (!smsProvider) {
    return {
      success: false,
      message: 'SMS service not configured - no provider available',
    };
  }

  if (!smsProvider.isConfigured()) {
    return {
      success: false,
      message: `SMS service not configured - ${smsProvider.name} provider missing configuration`,
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

        const result = await smsProvider.sendSMS({
          to: phoneNumber,
          body: message,
        });

        results.push({
          user: user.email,
          phone: phoneNumber,
          messageSid: result.messageId || 'unknown',
          success: result.success,
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
  if (!smsProvider) {
    return {
      success: false,
      message: 'SMS service not configured - no provider available',
    };
  }

  if (!smsProvider.isConfigured()) {
    return {
      success: false,
      message: `SMS service not configured - ${smsProvider.name} provider missing configuration`,
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

    const result = await smsProvider.sendSMS({
      to: formattedPhone,
      body: testMessage,
    });

    if (result.success) {
      console.log(`✅ Test SMS sent to ${formattedPhone}`);
      return {
        success: true,
        message: `Test SMS sent successfully to ${formattedPhone}`,
        sentTo: formattedPhone,
      };
    } else {
      return {
        success: false,
        message: result.message,
      };
    }
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
 * Get provider-specific welcome message configuration
 */
function getWelcomeMessages(provider: SMSProvider) {
  const providerName = provider.name;
  const fromNumber = provider.getFromNumber();
  
  if (providerName === 'phone_gateway') {
    return {
      confirmation: (verificationCode: string) => 
        `Welcome to The Sandwich Project! 🥪\n\nTo complete SMS signup, reply with this code: ${verificationCode}\n\nOr reply "YES" to confirm.\n\nYou'll get weekly sandwich collection reminders.${fromNumber ? `\n\nFrom: ${fromNumber}` : ''}`,
      
      welcome: () => 
        `Welcome to The Sandwich Project SMS! 🥪\n\nYou'll receive text reminders when weekly sandwich counts are missing.\n\nTo stop messages, reply STOP or visit app settings.${fromNumber ? `\n\nFrom: ${fromNumber}` : ''}`
    };
  } else {
    // Twilio or other providers
    return {
      confirmation: (verificationCode: string) => 
        `Welcome to The Sandwich Project! 🥪\n\nTo complete your SMS signup, please reply with your verification code:\n\n${verificationCode}\n\nOr simply reply "YES" to confirm.\n\nThis confirms you want to receive weekly sandwich collection reminders.`,
      
      welcome: () => 
        `Welcome to The Sandwich Project SMS reminders! 🥪\n\nYou'll receive text reminders when weekly sandwich counts are missing.\n\nTo stop receiving messages, reply STOP at any time or visit the app settings.`
    };
  }
}

/**
 * Send SMS confirmation message with verification code
 */
export async function sendConfirmationSMS(
  phoneNumber: string,
  verificationCode: string
): Promise<SMSConfirmationResult> {
  if (!smsProvider) {
    return {
      success: false,
      message: 'SMS service not configured - no provider available',
    };
  }

  if (!smsProvider.isConfigured()) {
    return {
      success: false,
      message: `SMS service not configured - ${smsProvider.name} provider missing configuration`,
    };
  }

  try {
    const messages = getWelcomeMessages(smsProvider);
    const confirmationMessage = messages.confirmation(verificationCode);

    const result = await smsProvider.sendSMS({
      to: phoneNumber,
      body: confirmationMessage,
    });

    if (result.success) {
      console.log(`✅ SMS confirmation sent via ${smsProvider.name} to ${phoneNumber} (${result.messageId})`);
      return {
        success: true,
        message: `Confirmation SMS sent successfully to ${phoneNumber}`,
        verificationCode,
      };
    } else {
      return {
        success: false,
        message: result.message,
      };
    }
  } catch (error) {
    console.error('Error sending confirmation SMS:', error);
    return {
      success: false,
      message: `Failed to send confirmation SMS: ${(error as Error).message}`,
    };
  }
}

/**
 * Send provider-appropriate welcome SMS
 */
export async function sendWelcomeSMS(
  phoneNumber: string
): Promise<SMSReminderResult> {
  if (!smsProvider) {
    return {
      success: false,
      message: 'SMS service not configured - no provider available',
    };
  }

  if (!smsProvider.isConfigured()) {
    return {
      success: false,
      message: `SMS service not configured - ${smsProvider.name} provider missing configuration`,
    };
  }

  try {
    const messages = getWelcomeMessages(smsProvider);
    const welcomeMessage = messages.welcome();

    const result = await smsProvider.sendSMS({
      to: phoneNumber,
      body: welcomeMessage,
    });

    if (result.success) {
      console.log(`✅ Welcome SMS sent via ${smsProvider.name} to ${phoneNumber} (${result.messageId})`);
      return {
        success: true,
        message: `Welcome SMS sent successfully to ${phoneNumber}`,
        sentTo: phoneNumber,
      };
    } else {
      return {
        success: false,
        message: result.message,
      };
    }
  } catch (error) {
    console.error('Error sending welcome SMS:', error);
    return {
      success: false,
      message: `Failed to send welcome SMS: ${(error as Error).message}`,
    };
  }
}

/**
 * Validate SMS configuration for current provider
 */
export function validateSMSConfig(): {
  isConfigured: boolean;
  missingItems: string[];
  provider?: string;
  providersStatus?: { [key: string]: { configured: boolean; missingItems: string[] } };
} {
  const factory = SMSProviderFactory.getInstance();
  
  try {
    const provider = factory.getProvider();
    const validation = provider.validateConfig();
    const providersStatus = factory.getProvidersStatus();
    
    return {
      isConfigured: validation.isValid,
      missingItems: validation.missingItems,
      provider: provider.name,
      providersStatus,
    };
  } catch (error) {
    return {
      isConfigured: false,
      missingItems: ['PROVIDER_INITIALIZATION_ERROR'],
      provider: 'none',
      providersStatus: factory.getProvidersStatus(),
    };
  }
}

/**
 * Submit toll-free verification request to Twilio
 * Note: This function is Twilio-specific and only works with Twilio provider
 */
export async function submitTollFreeVerification(): Promise<TollFreeVerificationResult> {
  if (!smsProvider || smsProvider.name !== 'twilio') {
    return {
      success: false,
      message: 'Toll-free verification is only available with Twilio provider',
    };
  }

  if (!smsProvider.isConfigured()) {
    return {
      success: false,
      message: 'Twilio SMS service not configured - missing credentials',
    };
  }

  const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!twilioPhoneNumber) {
    return {
      success: false,
      message: 'Twilio phone number not configured',
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
        TollfreePhoneNumber: twilioPhoneNumber,
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
 * Note: This function is Twilio-specific and only works with Twilio provider
 */
export async function checkTollFreeVerificationStatus(verificationSid?: string): Promise<TollFreeVerificationResult> {
  if (!smsProvider || smsProvider.name !== 'twilio') {
    return {
      success: false,
      message: 'Toll-free verification status is only available with Twilio provider',
    };
  }

  if (!smsProvider.isConfigured()) {
    return {
      success: false,
      message: 'Twilio SMS service not configured - missing credentials',
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
      
      const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
      const phoneVerifications = verifications.filter((v: any) => 
        v.tollfree_phone_number === twilioPhoneNumber
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
