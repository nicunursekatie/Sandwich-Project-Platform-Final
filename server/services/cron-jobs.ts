/**
 * Cron Jobs Service
 *
 * Manages scheduled background tasks for the application.
 */

import cron from 'node-cron';
import { scrapeHostAvailability } from './host-availability-scraper';
import { createServiceLogger, logError } from '../utils/logger';
import { db } from '../db';
import { eventVolunteers, eventRequests, users } from '@shared/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { EmailNotificationService } from './email-notification-service';

const cronLogger = createServiceLogger('cron');

/**
 * Send 24-hour reminder emails to volunteers for upcoming events
 */
async function sendVolunteerReminders(): Promise<{
  remindersSent: number;
  volunteersProcessed: number;
  errors: number;
  timestamp: Date;
}> {
  const now = new Date();
  const twentyEightHoursFromNow = new Date(now.getTime() + 28 * 60 * 60 * 1000);
  const twentyHoursFromNow = new Date(now.getTime() + 20 * 60 * 60 * 1000);

  let remindersSent = 0;
  let volunteersProcessed = 0;
  let errors = 0;

  try {
    // Find events happening in the next 20-28 hours (8-hour window to catch all events)
    // This ensures events scheduled for any time tomorrow will get a reminder
    const upcomingEvents = await db
      .select()
      .from(eventRequests)
      .where(
        and(
          sql`${eventRequests.scheduledEventDate} >= ${twentyHoursFromNow}`,
          sql`${eventRequests.scheduledEventDate} <= ${twentyEightHoursFromNow}`
        )
      );

    cronLogger.info(`Found ${upcomingEvents.length} events in the next 24 hours`);

    // For each event, find volunteers who haven't received reminders yet
    for (const event of upcomingEvents) {
      const volunteers = await db
        .select()
        .from(eventVolunteers)
        .where(
          and(
            eq(eventVolunteers.eventRequestId, event.id),
            isNull(eventVolunteers.reminderSentAt)
          )
        );

      volunteersProcessed += volunteers.length;

      for (const volunteer of volunteers) {
        try {
          // Determine email and name
          let volunteerEmail = volunteer.volunteerEmail;
          let volunteerName = volunteer.volunteerName || 'Volunteer';

          // If they're a registered user, get their info from the users table
          if (volunteer.volunteerUserId) {
            const [user] = await db
              .select()
              .from(users)
              .where(eq(users.id, volunteer.volunteerUserId))
              .limit(1);

            if (user) {
              volunteerEmail = user.preferredEmail || user.email || volunteerEmail;
              volunteerName = user.displayName || user.firstName || volunteerName;
            }
          }

          // Skip if no email available
          if (!volunteerEmail) {
            cronLogger.warn(`No email for volunteer ${volunteer.id}, skipping reminder`);
            continue;
          }

          // Send the reminder email
          const sent = await EmailNotificationService.sendVolunteerReminderNotification(
            volunteerEmail,
            volunteerName,
            event.id,
            event.organizationName || 'Unknown Organization',
            event.scheduledEventDate || new Date(),
            volunteer.role
          );

          if (sent) {
            // Update the reminder_sent_at timestamp
            await db
              .update(eventVolunteers)
              .set({ reminderSentAt: new Date() })
              .where(eq(eventVolunteers.id, volunteer.id));

            remindersSent++;
            cronLogger.info(`Sent reminder to ${volunteerEmail} for event ${event.id}`);
          } else {
            errors++;
            cronLogger.error(`Failed to send reminder to ${volunteerEmail} for event ${event.id}`);
          }
        } catch (error) {
          errors++;
          cronLogger.error(`Error sending reminder for volunteer ${volunteer.id}:`, error);
        }
      }
    }
  } catch (error) {
    cronLogger.error('Error in sendVolunteerReminders:', error);
    throw error;
  }

  return {
    remindersSent,
    volunteersProcessed,
    errors,
    timestamp: now,
  };
}

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs() {
  cronLogger.info('Initializing scheduled jobs...');

  // Host availability scraper - runs every Monday at 1:00 PM
  // Cron format: minute hour day-of-month month day-of-week
  // '0 13 * * 1' = At 13:00 (1 PM) on Monday
  const hostScraperJob = cron.schedule('0 13 * * 1', async () => {
    cronLogger.info('Running weekly host availability scraper...');
    try {
      const result = await scrapeHostAvailability();
      if (result.success) {
        cronLogger.info('Host availability scrape completed successfully', {
          matchedContacts: result.matchedContacts,
          unmatchedContacts: result.unmatchedContacts,
          scrapedHostsCount: result.scrapedHosts.length,
          timestamp: result.timestamp,
        });
      } else {
        cronLogger.error('Host availability scrape failed', {
          error: result.error,
          timestamp: result.timestamp,
        });
      }
    } catch (error) {
      logError(
        error as Error,
        'Error running host availability scraper in cron job',
        undefined,
        { jobType: 'host-availability-scraper' }
      );
    }
  }, {
    scheduled: true,
    timezone: 'America/New_York' // Adjust timezone as needed
  });

  cronLogger.info('Host availability scraper scheduled successfully', {
    schedule: 'Mondays at 1:00 PM',
    timezone: 'America/New_York',
  });

  // Volunteer reminder job - runs twice daily at 9 AM and 3 PM
  // Cron format: minute hour day-of-month month day-of-week
  // '0 9,15 * * *' = At 9:00 AM and 3:00 PM every day
  const volunteerReminderJob = cron.schedule('0 9,15 * * *', async () => {
    cronLogger.info('Running 24-hour volunteer reminder check...');
    try {
      const result = await sendVolunteerReminders();
      cronLogger.info('Volunteer reminder check completed', {
        remindersSent: result.remindersSent,
        volunteersProcessed: result.volunteersProcessed,
        errors: result.errors,
        timestamp: result.timestamp,
      });
    } catch (error) {
      logError(
        error as Error,
        'Error running volunteer reminder cron job',
        undefined,
        { jobType: 'volunteer-reminder' }
      );
    }
  }, {
    scheduled: true,
    timezone: 'America/New_York'
  });

  cronLogger.info('Volunteer reminder job scheduled successfully', {
    schedule: 'Twice daily at 9 AM and 3 PM',
    timezone: 'America/New_York',
  });

  // Return job references in case we need to manage them later
  return {
    hostScraperJob,
    volunteerReminderJob,
  };
}

/**
 * Stop all cron jobs (useful for graceful shutdown)
 */
export function stopAllCronJobs(jobs: ReturnType<typeof initializeCronJobs>) {
  cronLogger.info('Stopping all scheduled jobs...');
  jobs.hostScraperJob.stop();
  jobs.volunteerReminderJob.stop();
  cronLogger.info('All cron jobs stopped successfully');
}
