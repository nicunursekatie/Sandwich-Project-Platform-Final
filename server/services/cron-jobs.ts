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
import { and, eq, isNull, sql, or } from 'drizzle-orm';
import { EmailNotificationService } from './email-notification-service';
import { sendEventReminderSMS } from '../sms-service';
import { getEventNotificationPreferences, getUserMetadata, getUserPhoneNumber } from '@shared/types';
import type { EventNotificationPreferences } from '@shared/types';

const cronLogger = createServiceLogger('cron');

/**
 * Send customizable reminder notifications to volunteers and TSP contacts for upcoming events
 * Supports primary/secondary reminders via email/SMS based on user preferences
 */
async function sendVolunteerReminders(): Promise<{
  remindersSent: number;
  volunteersProcessed: number;
  errors: number;
  timestamp: Date;
}> {
  const now = new Date();
  let remindersSent = 0;
  let volunteersProcessed = 0;
  let errors = 0;

  try {
    // Get events happening in the next 48 hours (broad window)
    const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const upcomingEvents = await db
      .select()
      .from(eventRequests)
      .where(
        and(
          sql`${eventRequests.scheduledEventDate} >= ${now}`,
          sql`${eventRequests.scheduledEventDate} <= ${fortyEightHoursFromNow}`,
          eq(eventRequests.status, 'scheduled')
        )
      );

    cronLogger.info(`Found ${upcomingEvents.length} scheduled events in the next 48 hours`);

    for (const event of upcomingEvents) {
      if (!event.scheduledEventDate) continue;

      const hoursUntilEvent = (event.scheduledEventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      // Get all volunteers for this event
      const volunteers = await db
        .select()
        .from(eventVolunteers)
        .where(eq(eventVolunteers.eventRequestId, event.id));

      // Process volunteer reminders
      for (const volunteer of volunteers) {
        volunteersProcessed++;
        
        try {
          let user = null;
          let volunteerEmail = volunteer.volunteerEmail;
          let volunteerName = volunteer.volunteerName || 'Volunteer';
          let volunteerPhone: string | null = volunteer.volunteerPhone;
          let preferences: EventNotificationPreferences | null = null;

          // Get user info and preferences for registered users
          if (volunteer.volunteerUserId) {
            const [foundUser] = await db
              .select()
              .from(users)
              .where(eq(users.id, volunteer.volunteerUserId))
              .limit(1);

            if (foundUser) {
              user = foundUser;
              volunteerEmail = foundUser.preferredEmail || foundUser.email || volunteerEmail;
              volunteerName = foundUser.displayName || foundUser.firstName || volunteerName;
              volunteerPhone = getUserPhoneNumber(foundUser);
              preferences = getEventNotificationPreferences(foundUser);
            }
          }

          // Use default preferences if user doesn't have custom settings
          if (!preferences) {
            preferences = {
              primaryReminderEnabled: true,
              primaryReminderHours: 24,
              primaryReminderType: 'email',
              secondaryReminderEnabled: false,
              secondaryReminderHours: 1,
              secondaryReminderType: 'email',
            };
          }

          // Check primary reminder (2-hour window for safety)
          if (
            preferences.primaryReminderEnabled &&
            hoursUntilEvent >= (preferences.primaryReminderHours - 1) &&
            hoursUntilEvent <= (preferences.primaryReminderHours + 1)
          ) {
            // Send email reminder if needed
            if (
              (preferences.primaryReminderType === 'email' || preferences.primaryReminderType === 'both') &&
              !volunteer.emailReminder1SentAt &&
              volunteerEmail
            ) {
              const emailSent = await EmailNotificationService.sendVolunteerReminderNotification(
                volunteerEmail,
                volunteerName,
                event.id,
                event.organizationName || 'Unknown Organization',
                event.scheduledEventDate,
                volunteer.role
              );

              if (emailSent) {
                await db
                  .update(eventVolunteers)
                  .set({ emailReminder1SentAt: new Date() })
                  .where(eq(eventVolunteers.id, volunteer.id));
                
                remindersSent++;
                cronLogger.info(`Sent primary email reminder to ${volunteerEmail} for event ${event.id}`);
              }
            }

            // Send SMS reminder if needed
            if (
              (preferences.primaryReminderType === 'sms' || preferences.primaryReminderType === 'both') &&
              !volunteer.smsReminder1SentAt &&
              volunteerPhone
            ) {
              const appUrl = process.env.REPL_URL || 'https://app.thesandwichproject.org';
              const smsSent = await sendEventReminderSMS(
                volunteerPhone,
                volunteerName,
                event.organizationName || 'Unknown Organization',
                event.scheduledEventDate,
                volunteer.role,
                `${appUrl}/dashboard?section=event-requests`
              );

              if (smsSent.success) {
                await db
                  .update(eventVolunteers)
                  .set({ smsReminder1SentAt: new Date() })
                  .where(eq(eventVolunteers.id, volunteer.id));
                
                remindersSent++;
                cronLogger.info(`Sent primary SMS reminder to ${volunteerPhone} for event ${event.id}`);
              }
            }
          }

          // Check secondary reminder (2-hour window for safety)
          if (
            preferences.secondaryReminderEnabled &&
            hoursUntilEvent >= (preferences.secondaryReminderHours - 1) &&
            hoursUntilEvent <= (preferences.secondaryReminderHours + 1)
          ) {
            // Send email reminder if needed
            if (
              (preferences.secondaryReminderType === 'email' || preferences.secondaryReminderType === 'both') &&
              !volunteer.emailReminder2SentAt &&
              volunteerEmail
            ) {
              const emailSent = await EmailNotificationService.sendVolunteerReminderNotification(
                volunteerEmail,
                volunteerName,
                event.id,
                event.organizationName || 'Unknown Organization',
                event.scheduledEventDate,
                volunteer.role
              );

              if (emailSent) {
                await db
                  .update(eventVolunteers)
                  .set({ emailReminder2SentAt: new Date() })
                  .where(eq(eventVolunteers.id, volunteer.id));
                
                remindersSent++;
                cronLogger.info(`Sent secondary email reminder to ${volunteerEmail} for event ${event.id}`);
              }
            }

            // Send SMS reminder if needed
            if (
              (preferences.secondaryReminderType === 'sms' || preferences.secondaryReminderType === 'both') &&
              !volunteer.smsReminder2SentAt &&
              volunteerPhone
            ) {
              const appUrl = process.env.REPL_URL || 'https://app.thesandwichproject.org';
              const smsSent = await sendEventReminderSMS(
                volunteerPhone,
                volunteerName,
                event.organizationName || 'Unknown Organization',
                event.scheduledEventDate,
                volunteer.role,
                `${appUrl}/dashboard?section=event-requests`
              );

              if (smsSent.success) {
                await db
                  .update(eventVolunteers)
                  .set({ smsReminder2SentAt: new Date() })
                  .where(eq(eventVolunteers.id, volunteer.id));
                
                remindersSent++;
                cronLogger.info(`Sent secondary SMS reminder to ${volunteerPhone} for event ${event.id}`);
              }
            }
          }
        } catch (error) {
          errors++;
          cronLogger.error(`Error sending reminder for volunteer ${volunteer.id}:`, error);
        }
      }

      // Process TSP contact reminders
      try {
        const tspContactIds: string[] = [];
        
        if (event.tspContact) tspContactIds.push(event.tspContact);
        if (event.tspContactAssigned) tspContactIds.push(event.tspContactAssigned);
        
        // Parse additional TSP contacts
        if (event.additionalTspContacts) {
          try {
            const additional = typeof event.additionalTspContacts === 'string' 
              ? JSON.parse(event.additionalTspContacts) 
              : event.additionalTspContacts;
            
            if (Array.isArray(additional)) {
              tspContactIds.push(...additional);
            }
          } catch (e) {
            // If parsing fails, skip additional contacts
          }
        }

        // Send reminders to unique TSP contacts
        const uniqueContactIds = [...new Set(tspContactIds)];
        for (const contactId of uniqueContactIds) {
          try {
            const [contact] = await db
              .select()
              .from(users)
              .where(eq(users.id, contactId))
              .limit(1);

            if (!contact) continue;

            const preferences = getEventNotificationPreferences(contact);
            const contactEmail = contact.preferredEmail || contact.email;
            const contactName = contact.displayName || contact.firstName || 'TSP Contact';
            const contactPhone = getUserPhoneNumber(contact);

            // Check primary reminder
            if (
              preferences.primaryReminderEnabled &&
              hoursUntilEvent >= (preferences.primaryReminderHours - 1) &&
              hoursUntilEvent <= (preferences.primaryReminderHours + 1)
            ) {
              // Send email
              if (
                (preferences.primaryReminderType === 'email' || preferences.primaryReminderType === 'both') &&
                contactEmail
              ) {
                await EmailNotificationService.sendVolunteerReminderNotification(
                  contactEmail,
                  contactName,
                  event.id,
                  event.organizationName || 'Unknown Organization',
                  event.scheduledEventDate!,
                  'TSP Contact'
                );
                remindersSent++;
                cronLogger.info(`Sent primary email reminder to TSP contact ${contactEmail} for event ${event.id}`);
              }

              // Send SMS
              if (
                (preferences.primaryReminderType === 'sms' || preferences.primaryReminderType === 'both') &&
                contactPhone
              ) {
                const appUrl = process.env.REPL_URL || 'https://app.thesandwichproject.org';
                await sendEventReminderSMS(
                  contactPhone,
                  contactName,
                  event.organizationName || 'Unknown Organization',
                  event.scheduledEventDate!,
                  'TSP Contact',
                  `${appUrl}/dashboard?section=event-requests`
                );
                remindersSent++;
                cronLogger.info(`Sent primary SMS reminder to TSP contact ${contactPhone} for event ${event.id}`);
              }
            }

            // Check secondary reminder
            if (
              preferences.secondaryReminderEnabled &&
              hoursUntilEvent >= (preferences.secondaryReminderHours - 1) &&
              hoursUntilEvent <= (preferences.secondaryReminderHours + 1)
            ) {
              // Send email
              if (
                (preferences.secondaryReminderType === 'email' || preferences.secondaryReminderType === 'both') &&
                contactEmail
              ) {
                await EmailNotificationService.sendVolunteerReminderNotification(
                  contactEmail,
                  contactName,
                  event.id,
                  event.organizationName || 'Unknown Organization',
                  event.scheduledEventDate!,
                  'TSP Contact'
                );
                remindersSent++;
                cronLogger.info(`Sent secondary email reminder to TSP contact ${contactEmail} for event ${event.id}`);
              }

              // Send SMS
              if (
                (preferences.secondaryReminderType === 'sms' || preferences.secondaryReminderType === 'both') &&
                contactPhone
              ) {
                const appUrl = process.env.REPL_URL || 'https://app.thesandwichproject.org';
                await sendEventReminderSMS(
                  contactPhone,
                  contactName,
                  event.organizationName || 'Unknown Organization',
                  event.scheduledEventDate!,
                  'TSP Contact',
                  `${appUrl}/dashboard?section=event-requests`
                );
                remindersSent++;
                cronLogger.info(`Sent secondary SMS reminder to TSP contact ${contactPhone} for event ${event.id}`);
              }
            }
          } catch (error) {
            errors++;
            cronLogger.error(`Error sending reminder to TSP contact ${contactId}:`, error);
          }
        }
      } catch (error) {
        errors++;
        cronLogger.error(`Error processing TSP contacts for event ${event.id}:`, error);
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
