/**
 * TSP Contact Follow-up Notification Service
 * 
 * Sends automated reminders to TSP contacts when:
 * 1. Approaching events (within 7 days) still have 'in_progress' status
 * 2. Events with only toolkit sent and 48+ hours have passed without progress
 */

import { db } from '../db';
import { eventRequests, users, tspContactFollowups } from '@shared/schema';
import { and, eq, sql, gte, lte, isNull, notExists, or } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';
import { getUserMetadata, getUserPhoneNumber } from '@shared/types';
import { sendTSPFollowupReminderSMS } from '../sms-service';
import { EmailNotificationService } from './email-notification-service';

const serviceLogger = {
  info: (msg: string, ...args: any[]) => logger.info(`[TSP-Followup] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => logger.warn(`[TSP-Followup] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => logger.error(`[TSP-Followup] ${msg}`, ...args),
};

interface FollowupResult {
  notificationsSent: number;
  eventsProcessed: number;
  errors: number;
  timestamp: Date;
  details: Array<{
    eventId: number;
    organization: string;
    reminderType: string;
    channel: string;
    success: boolean;
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
 * Get events approaching (within 7 days) that are still in_progress status
 */
async function getApproachingInProgressEvents() {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  return db
    .select()
    .from(eventRequests)
    .where(
      and(
        eq(eventRequests.status, 'in_progress'),
        gte(eventRequests.scheduledEventDate, now),
        lte(eventRequests.scheduledEventDate, sevenDaysFromNow),
        or(
          sql`${eventRequests.tspContact} IS NOT NULL`,
          sql`${eventRequests.tspContactAssigned} IS NOT NULL`
        )
      )
    );
}

/**
 * Get events where only toolkit was sent 48+ hours ago with no progress
 */
async function getToolkitOnlyEvents() {
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  
  return db
    .select()
    .from(eventRequests)
    .where(
      and(
        eq(eventRequests.status, 'in_progress'),
        eq(eventRequests.toolkitSent, true),
        lte(eventRequests.toolkitSentAt, fortyEightHoursAgo),
        eq(eventRequests.followUpEmailSent, false),
        or(
          sql`${eventRequests.tspContact} IS NOT NULL`,
          sql`${eventRequests.tspContactAssigned} IS NOT NULL`
        )
      )
    );
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
 * Send a follow-up reminder notification to a TSP contact
 */
async function sendFollowupNotification(
  event: any,
  user: any,
  reminderType: 'approaching_event' | 'toolkit_followup'
): Promise<{ success: boolean; channel: string; message: string }> {
  const channel = getPreferredChannel(user);
  const userName = user.displayName || user.firstName || 'there';
  const organization = event.organizationName || 'an organization';
  const eventDate = event.scheduledEventDate;
  
  let message: string;
  
  if (reminderType === 'approaching_event') {
    const daysUntil = eventDate
      ? Math.ceil((new Date(eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : 'a few';
    
    message = `Hi ${userName}! Quick reminder: The event with ${organization} is coming up in ${daysUntil} days and is still marked as in-progress. Let us know if you need any help getting it scheduled!`;
  } else {
    message = `Hi ${userName}! Just checking in on the ${organization} event - we sent the toolkit a couple days ago but haven't heard back. Want to send a follow-up email, or do you need any help?`;
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
 * Main function to process and send TSP contact follow-up notifications
 */
export async function processTspContactFollowups(): Promise<FollowupResult> {
  const result: FollowupResult = {
    notificationsSent: 0,
    eventsProcessed: 0,
    errors: 0,
    timestamp: new Date(),
    details: [],
  };
  
  try {
    serviceLogger.info('Starting TSP contact follow-up check...');
    
    const [approachingEvents, toolkitEvents] = await Promise.all([
      getApproachingInProgressEvents(),
      getToolkitOnlyEvents(),
    ]);
    
    serviceLogger.info(`Found ${approachingEvents.length} approaching in-progress events, ${toolkitEvents.length} toolkit-only events`);
    
    for (const event of approachingEvents) {
      result.eventsProcessed++;
      const tspContactId = event.tspContactAssigned || event.tspContact;
      
      if (!tspContactId) continue;
      
      try {
        const alreadySent = await wasNotificationSent(event.id, tspContactId, 'approaching_event');
        if (alreadySent) {
          serviceLogger.info(`Skipping event ${event.id} - notification already sent`);
          continue;
        }
        
        const user = await getTspContactUser(tspContactId);
        if (!user) {
          serviceLogger.warn(`TSP contact user ${tspContactId} not found for event ${event.id}`);
          continue;
        }
        
        const notificationResult = await sendFollowupNotification(event, user, 'approaching_event');
        
        if (notificationResult.success) {
          await recordNotification(
            event.id,
            tspContactId,
            'approaching_event',
            notificationResult.channel,
            event.organizationName || 'Unknown',
            event.scheduledEventDate,
            'Approaching event reminder'
          );
          result.notificationsSent++;
        }
        
        result.details.push({
          eventId: event.id,
          organization: event.organizationName || 'Unknown',
          reminderType: 'approaching_event',
          channel: notificationResult.channel,
          success: notificationResult.success,
        });
      } catch (error) {
        result.errors++;
        serviceLogger.error(`Error processing approaching event ${event.id}:`, error);
      }
    }
    
    for (const event of toolkitEvents) {
      result.eventsProcessed++;
      const tspContactId = event.tspContactAssigned || event.tspContact;
      
      if (!tspContactId) continue;
      
      try {
        const alreadySent = await wasNotificationSent(event.id, tspContactId, 'toolkit_followup');
        if (alreadySent) {
          serviceLogger.info(`Skipping event ${event.id} - toolkit notification already sent`);
          continue;
        }
        
        const user = await getTspContactUser(tspContactId);
        if (!user) {
          serviceLogger.warn(`TSP contact user ${tspContactId} not found for event ${event.id}`);
          continue;
        }
        
        const notificationResult = await sendFollowupNotification(event, user, 'toolkit_followup');
        
        if (notificationResult.success) {
          await recordNotification(
            event.id,
            tspContactId,
            'toolkit_followup',
            notificationResult.channel,
            event.organizationName || 'Unknown',
            event.scheduledEventDate,
            'Toolkit follow-up reminder'
          );
          result.notificationsSent++;
        }
        
        result.details.push({
          eventId: event.id,
          organization: event.organizationName || 'Unknown',
          reminderType: 'toolkit_followup',
          channel: notificationResult.channel,
          success: notificationResult.success,
        });
      } catch (error) {
        result.errors++;
        serviceLogger.error(`Error processing toolkit event ${event.id}:`, error);
      }
    }
    
    serviceLogger.info(`Follow-up check complete: ${result.notificationsSent} notifications sent, ${result.errors} errors`);
    
  } catch (error) {
    serviceLogger.error('Fatal error in TSP contact follow-up processing:', error);
    result.errors++;
  }
  
  return result;
}
