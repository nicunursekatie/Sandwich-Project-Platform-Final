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
import { and, eq, isNull, sql, or, inArray } from 'drizzle-orm';
import { EmailNotificationService } from './email-notification-service';
import { sendEventReminderSMS } from '../sms-service';
import { getEventNotificationPreferences, getUserMetadata, getUserPhoneNumber } from '@shared/types';
import type { EventNotificationPreferences } from '@shared/types';
import { generateImpactReport, saveImpactReport } from './ai-impact-reports';

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

    if (upcomingEvents.length === 0) {
      return { remindersSent: 0, volunteersProcessed: 0, errors: 0, timestamp: now };
    }

    // PERFORMANCE: Batch fetch all volunteers for all events in ONE query (instead of N queries)
    const eventIds = upcomingEvents.map(e => e.id);
    const allVolunteers = await db
      .select()
      .from(eventVolunteers)
      .where(inArray(eventVolunteers.eventRequestId, eventIds));

    // Create a map for O(1) lookup: eventId -> volunteers[]
    const volunteersByEventId = new Map<number, Array<(typeof allVolunteers)[number]>>();
    for (const volunteer of allVolunteers) {
      const eventId = volunteer.eventRequestId;
      if (!volunteersByEventId.has(eventId)) {
        volunteersByEventId.set(eventId, []);
      }
      volunteersByEventId.get(eventId)!.push(volunteer);
    }

    // PERFORMANCE: Collect all user IDs we need to fetch, then batch fetch them
    const userIdsToFetch = new Set<string>();

    // Add volunteer user IDs
    for (const volunteer of allVolunteers) {
      if (volunteer.volunteerUserId) {
        userIdsToFetch.add(volunteer.volunteerUserId);
      }
    }

    // Add legacy assignment IDs and TSP contact IDs from events
    for (const event of upcomingEvents) {
      if (event.assignedSpeakerIds && Array.isArray(event.assignedSpeakerIds)) {
        for (const id of event.assignedSpeakerIds) {
          if (id) userIdsToFetch.add(id);
        }
      }
      if (event.assignedDriverIds && Array.isArray(event.assignedDriverIds)) {
        for (const id of event.assignedDriverIds) {
          if (id) userIdsToFetch.add(id);
        }
      }
      if (event.assignedVolunteerIds && Array.isArray(event.assignedVolunteerIds)) {
        for (const id of event.assignedVolunteerIds) {
          if (id) userIdsToFetch.add(id);
        }
      }
      if (event.tspContact) userIdsToFetch.add(event.tspContact);
      if (event.tspContactAssigned) userIdsToFetch.add(event.tspContactAssigned);
    }

    // Batch fetch all users in ONE query (instead of N*M queries)
    const userIdsArray = Array.from(userIdsToFetch);
    const allUsers = userIdsArray.length > 0
      ? await db.select().from(users).where(inArray(users.id, userIdsArray))
      : [];

    // Create a map for O(1) lookup: userId -> user
    const usersById = new Map(allUsers.map(u => [u.id, u]));

    cronLogger.info(`Batch fetched ${allVolunteers.length} volunteers and ${allUsers.length} users for ${upcomingEvents.length} events`);

    for (const event of upcomingEvents) {
      if (!event.scheduledEventDate) continue;

      const hoursUntilEvent = (event.scheduledEventDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Get volunteers for this event from pre-fetched data (O(1) lookup instead of DB query)
      const volunteers = volunteersByEventId.get(event.id) || [];

      // Process volunteer reminders
      for (const volunteer of volunteers) {
        volunteersProcessed++;
        
        try {
          let user = null;
          let volunteerEmail = volunteer.volunteerEmail;
          let volunteerName = volunteer.volunteerName || 'Volunteer';
          let volunteerPhone: string | null = volunteer.volunteerPhone;
          let preferences: EventNotificationPreferences | null = null;

          // Get user info and preferences for registered users (O(1) lookup from pre-fetched map)
          if (volunteer.volunteerUserId) {
            const foundUser = usersById.get(volunteer.volunteerUserId);

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

      // Process legacy speaker/driver/volunteer assignments
      const legacyAssignments: Array<{ userId: string; role: string }> = [];

      // Collect speakers from assignedSpeakerIds
      if (event.assignedSpeakerIds && Array.isArray(event.assignedSpeakerIds)) {
        for (const speakerId of event.assignedSpeakerIds) {
          if (speakerId) legacyAssignments.push({ userId: speakerId, role: 'speaker' });
        }
      }

      // Collect drivers from assignedDriverIds
      if (event.assignedDriverIds && Array.isArray(event.assignedDriverIds)) {
        for (const driverId of event.assignedDriverIds) {
          if (driverId) legacyAssignments.push({ userId: driverId, role: 'driver' });
        }
      }

      // Collect volunteers from assignedVolunteerIds
      if (event.assignedVolunteerIds && Array.isArray(event.assignedVolunteerIds)) {
        for (const volunteerId of event.assignedVolunteerIds) {
          if (volunteerId) legacyAssignments.push({ userId: volunteerId, role: 'volunteer' });
        }
      }

      // Process legacy assignments
      for (const assignment of legacyAssignments) {
        volunteersProcessed++;

        try {
          // Use pre-fetched user map (O(1) lookup instead of DB query)
          const user = usersById.get(assignment.userId);

          if (!user) continue;

          const volunteerEmail = user.preferredEmail || user.email;
          const volunteerName = user.displayName || user.firstName || 'Volunteer';
          const volunteerPhone = getUserPhoneNumber(user);
          const preferences = getEventNotificationPreferences(user) || {
            primaryReminderEnabled: true,
            primaryReminderHours: 24,
            primaryReminderType: 'email',
            secondaryReminderEnabled: false,
            secondaryReminderHours: 1,
            secondaryReminderType: 'email',
          };

          // Check primary reminder
          if (
            preferences.primaryReminderEnabled &&
            hoursUntilEvent >= (preferences.primaryReminderHours - 1) &&
            hoursUntilEvent <= (preferences.primaryReminderHours + 1)
          ) {
            // Send email reminder
            if (
              (preferences.primaryReminderType === 'email' || preferences.primaryReminderType === 'both') &&
              volunteerEmail
            ) {
              const emailSent = await EmailNotificationService.sendVolunteerReminderNotification(
                volunteerEmail,
                volunteerName,
                event.id,
                event.organizationName || 'Unknown Organization',
                event.scheduledEventDate!,
                assignment.role
              );

              if (emailSent) {
                remindersSent++;
                cronLogger.info(`Sent primary email reminder to legacy ${assignment.role} ${volunteerEmail} for event ${event.id}`);
              }
            }

            // Send SMS reminder
            if (
              (preferences.primaryReminderType === 'sms' || preferences.primaryReminderType === 'both') &&
              volunteerPhone
            ) {
              const appUrl = process.env.REPL_URL || 'https://app.thesandwichproject.org';
              const smsSent = await sendEventReminderSMS(
                volunteerPhone,
                volunteerName,
                event.organizationName || 'Unknown Organization',
                event.scheduledEventDate,
                assignment.role,
                `${appUrl}/dashboard?section=event-requests`
              );

              if (smsSent.success) {
                remindersSent++;
                cronLogger.info(`Sent primary SMS reminder to legacy ${assignment.role} ${volunteerPhone} for event ${event.id}`);
              }
            }
          }

          // Check secondary reminder
          if (
            preferences.secondaryReminderEnabled &&
            hoursUntilEvent >= (preferences.secondaryReminderHours - 1) &&
            hoursUntilEvent <= (preferences.secondaryReminderHours + 1)
          ) {
            // Send email reminder
            if (
              (preferences.secondaryReminderType === 'email' || preferences.secondaryReminderType === 'both') &&
              volunteerEmail
            ) {
              const emailSent = await EmailNotificationService.sendVolunteerReminderNotification(
                volunteerEmail,
                volunteerName,
                event.id,
                event.organizationName || 'Unknown Organization',
                event.scheduledEventDate!,
                assignment.role
              );

              if (emailSent) {
                remindersSent++;
                cronLogger.info(`Sent secondary email reminder to legacy ${assignment.role} ${volunteerEmail} for event ${event.id}`);
              }
            }

            // Send SMS reminder
            if (
              (preferences.secondaryReminderType === 'sms' || preferences.secondaryReminderType === 'both') &&
              volunteerPhone
            ) {
              const appUrl = process.env.REPL_URL || 'https://app.thesandwichproject.org';
              const smsSent = await sendEventReminderSMS(
                volunteerPhone,
                volunteerName,
                event.organizationName || 'Unknown Organization',
                event.scheduledEventDate,
                assignment.role,
                `${appUrl}/dashboard?section=event-requests`
              );

              if (smsSent.success) {
                remindersSent++;
                cronLogger.info(`Sent secondary SMS reminder to legacy ${assignment.role} ${volunteerPhone} for event ${event.id}`);
              }
            }
          }
        } catch (error) {
          errors++;
          cronLogger.error(`Error sending reminder for legacy ${assignment.role} ${assignment.userId}:`, error);
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
            // Use pre-fetched user map (O(1) lookup instead of DB query)
            const contact = usersById.get(contactId);

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
 * Notify TSP contacts about in-process events whose date has passed
 * Runs daily to alert TSP contacts that they need to follow up
 */
export async function notifyPastDateInProcessEvents(): Promise<{
  notificationsSent: number;
  eventsProcessed: number;
  errors: number;
  timestamp: Date;
}> {
  const now = new Date();
  let notificationsSent = 0;
  let eventsProcessed = 0;
  let errors = 0;

  try {
    // Get the start of today (midnight) to compare against event dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all in-process events where the date has passed and notification hasn't been sent
    const pastDateEvents = await db
      .select()
      .from(eventRequests)
      .where(
        and(
          eq(eventRequests.status, 'in_process'),
          isNull(eventRequests.pastDateNotificationSentAt),
          or(
            // Check scheduled date if set, otherwise check desired date
            sql`${eventRequests.scheduledEventDate} IS NOT NULL AND ${eventRequests.scheduledEventDate} < ${today}`,
            sql`${eventRequests.scheduledEventDate} IS NULL AND ${eventRequests.desiredEventDate} IS NOT NULL AND ${eventRequests.desiredEventDate} < ${today}`
          )
        )
      );

    cronLogger.info(`Found ${pastDateEvents.length} in-process events with passed dates to notify`);

    for (const event of pastDateEvents) {
      eventsProcessed++;

      try {
        // Re-fetch the event to ensure we have the latest status
        // This prevents sending notifications for events that were completed
        // between when we queried and when we process each event
        const [currentEvent] = await db
          .select()
          .from(eventRequests)
          .where(eq(eventRequests.id, event.id))
          .limit(1);

        if (!currentEvent) {
          cronLogger.warn(`Event ${event.id} no longer exists, skipping`);
          continue;
        }

        // Skip if status has changed from in_process (e.g., already completed)
        if (currentEvent.status !== 'in_process') {
          cronLogger.info(`Event ${event.id} (${event.organizationName}) status changed to '${currentEvent.status}', skipping notification`);
          // Still mark as notified so we don't keep checking this event
          await db
            .update(eventRequests)
            .set({ pastDateNotificationSentAt: new Date() })
            .where(eq(eventRequests.id, event.id));
          continue;
        }

        // Skip if notification was already sent (race condition protection)
        if (currentEvent.pastDateNotificationSentAt) {
          cronLogger.info(`Event ${event.id} already has notification sent, skipping`);
          continue;
        }

        // Get the TSP contact(s) to notify
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

        // Add additionalContact1 and additionalContact2 if set
        if (event.additionalContact1) tspContactIds.push(event.additionalContact1);
        if (event.additionalContact2) tspContactIds.push(event.additionalContact2);

        // Get unique contact IDs
        const uniqueContactIds = [...new Set(tspContactIds)];

        if (uniqueContactIds.length === 0) {
          cronLogger.warn(`No TSP contacts found for event ${event.id} (${event.organizationName})`);
          continue;
        }

        // Determine which date to use
        const eventDate = event.scheduledEventDate || event.desiredEventDate;

        // Send notification to each TSP contact
        for (const contactId of uniqueContactIds) {
          try {
            const [contact] = await db
              .select()
              .from(users)
              .where(eq(users.id, contactId))
              .limit(1);

            if (!contact || !contact.email) continue;

            const contactName = contact.displayName || contact.firstName || 'TSP Contact';
            const contactEmail = contact.preferredEmail || contact.email;

            const sent = await EmailNotificationService.sendPastDateNotification(
              contactEmail,
              contactName,
              event.id,
              event.organizationName || 'Unknown Organization',
              eventDate!
            );

            if (sent) {
              notificationsSent++;
              cronLogger.info(`Past date notification sent to ${contactEmail} for event ${event.id}`);
            }
          } catch (error) {
            errors++;
            cronLogger.error(`Error sending past date notification to contact ${contactId}:`, error);
          }
        }

        // Mark the notification as sent for this event
        await db
          .update(eventRequests)
          .set({ pastDateNotificationSentAt: new Date() })
          .where(eq(eventRequests.id, event.id));

      } catch (error) {
        errors++;
        cronLogger.error(`Error processing past date notification for event ${event.id}:`, error);
      }
    }
  } catch (error) {
    cronLogger.error('Error in notifyPastDateInProcessEvents:', error);
    throw error;
  }

  return {
    notificationsSent,
    eventsProcessed,
    errors,
    timestamp: now,
  };
}

/**
 * Auto-complete scheduled events whose event date has passed
 * Runs nightly to move events from "scheduled" to "completed" status
 * Exported so it can be called manually if needed
 */
export async function autoCompletePassedEvents(): Promise<{
  eventsCompleted: number;
  errors: number;
  timestamp: Date;
}> {
  const now = new Date();
  let eventsCompleted = 0;
  let errors = 0;

  try {
    // Get the start of today (midnight) to compare against event dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all scheduled events where the scheduled date is before today
    const passedEvents = await db
      .select()
      .from(eventRequests)
      .where(
        and(
          eq(eventRequests.status, 'scheduled'),
          sql`${eventRequests.scheduledEventDate} < ${today}`
        )
      );

    cronLogger.info(`Found ${passedEvents.length} scheduled events with passed dates to auto-complete`);

    for (const event of passedEvents) {
      try {
        // Update the event status to completed
        await db
          .update(eventRequests)
          .set({
            status: 'completed',
            updatedAt: new Date(),
          })
          .where(eq(eventRequests.id, event.id));

        eventsCompleted++;
        cronLogger.info(`Auto-completed event ${event.id} (${event.organizationName}) - event date was ${event.scheduledEventDate}`);
      } catch (error) {
        errors++;
        cronLogger.error(`Error auto-completing event ${event.id}:`, error);
      }
    }
  } catch (error) {
    cronLogger.error('Error in autoCompletePassedEvents:', error);
    throw error;
  }

  return {
    eventsCompleted,
    errors,
    timestamp: now,
  };
}

/**
 * Generate monthly impact report
 */
async function generateMonthlyImpactReport(): Promise<{
  reportGenerated: boolean;
  reportId?: number;
  error?: string;
  timestamp: Date;
}> {
  const now = new Date();

  try {
    // Generate report for the previous month
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    // Use UTC to avoid timezone edge cases
    // startDate: First moment of the month (00:00:00.000 on day 1)
    const startDate = new Date(Date.UTC(lastMonth.getUTCFullYear(), lastMonth.getUTCMonth(), 1, 0, 0, 0, 0));
    // endDate: First moment of the next month (exclusive upper bound)
    const endDate = new Date(Date.UTC(lastMonth.getUTCFullYear(), lastMonth.getUTCMonth() + 1, 1, 0, 0, 0, 0));

    cronLogger.info('Generating monthly impact report', {
      month: lastMonth.getUTCMonth() + 1,
      year: lastMonth.getUTCFullYear(),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    const report = await generateImpactReport(startDate, endDate, 'monthly');
    const reportId = await saveImpactReport(report, startDate, endDate, 'monthly', 'ai-cron');

    cronLogger.info('Monthly impact report generated successfully', {
      reportId,
      period: `${lastMonth.getUTCFullYear()}-${String(lastMonth.getUTCMonth() + 1).padStart(2, '0')}`,
    });

    return {
      reportGenerated: true,
      reportId,
      timestamp: now,
    };
  } catch (error) {
    cronLogger.error('Failed to generate monthly impact report', error);
    return {
      reportGenerated: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: now,
    };
  }
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

  // Monthly impact report generation - runs on the 1st of each month at 9:00 AM
  // Cron format: minute hour day-of-month month day-of-week
  // '0 9 1 * *' = At 9:00 AM on the 1st day of every month
  const impactReportJob = cron.schedule('0 9 1 * *', async () => {
    cronLogger.info('Running monthly impact report generation...');
    try {
      const result = await generateMonthlyImpactReport();
      if (result.reportGenerated) {
        cronLogger.info('Monthly impact report generated successfully', {
          reportId: result.reportId,
          timestamp: result.timestamp,
        });
      } else {
        cronLogger.error('Monthly impact report generation failed', {
          error: result.error,
          timestamp: result.timestamp,
        });
      }
    } catch (error) {
      logError(
        error as Error,
        'Error running impact report generation cron job',
        undefined,
        { jobType: 'impact-report-generation' }
      );
    }
  }, {
    scheduled: true,
    timezone: 'America/New_York'
  });

  cronLogger.info('Monthly impact report job scheduled successfully', {
    schedule: '1st of each month at 9:00 AM',
    timezone: 'America/New_York',
  });

  // Auto-complete passed events - runs daily at 12:05 AM (just after midnight)
  // Cron format: minute hour day-of-month month day-of-week
  // '5 0 * * *' = At 12:05 AM every day
  const autoCompleteJob = cron.schedule('5 0 * * *', async () => {
    cronLogger.info('Running auto-complete for passed events...');
    try {
      const result = await autoCompletePassedEvents();
      cronLogger.info('Auto-complete job completed', {
        eventsCompleted: result.eventsCompleted,
        errors: result.errors,
        timestamp: result.timestamp,
      });
    } catch (error) {
      logError(
        error as Error,
        'Error running auto-complete cron job',
        undefined,
        { jobType: 'auto-complete-events' }
      );
    }
  }, {
    scheduled: true,
    timezone: 'America/New_York'
  });

  cronLogger.info('Auto-complete events job scheduled successfully', {
    schedule: 'Daily at 12:05 AM',
    timezone: 'America/New_York',
  });

  // Past date in-process notification job - runs daily at 9:30 AM
  // Notifies TSP contacts about in-process events whose date has passed
  // Cron format: minute hour day-of-month month day-of-week
  // '30 9 * * *' = At 9:30 AM every day
  const pastDateNotificationJob = cron.schedule('30 9 * * *', async () => {
    cronLogger.info('Running past date notification check for in-process events...');
    try {
      const result = await notifyPastDateInProcessEvents();
      cronLogger.info('Past date notification job completed', {
        notificationsSent: result.notificationsSent,
        eventsProcessed: result.eventsProcessed,
        errors: result.errors,
        timestamp: result.timestamp,
      });
    } catch (error) {
      logError(
        error as Error,
        'Error running past date notification cron job',
        undefined,
        { jobType: 'past-date-notification' }
      );
    }
  }, {
    scheduled: true,
    timezone: 'America/New_York'
  });

  cronLogger.info('Past date notification job scheduled successfully', {
    schedule: 'Daily at 9:30 AM',
    timezone: 'America/New_York',
  });

  // Return job references in case we need to manage them later
  return {
    hostScraperJob,
    volunteerReminderJob,
    impactReportJob,
    autoCompleteJob,
    pastDateNotificationJob,
  };
}

/**
 * Stop all cron jobs (useful for graceful shutdown)
 */
export function stopAllCronJobs(jobs: ReturnType<typeof initializeCronJobs>) {
  cronLogger.info('Stopping all scheduled jobs...');
  jobs.hostScraperJob.stop();
  jobs.volunteerReminderJob.stop();
  jobs.impactReportJob.stop();
  jobs.autoCompleteJob.stop();
  jobs.pastDateNotificationJob.stop();
  cronLogger.info('All cron jobs stopped successfully');
}
