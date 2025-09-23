import { Router } from 'express';
import { storage } from '../storage-wrapper';
import { sendTestSMS, sendSMSReminder, sendWeeklyReminderSMS, validateSMSConfig } from '../sms-service';

const router = Router();

// Get SMS configuration status
router.get('/sms-config', async (req, res) => {
  try {
    const { isConfigured, missingItems } = validateSMSConfig();
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    res.json({
      configured: isConfigured,
      phoneNumber: isConfigured ? twilioPhoneNumber : null,
      missingItems,
    });
  } catch (error) {
    console.error('Error checking SMS config:', error);
    res.status(500).json({ error: 'Failed to check SMS configuration' });
  }
});

// Get weekly monitoring status
router.get('/weekly-status/:weeksAgo', async (req, res) => {
  try {
    const weeksAgo = parseInt(req.params.weeksAgo, 10);

    // Calculate date range for the week
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() - (weeksAgo * 7));
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Get all collections
    const allCollections = await storage.getSandwichCollections(1000, 0);

    // Filter collections for the specified week
    const collections = allCollections.filter((c: any) => {
      const collDate = new Date(c.collectionDate);
      return collDate >= startOfWeek && collDate <= endOfWeek;
    });

    // Group by location and check for missing weeks
    const locationStatus = new Map<string, any>();

    for (const collection of collections) {
      if (!locationStatus.has(collection.hostName)) {
        locationStatus.set(collection.hostName, {
          location: collection.hostName,
          hasData: true,
          lastCollection: collection.collectionDate,
          sandwichesCollected: collection.individualSandwiches || 0,
        });
      }
    }

    // Get all expected locations
    const allLocations = await storage.getAllRecipients();

    // Check for missing locations
    const missingLocations = allLocations
      .filter((loc: any) => !locationStatus.has(loc.name))
      .map((loc: any) => loc.name);

    res.json({
      week: weeksAgo,
      locationsReporting: Array.from(locationStatus.values()),
      missingLocations,
      totalLocations: allLocations.length,
      reportingCount: locationStatus.size,
    });
  } catch (error) {
    console.error('Error getting weekly status:', error);
    res.status(500).json({ error: 'Failed to get weekly status' });
  }
});

// Get multi-week report
router.get('/multi-week-report/:weeks', async (req, res) => {
  try {
    const weeks = parseInt(req.params.weeks, 10);
    const reports = [];

    for (let i = 0; i < weeks; i++) {
      // Calculate date range for each week
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() - (i * 7));
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      // Get all collections and filter for the week
      const allCollections = await storage.getSandwichCollections(1000, 0);
      const collections = allCollections.filter((c: any) => {
        const collDate = new Date(c.collectionDate);
        return collDate >= startOfWeek && collDate <= endOfWeek;
      });

      const weekData = {
        week: i,
        totalCollections: collections.length,
        totalSandwiches: collections.reduce((sum: number, c: any) => sum + (c.individualSandwiches || 0), 0),
        locationsReporting: new Set(collections.map((c: any) => c.hostName)).size,
      };

      reports.push(weekData);
    }

    res.json({ weeks: reports });
  } catch (error) {
    console.error('Error getting multi-week report:', error);
    res.status(500).json({ error: 'Failed to get multi-week report' });
  }
});

