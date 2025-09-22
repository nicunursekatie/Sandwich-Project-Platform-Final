import { Router } from 'express';
import { isAuthenticated } from '../temp-auth';
import { requirePermission } from '../middleware/auth';
import { sendTestSMS, sendSMSReminder, sendWeeklyReminderSMS, validateSMSConfig } from '../sms-service';
import { z } from 'zod';

const router = Router();

const testSMSSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required'),
  message: z.string().optional(),
});

const reminderSMSSchema = z.object({
  hostLocation: z.string().min(1, 'Host location is required'),
});

/**
 * Get SMS configuration status
 */
router.get('/sms/config', isAuthenticated, requirePermission('USERS_EDIT'), async (req, res) => {
  try {
    const config = validateSMSConfig();
    res.json({
      isConfigured: config.isConfigured,
      missingItems: config.missingItems,
      twilioInitialized: !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN,
    });
  } catch (error) {
    console.error('Error checking SMS configuration:', error);
    res.status(500).json({
      error: 'Failed to check SMS configuration',
      message: error.message,
    });
  }
});

/**
 * Send test SMS
 */
router.post('/sms/test', isAuthenticated, requirePermission('USERS_EDIT'), async (req, res) => {
  try {
    const { phoneNumber, message } = testSMSSchema.parse(req.body);
    const appUrl = process.env.REPLIT_DOMAIN
      ? `https://${process.env.REPLIT_DOMAIN}`
      : req.headers.origin || 'https://your-app.replit.app';

    console.log(`🧪 Sending test SMS to ${phoneNumber} from user ${req.user?.email}`);

    const result = await sendTestSMS(phoneNumber, appUrl);

    if (result.success) {
      console.log(`✅ Test SMS sent successfully to ${phoneNumber}`);
    } else {
      console.error(`❌ Test SMS failed: ${result.message}`);
    }

    res.json(result);
  } catch (error) {
    console.error('Error sending test SMS:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Failed to send test SMS',
      message: error.message,
    });
  }
});

/**
 * Send SMS reminder for a specific host location
 */
router.post('/sms/reminder', isAuthenticated, requirePermission('USERS_EDIT'), async (req, res) => {
  try {
    const { hostLocation } = reminderSMSSchema.parse(req.body);
    const appUrl = process.env.REPLIT_DOMAIN
      ? `https://${process.env.REPLIT_DOMAIN}`
      : req.headers.origin || 'https://your-app.replit.app';

    console.log(`📱 Sending SMS reminder for location "${hostLocation}" from user ${req.user?.email}`);

    const result = await sendSMSReminder(hostLocation, appUrl);

    if (result.success) {
      console.log(`✅ SMS reminder sent for ${hostLocation}: ${result.message}`);
    } else {
      console.error(`❌ SMS reminder failed for ${hostLocation}: ${result.message}`);
    }

    res.json(result);
  } catch (error) {
    console.error('Error sending SMS reminder:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Failed to send SMS reminder',
      message: error.message,
    });
  }
});

/**
 * Send SMS reminders for multiple missing locations
 */
router.post('/sms/weekly-reminders', isAuthenticated, requirePermission('USERS_EDIT'), async (req, res) => {
  try {
    const { missingLocations } = z.object({
      missingLocations: z.array(z.string()).min(1, 'At least one location is required'),
    }).parse(req.body);

    const appUrl = process.env.REPLIT_DOMAIN
      ? `https://${process.env.REPLIT_DOMAIN}`
      : req.headers.origin || 'https://your-app.replit.app';

    console.log(`📱 Sending weekly SMS reminders for ${missingLocations.length} locations from user ${req.user?.email}`);

    const results = await sendWeeklyReminderSMS(missingLocations, appUrl);

    // Count successes and failures
    const locationResults = Object.entries(results);
    const successCount = locationResults.filter(([_, result]) => result.success).length;
    const failureCount = locationResults.length - successCount;

    console.log(`✅ Weekly SMS reminders completed: ${successCount} successes, ${failureCount} failures`);

    res.json({
      success: successCount > 0,
      message: `SMS reminders sent: ${successCount}/${locationResults.length} locations processed`,
      results: results,
      summary: {
        total: locationResults.length,
        successful: successCount,
        failed: failureCount,
      },
    });
  } catch (error) {
    console.error('Error sending weekly SMS reminders:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Failed to send weekly SMS reminders',
      message: error.message,
    });
  }
});

export { router as smsTestingRoutes };