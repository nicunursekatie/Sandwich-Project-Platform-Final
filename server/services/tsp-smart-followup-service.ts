/**
 * Smart TSP Contact Follow-up Service
 *
 * Non-spammy, one-time notifications with escalation:
 *
 * 1. NEW REQUESTS (24 hours):
 *    - TSP contact assigned but toolkit not sent within 24 business hours
 *    - Send ONE reminder with deep link to event
 *    - Track to prevent duplicate sends
 *
 * 2. IN-PROCESS EVENTS (7 days):
 *    - No activity (contact logs, notes, or status change) within 7 days
 *    - Send ONE reminder
 *    - Track to prevent duplicate sends
 *
 * 3. ESCALATION:
 *    - If still no activity 3 days after first reminder, escalate to admin
 *    - CC both TSP contact and admin/coordinator
 *
 * Business Days: Excludes weekends, no reminders sent on Sat/Sun
 */

import { db } from '../db';
import { eventRequests, users, tspContactFollowups } from '@shared/schema';
import { and, eq, sql, gte, lte, isNull, or, inArray } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';
import { getUserMetadata, getUserPhoneNumber } from '@shared/types';
import { sendTSPFollowupReminderSMS } from '../sms-service';
import { EmailNotificationService } from './email-notification-service';
import { getMissingIntakeInfo } from '../../client/src/lib/event-request-validation';
import { getPrimaryContextualAction } from '../../client/src/lib/contextual-actions';

const serviceLogger = {
  info: (msg: string, ...args: any[]) => logger.info(`[SmartFollowup] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => logger.warn(`[SmartFollowup] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => logger.error(`[SmartFollowup] ${msg}`, ...args),
};

const APP_URL = process.env.PUBLIC_APP_URL ||
  (process.env.REPLIT_DOMAIN ? `https://${process.env.REPLIT_DOMAIN}` : 'https://sandwich-project-platform-final-katielong2316.replit.app');

/**
 * Check if today is a weekend (Saturday = 6, Sunday = 0)
 */
function isWeekend(date: Date = new Date()): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Calculate business days elapsed between two dates (excludes Sat/Sun)
 */
function getBusinessDaysElapsed(startDate: Date, endDate: Date = new Date()): number {
  let count = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current < end) {
    current.setDate(current.getDate() + 1);
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }

  return count;
}

/**
 * Get calendar days elapsed (for 7-day rule)
 */
function getCalendarDaysElapsed(startDate: Date, endDate: Date = new Date()): number {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

interface FollowupResult {
  notificationsSent: number;
  escalationsSent: number;
  eventsProcessed: number;
  errors: number;
  timestamp: Date;
  details: Array<{
    eventId: number;
    organization: string;
    reminderType: string;
    channel: string;
    success: boolean;
    isEscalation?: boolean;
  }>;
}

/**
 * Check if a notification was already sent for this event/contact/type combination
 */
async function wasNotificationSent(
  eventRequestId: number,
  tspContactUserId: string,
  reminderType: string
): Promise<boolean> {
  const existing = await db
    .select({ id: tspContactFollowups.id })
    .from(tspContactFollowups)
    .where(
      and(
        eq(tspContactFollowups.eventRequestId, eventRequestId),
        eq(tspContactFollowups.tspContactUserId, tspContactUserId),
        eq(tspContactFollowups.reminderType, reminderType)
      )
    )
    .limit(1);

  return existing.length > 0;
}

/**
 * Get the most recent notification for an event/contact
 */
async function getLastNotification(
  eventRequestId: number,
  tspContactUserId: string
) {
  const [lastNotification] = await db
    .select()
    .from(tspContactFollowups)
    .where(
      and(
        eq(tspContactFollowups.eventRequestId, eventRequestId),
        eq(tspContactFollowups.tspContactUserId, tspContactUserId),
        inArray(tspContactFollowups.reminderType, ['new_request_24h', 'in_process_7d'])
      )
    )
    .orderBy(sql`${tspContactFollowups.sentAt} DESC`)
    .limit(1);

  return lastNotification;
}

/**
 * Record that a notification was sent
 */
async function recordNotification(
  eventRequestId: number,
  tspContactUserId: string,
  reminderType: string,
  deliveryChannel: string,
  organization: string,
  eventDate: Date | null,
  messagePreview: string
): Promise<void> {
  try {
    await db.insert(tspContactFollowups).values({
      eventRequestId,
      tspContactUserId,
      reminderType,
      deliveryChannel,
      eventOrganization: organization,
      eventDate,
      messagePreview: messagePreview.substring(0, 500),
    });
  } catch (error: any) {
    if (error?.code === '23505') {
      serviceLogger.warn(`Duplicate notification record for event ${eventRequestId}, type ${reminderType}`);
    } else {
      throw error;
    }
  }
}

/**
 * Get user details for TSP contact
 */
async function getTspContactUser(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user;
}

/**
 * Get admin/coordinator user for escalations
 * TODO: Add a proper admin assignment field to events
 * For now, just get any super_admin user
 */
async function getAdminUser() {
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.role, 'super_admin'))
    .limit(1);

  return admin;
}