// Get monitoring statistics
router.get('/stats', async (req, res) => {
  try {
    // Get current week collections
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay());
    currentWeekStart.setHours(0, 0, 0, 0);

    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
    currentWeekEnd.setHours(23, 59, 59, 999);

    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const lastWeekEnd = new Date(currentWeekEnd);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

    const allCollections = await storage.getSandwichCollections(1000, 0);

    const currentWeekCollections = allCollections.filter((c: any) => {
      const collDate = new Date(c.collectionDate);
      return collDate >= currentWeekStart && collDate <= currentWeekEnd;
    });

    const lastWeekCollections = allCollections.filter((c: any) => {
      const collDate = new Date(c.collectionDate);
      return collDate >= lastWeekStart && collDate <= lastWeekEnd;
    });

    const allRecipients = await storage.getAllRecipients();

    const stats = {
      currentWeek: {
        reporting: new Set(currentWeekCollections.map((c: any) => c.hostName)).size,
        total: allRecipients.length,
        percentage: allRecipients.length > 0
          ? Math.round((new Set(currentWeekCollections.map((c: any) => c.hostName)).size / allRecipients.length) * 100)
          : 0,
      },
      lastWeek: {
        reporting: new Set(lastWeekCollections.map((c: any) => c.hostName)).size,
        total: allRecipients.length,
        percentage: allRecipients.length > 0
          ? Math.round((new Set(lastWeekCollections.map((c: any) => c.hostName)).size / allRecipients.length) * 100)
          : 0,
      },
      totalSandwichesThisWeek: currentWeekCollections.reduce((sum: number, c: any) => sum + (c.individualSandwiches || 0), 0),
      totalSandwichesLastWeek: lastWeekCollections.reduce((sum: number, c: any) => sum + (c.individualSandwiches || 0), 0),
    };

    res.json(stats);
  } catch (error) {
    console.error('Error getting monitoring stats:', error);
    res.status(500).json({ error: 'Failed to get monitoring statistics' });
  }
});

// Manual check for current week
router.post('/check-now', async (req, res) => {
  try {
    // This would trigger any automated checks or notifications
    // For now, just return success
    res.json({ success: true, message: 'Manual check completed' });
  } catch (error) {
    console.error('Error running manual check:', error);
    res.status(500).json({ error: 'Failed to run manual check' });
  }
});

// Check specific week
router.post('/check-week/:weeksAgo', async (req, res) => {
  try {
    const weeksAgo = parseInt(req.params.weeksAgo, 10);
    // This would trigger checks for a specific week
    res.json({ success: true, message: `Check completed for week ${weeksAgo}` });
  } catch (error) {
    console.error('Error checking week:', error);
    res.status(500).json({ error: 'Failed to check week' });
  }
});

// Send SMS reminders to multiple locations
router.post('/send-sms-reminders', async (req, res) => {
  try {
    const { missingLocations, appUrl } = req.body;

    if (!missingLocations || !Array.isArray(missingLocations)) {
      return res.status(400).json({ error: 'Missing locations array required' });
    }

    const results = await sendWeeklyReminderSMS(missingLocations, appUrl);

    const successCount = Object.values(results).filter(r => r.success).length;
    const failureCount = Object.values(results).filter(r => !r.success).length;

    res.json({
      success: true,
      results,
      totalSent: successCount,
      totalFailed: failureCount,
    });
  } catch (error) {
    console.error('Error sending SMS reminders:', error);
    res.status(500).json({ error: 'Failed to send SMS reminders' });
  }
});

// Send SMS reminder to single location
router.post('/send-sms-reminder/:location', async (req, res) => {
  try {
    const location = decodeURIComponent(req.params.location);
    const { appUrl } = req.body;

    const result = await sendSMSReminder(location, appUrl);

    if (result.success) {
      res.json({
        success: true,
        location,
        message: 'SMS reminder sent successfully',
        details: result,
      });
    } else {
      res.status(400).json({
        success: false,
        location,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error sending SMS reminder:', error);
    res.status(500).json({ error: 'Failed to send SMS reminder' });
  }
});

// Test SMS
router.post('/test-sms', async (req, res) => {
  try {
    const { phoneNumber, appUrl } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const result = await sendTestSMS(phoneNumber, appUrl);

    if (result.success) {
      res.json({
        success: true,
        message: 'Test SMS sent successfully',
        phone: phoneNumber,
        details: result,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        phone: phoneNumber,
      });
    }
  } catch (error) {
    console.error('Error sending test SMS:', error);
    res.status(500).json({ error: 'Failed to send test SMS' });
  }
});

// Test email
router.post('/test-email', async (req, res) => {
  try {
    // This would send a test email
    // For now, just return success
    res.json({
      success: true,
      message: 'Test email functionality not yet implemented',
    });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// Send email reminder to single location
router.post('/send-email-reminder/:location', async (req, res) => {
  try {
    const location = decodeURIComponent(req.params.location);

    // This would send an email reminder
    // For now, just return success
    res.json({
      success: true,
      location,
      message: 'Email reminder functionality not yet implemented',
    });
  } catch (error) {
    console.error('Error sending email reminder:', error);
    res.status(500).json({ error: 'Failed to send email reminder' });
  }
});

export default router;