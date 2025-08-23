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
 * Send SMS reminder to a specific host location
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
    // Find hosts for this location who have phone numbers
    const hostContacts = await db
      .select({
        id: hosts.id,
        name: hosts.name,
        phone: hosts.phone,
        email: hosts.email
      })
      .from(hosts)
      .where(
        and(
          eq(hosts.status, 'active'),
          // Match location name variations
          // This is a simple approach - you might want to make this more sophisticated
        )
      );

    // Filter hosts that match the location and have phone numbers
    const matchingHosts = hostContacts.filter(host => {
      if (!host.phone) return false;
      
      // Simple matching logic - improve this based on your host location naming
      const hostName = host.name.toLowerCase();
      const location = hostLocation.toLowerCase();
      
      return hostName.includes(location.split('/')[0].toLowerCase()) ||
             location.includes(hostName) ||
             hostName.includes(location);
    });

    if (matchingHosts.length === 0) {
      return {
        success: false,
        message: `No hosts found with phone numbers for location: ${hostLocation}`
      };
    }

    // Send SMS to each matching host
    const results = [];
    for (const host of matchingHosts) {
      try {
        // Clean phone number (remove any non-digits except +)
        const cleanPhone = host.phone.replace(/[^\d+]/g, '');
        
        // Add +1 if it's a 10-digit US number
        const formattedPhone = cleanPhone.length === 10 ? `+1${cleanPhone}` : cleanPhone;

        const message = `Hi ${host.name}! 🥪 Friendly reminder: The Sandwich Project weekly numbers haven't been submitted yet for ${hostLocation}. Please submit at: ${appUrl} - Thanks for all you do!`;

        const result = await twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: formattedPhone
        });

        results.push({
          host: host.name,
          phone: formattedPhone,
          messageSid: result.sid,
          success: true
        });

        console.log(`✅ SMS sent to ${host.name} (${formattedPhone}) for ${hostLocation}`);
        
      } catch (error) {
        console.error(`❌ Failed to send SMS to ${host.name}:`, error);
        results.push({
          host: host.name,
          phone: host.phone,
          error: error.message,
          success: false
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    return {
      success: successCount > 0,
      message: `SMS reminders sent: ${successCount}/${totalCount} successful`,
      sentTo: results.filter(r => r.success).map(r => r.host).join(', ')
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