/**
 * Determine the preferred notification channel for a user
 */
function getPreferredChannel(user: any): 'sms' | 'email' {
  const metadata = getUserMetadata(user);
  const smsConsent = metadata.smsConsent;

  if (smsConsent?.status === 'confirmed' && smsConsent.enabled && smsConsent.phoneNumber) {
    return 'sms';
  }

  return 'email';
}

/**
 * Check if event has had any activity (notes, contact logs, status changes)
 */
function hasRecentActivity(event: any, sinceDate: Date): boolean {
  // Check if status changed to scheduled
  if (event.status === 'scheduled') {
    return true;
  }

  // Check if scheduling notes were added/updated
  if (event.updatedAt && new Date(event.updatedAt) > sinceDate) {
    return true;
  }

  // Check if contact attempts were logged
  if (event.contactAttemptsLog && Array.isArray(event.contactAttemptsLog)) {
    const recentAttempts = event.contactAttemptsLog.filter((attempt: any) => {
      const attemptDate = new Date(attempt.timestamp);
      return attemptDate > sinceDate;
    });
    if (recentAttempts.length > 0) {
      return true;
    }
  }

  // Check if last contact attempt was recent
  if (event.lastContactAttempt && new Date(event.lastContactAttempt) > sinceDate) {
    return true;
  }

  return false;
}

/**
 * Get new requests where TSP contact assigned but toolkit not sent (24 business hours)
 */
async function getNewRequestsNeedingReminder() {
  const now = new Date();
  const events = await db
    .select()
    .from(eventRequests)
    .where(
      and(
        eq(eventRequests.status, 'new'),
        or(
          sql`${eventRequests.tspContact} IS NOT NULL`,
          sql`${eventRequests.tspContactAssigned} IS NOT NULL`
        ),
        or(
          eq(eventRequests.toolkitSent, false),
          isNull(eventRequests.toolkitSent)
        ),
        sql`${eventRequests.tspContactAssignedDate} IS NOT NULL`
      )
    );

  return events.filter(event => {
    if (!event.tspContactAssignedDate) return false;
    const businessDays = getBusinessDaysElapsed(event.tspContactAssignedDate);
    return businessDays >= 1; // 24 hours = 1 business day
  });
}

/**
 * Get in-process events with no activity in 7 days
 */
async function getInProcessEventsNeedingReminder() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const events = await db
    .select()
    .from(eventRequests)
    .where(
      and(
        eq(eventRequests.status, 'in_process'),
        or(
          sql`${eventRequests.tspContact} IS NOT NULL`,
          sql`${eventRequests.tspContactAssigned} IS NOT NULL`
        )
      )
    );

  return events.filter(event => {
    // Check if event has been in this status for at least 7 days
    const statusDate = event.tspContactAssignedDate || event.createdAt;
    if (!statusDate) return false;

    const daysElapsed = getCalendarDaysElapsed(statusDate);
    if (daysElapsed < 7) return false;

    // Check if there's been any activity in the last 7 days
    return !hasRecentActivity(event, sevenDaysAgo);
  });
}

/**
 * Get events that need escalation (reminder sent 3+ days ago, still no activity)
 */
async function getEventsNeedingEscalation() {
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const events = await db
    .select()
    .from(eventRequests)
    .where(
      and(
        or(
          eq(eventRequests.status, 'new'),
          eq(eventRequests.status, 'in_process')
        ),
        or(
          sql`${eventRequests.tspContact} IS NOT NULL`,
          sql`${eventRequests.tspContactAssigned} IS NOT NULL`
        )
      )
    );

  const needsEscalation = [];

  for (const event of events) {
    const tspContactId = event.tspContactAssigned || event.tspContact;
    if (!tspContactId) continue;

    // Check if there was a notification sent at least 3 days ago
    const lastNotification = await getLastNotification(event.id, tspContactId);
    if (!lastNotification) continue;

    const notificationDate = new Date(lastNotification.sentAt);
    if (notificationDate > threeDaysAgo) continue; // Not old enough yet

    // Check if escalation already sent
    const escalationSent = await wasNotificationSent(event.id, tspContactId, 'escalation');
    if (escalationSent) continue;

    // Check if there's been activity since the notification
    if (hasRecentActivity(event, notificationDate)) continue;

    needsEscalation.push(event);
  }

  return needsEscalation;
}

