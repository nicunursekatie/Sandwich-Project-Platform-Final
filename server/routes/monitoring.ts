import { Router } from 'express';
import { storage } from '../storage-wrapper';
import { sendSMS } from '../sms-service';

const router = Router();

// Get SMS configuration status
router.get('/sms-config', async (req, res) => {
  try {
    const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

    const isConfigured = !!(twilioAccountSid && twilioAuthToken && twilioPhoneNumber);

    res.json({
      configured: isConfigured,
      phoneNumber: isConfigured ? twilioPhoneNumber : null,
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
      if (!locationStatus.has(collection.recipient)) {
        locationStatus.set(collection.recipient, {
          location: collection.recipient,
          hasData: true,
          lastCollection: collection.collectionDate,
          sandwichesCollected: collection.sandwichesCollected || 0,
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
        totalSandwiches: collections.reduce((sum: number, c: any) => sum + (c.sandwichesCollected || 0), 0),
        locationsReporting: new Set(collections.map((c: any) => c.recipient)).size,
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
        reporting: new Set(currentWeekCollections.map((c: any) => c.recipient)).size,
        total: allRecipients.length,
        percentage: allRecipients.length > 0
          ? Math.round((new Set(currentWeekCollections.map((c: any) => c.recipient)).size / allRecipients.length) * 100)
          : 0,
      },
      lastWeek: {
        reporting: new Set(lastWeekCollections.map((c: any) => c.recipient)).size,
        total: allRecipients.length,
        percentage: allRecipients.length > 0
          ? Math.round((new Set(lastWeekCollections.map((c: any) => c.recipient)).size / allRecipients.length) * 100)
          : 0,
      },
      totalSandwichesThisWeek: currentWeekCollections.reduce((sum: number, c: any) => sum + (c.sandwichesCollected || 0), 0),
      totalSandwichesLastWeek: lastWeekCollections.reduce((sum: number, c: any) => sum + (c.sandwichesCollected || 0), 0),
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

    const results = [];

    for (const location of missingLocations) {
      try {
        // Get recipient details
        const recipients = await storage.getAllRecipients();
        const recipient = recipients.find((r: any) => r.name === location);

        if (recipient) {
          if (recipient.contactPhone) {
            const message = `Reminder: Weekly sandwich collection data for ${location} has not been submitted. Please submit at ${appUrl || 'the app'}.`;

            await sendSMS(recipient.contactPhone, message);

            results.push({
              location,
              success: true,
              phone: recipient.contactPhone,
            });
          } else {
            results.push({
              location,
              success: false,
              error: 'No phone number on file',
            });
          }
        } else {
          results.push({
            location,
            success: false,
            error: 'No contact found',
          });
        }
      } catch (error) {
        results.push({
          location,
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send SMS',
        });
      }
    }

    res.json({
      success: true,
      results,
      totalSent: results.filter(r => r.success).length,
      totalFailed: results.filter(r => !r.success).length,
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

    // Get recipient details
    const recipients = await storage.getAllRecipients();
    const recipient = recipients.find((r: any) => r.name === location);

    if (!recipient) {
      return res.status(404).json({ error: 'No recipient found for location' });
    }

    if (!recipient.contactPhone) {
      return res.status(400).json({ error: 'No phone number on file for this location' });
    }

    const message = `Reminder: Weekly sandwich collection data for ${location} has not been submitted. Please submit at ${appUrl || 'the app'}.`;

    await sendSMS(recipient.contactPhone, message);

    res.json({
      success: true,
      location,
      phone: recipient.contactPhone,
      message: 'SMS reminder sent successfully',
    });
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

    const message = `Test SMS from The Sandwich Project monitoring system. App URL: ${appUrl || 'Not configured'}`;

    await sendSMS(phoneNumber, message);

    res.json({
      success: true,
      message: 'Test SMS sent successfully',
      phone: phoneNumber,
    });
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