/**
 * Send notification to TSP contact
 */
async function sendNotification(
  event: any,
  user: any,
  reminderType: 'new_request_24h' | 'in_process_7d',
  isEscalation: boolean = false,
  adminUser?: any
): Promise<{ success: boolean; channel: string; message: string }> {
  const channel = getPreferredChannel(user);
  const userName = user.displayName || user.firstName || 'there';
  const organization = event.organizationName || 'an organization';
  const eventDate = event.scheduledEventDate || event.desiredEventDate;

  // Get contextual action for more specific messaging
  const missingInfo = getMissingIntakeInfo(event);
  const action = getPrimaryContextualAction(event);

  const eventLink = `${APP_URL}/events?id=${event.id}`;
  const contactOrganizerLink = `${APP_URL}/events/${event.id}/contact`;

  let message: string;

  if (reminderType === 'new_request_24h') {
    message = isEscalation
      ? `ESCALATION: Hi ${userName}, the new ${organization} event still needs attention. It's been 3 days with no toolkit sent. ${action ? action.label + ' is still needed.' : 'Missing info: ' + missingInfo.join(', ')}. View event: ${eventLink}`
      : `Hi ${userName}! Quick reminder: The ${organization} event was assigned to you yesterday but the toolkit hasn't been sent yet. ${action ? action.label + ' needed first.' : ''} View event: ${eventLink}`;
  } else {
    message = isEscalation
      ? `ESCALATION: Hi ${userName}, the ${organization} event (in-process) hasn't had any contact notes or activity in 10 days. ${action ? action.label + ' is needed.' : 'Needs follow-up.'} View event: ${eventLink}`
      : `Hi ${userName}! The ${organization} event hasn't had any contact notes or activity in 7 days. ${action ? action.label + ' is needed.' : 'Time for a follow-up?'} View event: ${eventLink}`;
  }

  // If escalation, also notify admin
  if (isEscalation && adminUser) {
    const adminMessage = `ESCALATION: Event ${event.id} (${organization}) assigned to ${userName} needs attention. No activity for several days. ${action ? action.label + ' needed.' : 'Review: ' + eventLink}`;
    const adminChannel = getPreferredChannel(adminUser);

    if (adminChannel === 'sms') {
      const adminPhone = getUserPhoneNumber(adminUser);
      if (adminPhone) {
        await sendTSPFollowupReminderSMS(adminPhone, adminMessage);
      }
    } else {
      await EmailNotificationService.sendEscalationEmail(
        adminUser.preferredEmail || adminUser.email,
        adminUser.displayName || adminUser.firstName || 'Admin',
        organization,
        userName,
        event.id,
        eventLink
      );
    }
  }

  if (channel === 'sms') {
    const phoneNumber = getUserPhoneNumber(user);
    if (!phoneNumber) {
      return { success: false, channel: 'sms', message: 'No phone number available' };
    }

    const result = await sendTSPFollowupReminderSMS(phoneNumber, message);
    return { success: result.success, channel: 'sms', message: result.success ? 'SMS sent' : result.message };
  } else {
    const email = user.preferredEmail || user.email;
    if (!email) {
      return { success: false, channel: 'email', message: 'No email available' };
    }

    const result = await EmailNotificationService.sendTSPFollowupReminderEmail(
      email,
      userName,
      organization,
      reminderType,
      eventDate,
      event.id
    );

    return { success: result, channel: 'email', message: result ? 'Email sent' : 'Failed to send email' };
  }
}

/**
 * Main function to process smart TSP follow-ups
 */
export async function processSmartTspFollowups(): Promise<FollowupResult> {
  const result: FollowupResult = {
    notificationsSent: 0,
    escalationsSent: 0,
    eventsProcessed: 0,
    errors: 0,
    timestamp: new Date(),
    details: [],
  };

  try {
    serviceLogger.info('Starting smart TSP follow-up check...');

    // Skip all reminders on weekends
    if (isWeekend()) {
      serviceLogger.info('Weekend detected - skipping all follow-up reminders');
      return result;
    }

    // 1. Check new requests (24 hours without toolkit)
    const newRequestEvents = await getNewRequestsNeedingReminder();
    serviceLogger.info(`Found ${newRequestEvents.length} new requests needing reminder (24h without toolkit)`);

    for (const event of newRequestEvents) {
      result.eventsProcessed++;
      const tspContactId = event.tspContactAssigned || event.tspContact;
      if (!tspContactId) continue;

      try {
        const alreadySent = await wasNotificationSent(event.id, tspContactId, 'new_request_24h');
        if (alreadySent) {
          serviceLogger.info(`Skipping event ${event.id} - new_request reminder already sent`);
          continue;
        }

        const user = await getTspContactUser(tspContactId);
        if (!user) {
          serviceLogger.warn(`TSP contact user ${tspContactId} not found for event ${event.id}`);
          continue;
        }

        const notificationResult = await sendNotification(event, user, 'new_request_24h', false);

        if (notificationResult.success) {
          await recordNotification(
            event.id,
            tspContactId,
            'new_request_24h',
            notificationResult.channel,
            event.organizationName || 'Unknown',
            event.scheduledEventDate || event.desiredEventDate,
            '24h reminder - toolkit not sent'
          );
          result.notificationsSent++;
        }

        result.details.push({
          eventId: event.id,
          organization: event.organizationName || 'Unknown',
          reminderType: 'new_request_24h',
          channel: notificationResult.channel,
          success: notificationResult.success,
        });
      } catch (error) {
        result.errors++;
        serviceLogger.error(`Error processing new request ${event.id}:`, error);
      }
    }

    // 2. Check in-process events (7 days without activity)
    const inProcessEvents = await getInProcessEventsNeedingReminder();
    serviceLogger.info(`Found ${inProcessEvents.length} in-process events needing reminder (7d without activity)`);

    for (const event of inProcessEvents) {
      result.eventsProcessed++;
      const tspContactId = event.tspContactAssigned || event.tspContact;
      if (!tspContactId) continue;

      try {
        const alreadySent = await wasNotificationSent(event.id, tspContactId, 'in_process_7d');
        if (alreadySent) {
          serviceLogger.info(`Skipping event ${event.id} - in_process reminder already sent`);
          continue;
        }

        const user = await getTspContactUser(tspContactId);
        if (!user) {
          serviceLogger.warn(`TSP contact user ${tspContactId} not found for event ${event.id}`);
          continue;
        }

        const notificationResult = await sendNotification(event, user, 'in_process_7d', false);

        if (notificationResult.success) {
          await recordNotification(
            event.id,
            tspContactId,
            'in_process_7d',
            notificationResult.channel,
            event.organizationName || 'Unknown',
            event.scheduledEventDate || event.desiredEventDate,
            '7d reminder - no activity'
          );
          result.notificationsSent++;
        }

        result.details.push({
          eventId: event.id,
          organization: event.organizationName || 'Unknown',
          reminderType: 'in_process_7d',
          channel: notificationResult.channel,
          success: notificationResult.success,
        });
      } catch (error) {
        result.errors++;
        serviceLogger.error(`Error processing in-process event ${event.id}:`, error);
      }
    }

    // 3. Check for escalations (3 days after first reminder, still no activity)
    const escalationEvents = await getEventsNeedingEscalation();
    serviceLogger.info(`Found ${escalationEvents.length} events needing escalation`);

    const admin = await getAdminUser();
    if (!admin) {
      serviceLogger.warn('No admin user found for escalations');
    }

    for (const event of escalationEvents) {
      result.eventsProcessed++;
      const tspContactId = event.tspContactAssigned || event.tspContact;
      if (!tspContactId) continue;

      try {
        const user = await getTspContactUser(tspContactId);
        if (!user) {
          serviceLogger.warn(`TSP contact user ${tspContactId} not found for event ${event.id}`);
          continue;
        }

        const reminderType = event.status === 'new' ? 'new_request_24h' : 'in_process_7d';
        const notificationResult = await sendNotification(event, user, reminderType, true, admin);

        if (notificationResult.success) {
          await recordNotification(
            event.id,
            tspContactId,
            'escalation',
            notificationResult.channel,
            event.organizationName || 'Unknown',
            event.scheduledEventDate || event.desiredEventDate,
            'Escalation - no response to reminder'
          );
          result.escalationsSent++;
          result.notificationsSent++;
        }

        result.details.push({
          eventId: event.id,
          organization: event.organizationName || 'Unknown',
          reminderType: 'escalation',
          channel: notificationResult.channel,
          success: notificationResult.success,
          isEscalation: true,
        });
      } catch (error) {
        result.errors++;
        serviceLogger.error(`Error processing escalation for event ${event.id}:`, error);
      }
    }

    serviceLogger.info(`Smart follow-up check complete: ${result.notificationsSent} notifications sent (${result.escalationsSent} escalations), ${result.errors} errors`);

  } catch (error) {
    serviceLogger.error('Fatal error in smart TSP follow-up processing:', error);
    result.errors++;
  }

  return result;
}
