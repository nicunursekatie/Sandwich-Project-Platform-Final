/**
 * Check-In Reminder Processing Service
 *
 * Processes user-configured recurring reminders for event requests.
 * Supports multiple rule types per event:
 *   - no_contact: No contact attempt logged in X days
 *   - stale_event: No updates on event for X days
 *   - date_approaching_inprocess: Desired date nearing while still in-process
 *   - date_approaching_scheduled: Scheduled event date approaching
 *   - staffing_unmet: Unmet staffing needs X days before scheduled event
 *   - general_checkin: General periodic check-in (legacy)
 */

import sgMail from '@sendgrid/mail';
import { db } from '../db';
import { eventCheckInReminders, eventRequests, users, REMINDER_RULE_TYPES } from '@shared/schema';
import { and, eq, lte } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';
import { EMAIL_FOOTER_HTML } from '../utils/email-footer';
import { getAppBaseUrl } from '../config/constants';
import { getUserMetadata } from '@shared/types';
import { sendTSPFollowupReminderSMS } from '../sms-service';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Rule type display labels and descriptions for emails
const RULE_TYPE_LABELS: Record<string, { label: string; getDescription: (thresholdDays: number) => string }> = {
  [REMINDER_RULE_TYPES.NO_CONTACT]: {
    label: 'No Contact Attempt',
    getDescription: (days) => `No contact attempt has been logged in the last ${days} days.`,
  },
  [REMINDER_RULE_TYPES.STALE_EVENT]: {
    label: 'Stale Event',
    getDescription: (days) => `This event has had no updates in the last ${days} days.`,
  },
  [REMINDER_RULE_TYPES.DATE_APPROACHING_INPROCESS]: {
    label: 'Date Approaching (In Process)',
    getDescription: (days) => `The desired event date is within ${days} days and the event is still in process.`,
  },
  [REMINDER_RULE_TYPES.DATE_APPROACHING_SCHEDULED]: {
    label: 'Scheduled Date Approaching',
    getDescription: (days) => `The scheduled event date is within ${days} days.`,
  },
  [REMINDER_RULE_TYPES.STAFFING_UNMET]: {
    label: 'Staffing Needs Unmet',
    getDescription: (days) => `The event is within ${days} days and still has unmet staffing needs.`,
  },
  [REMINDER_RULE_TYPES.GENERAL_CHECKIN]: {
    label: 'General Check-In',
    getDescription: () => `Time for a scheduled check-in on this event.`,
  },
};

function calculateNextDue(frequency: string, fromDate: Date = new Date()): Date {
  const next = new Date(fromDate);
  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'every_3_days':
      next.setDate(next.getDate() + 3);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'biweekly':
      next.setDate(next.getDate() + 14);
      break;
    default:
      next.setDate(next.getDate() + 7);
  }
  next.setHours(9, 0, 0, 0);
  return next;
}

// Condition-based rules check daily when the condition hasn't been met yet.
// After sending a notification, use a cooldown to avoid spamming.
const CONDITION_CHECK_INTERVAL_DAYS = 1; // check daily
const CONDITION_COOLDOWN_DAYS = 3; // don't re-send for 3 days after a notification

function isConditionBasedRule(ruleType: string): boolean {
  return ruleType !== REMINDER_RULE_TYPES.GENERAL_CHECKIN;
}

/**
 * Evaluate whether a reminder rule's condition is currently met.
 * Returns true if the condition IS met (i.e., the reminder SHOULD fire).
 */
function evaluateRuleCondition(
  ruleType: string,
  thresholdDays: number,
  event: any
): boolean {
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;

  switch (ruleType) {
    case REMINDER_RULE_TYPES.NO_CONTACT: {
      // Only applies to in_process events
      if (event.status !== 'in_process') return false;
      const contactLog = event.contactAttemptsLog as Array<{ timestamp: string }> | null;
      if (!contactLog || contactLog.length === 0) {
        // No contact attempts ever — condition met
        return true;
      }
      // Find the most recent contact attempt
      const lastAttempt = contactLog.reduce((latest: string, entry: { timestamp: string }) => {
        return entry.timestamp > latest ? entry.timestamp : latest;
      }, contactLog[0].timestamp);
      const daysSinceContact = (now.getTime() - new Date(lastAttempt).getTime()) / msPerDay;
      return daysSinceContact >= thresholdDays;
    }

    case REMINDER_RULE_TYPES.STALE_EVENT: {
      // Only applies to in_process events
      if (event.status !== 'in_process') return false;
      const lastUpdated = event.updatedAt ? new Date(event.updatedAt) : null;
      if (!lastUpdated) return true;
      const daysSinceUpdate = (now.getTime() - lastUpdated.getTime()) / msPerDay;
      return daysSinceUpdate >= thresholdDays;
    }

    case REMINDER_RULE_TYPES.DATE_APPROACHING_INPROCESS: {
      // Only applies to in_process events with a desired date
      if (event.status !== 'in_process') return false;
      const desiredDate = event.desiredEventDate ? new Date(event.desiredEventDate) : null;
      if (!desiredDate) return false;
      const daysUntilDate = (desiredDate.getTime() - now.getTime()) / msPerDay;
      return daysUntilDate <= thresholdDays && daysUntilDate >= 0;
    }

    case REMINDER_RULE_TYPES.DATE_APPROACHING_SCHEDULED: {
      // Only applies to scheduled events
      if (event.status !== 'scheduled') return false;
      const scheduledDate = event.scheduledEventDate ? new Date(event.scheduledEventDate) : null;
      if (!scheduledDate) return false;
      const daysUntilDate = (scheduledDate.getTime() - now.getTime()) / msPerDay;
      return daysUntilDate <= thresholdDays && daysUntilDate >= 0;
    }

    case REMINDER_RULE_TYPES.STAFFING_UNMET: {
      // Only applies to scheduled events with staffing needs
      if (event.status !== 'scheduled') return false;
      const scheduledDate = event.scheduledEventDate ? new Date(event.scheduledEventDate) : null;
      if (!scheduledDate) return false;
      const daysUntilDate = (scheduledDate.getTime() - now.getTime()) / msPerDay;
      if (daysUntilDate > thresholdDays || daysUntilDate < 0) return false;

      // Check if staffing needs are unmet
      const driversNeeded = event.driversNeeded || 0;
      const assignedDrivers = event.assignedDriverIds?.length || 0;
      const speakersNeeded = event.speakersNeeded || 0;
      const assignedSpeakers = event.assignedSpeakerIds?.length || 0;
      const volunteersNeeded = event.volunteersNeeded || 0;
      const assignedVolunteers = event.assignedVolunteerIds?.length || 0;
      const vanNeeded = event.vanDriverNeeded && !event.assignedVanDriverId && !event.customVanDriverName;

      const hasUnmetNeeds =
        assignedDrivers < driversNeeded ||
        assignedSpeakers < speakersNeeded ||
        assignedVolunteers < volunteersNeeded ||
        vanNeeded;

      return hasUnmetNeeds;
    }

    case REMINDER_RULE_TYPES.GENERAL_CHECKIN:
    default:
      // General check-in always fires when due (frequency-based only)
      return true;
  }
}

async function sendReminderEmail(
  email: string,
  userName: string,
  orgName: string,
  eventDate: string,
  eventStatus: string,
  eventId: number,
  ruleType: string,
  thresholdDays: number
): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) return false;

  const baseUrl = getAppBaseUrl();
  const eventUrl = `${baseUrl}/dashboard?section=event-requests&eventId=${eventId}`;
  const ruleInfo = RULE_TYPE_LABELS[ruleType] || RULE_TYPE_LABELS[REMINDER_RULE_TYPES.GENERAL_CHECKIN];

  try {
    const msg = {
      to: email,
      from: 'katie@thesandwichproject.org',
      subject: `Reminder: ${ruleInfo.label} - ${orgName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #236383, #007E8C); padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0;">${ruleInfo.label}</h2>
          </div>
          <div style="padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #374151;">Hi ${userName},</p>
            <p style="font-size: 15px; color: #4b5563;">
              ${ruleInfo.getDescription(thresholdDays)}
            </p>
            <div style="background: white; border-left: 4px solid #FBAD3F; padding: 16px; margin: 16px 0; border-radius: 4px;">
              <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1f2937;">${orgName}</p>
              <p style="margin: 0 0 4px 0; font-size: 14px; color: #6b7280;">Event Date: ${eventDate}</p>
              <p style="margin: 0; font-size: 14px; color: #6b7280;">Status: ${eventStatus}</p>
            </div>
            <p style="font-size: 14px; color: #6b7280;">
              Take a moment to review the event and follow up if needed.
            </p>
            <a href="${eventUrl}" style="display: inline-block; background: #007E8C; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 12px 0;">
              View Event Details
            </a>
            <p style="font-size: 12px; color: #9ca3af; margin-top: 16px;">
              You can adjust or turn off these reminders from the alarm icon on the event card.
            </p>
          </div>
          ${EMAIL_FOOTER_HTML}
        </div>
      `,
    };

    await sgMail.send(msg);
    return true;
  } catch (error) {
    logger.error(`Failed to send reminder email to ${email}:`, error);
    return false;
  }
}

async function sendReminderSMS(
  phoneNumber: string,
  orgName: string,
  eventId: number,
  ruleType: string
): Promise<boolean> {
  const baseUrl = getAppBaseUrl();
  const eventUrl = `${baseUrl}/dashboard?section=event-requests&eventId=${eventId}`;
  const ruleInfo = RULE_TYPE_LABELS[ruleType] || RULE_TYPE_LABELS[REMINDER_RULE_TYPES.GENERAL_CHECKIN];
  const message = `TSP Reminder (${ruleInfo.label}): ${orgName} needs attention. View: ${eventUrl}`;

  try {
    const result = await sendTSPFollowupReminderSMS(phoneNumber, message);
    return result.success;
  } catch (error) {
    logger.error('Failed to send reminder SMS:', error);
    return false;
  }
}

export async function processCheckInReminders(): Promise<{
  processed: number;
  sent: number;
  errors: number;
}> {
  const now = new Date();
  let processed = 0;
  let sent = 0;
  let errors = 0;

  try {
    // Get all enabled reminders that are due
    const dueReminders = await db
      .select()
      .from(eventCheckInReminders)
      .where(
        and(
          eq(eventCheckInReminders.enabled, true),
          lte(eventCheckInReminders.nextDueAt, now)
        )
      );

    if (dueReminders.length === 0) {
      return { processed: 0, sent: 0, errors: 0 };
    }

    logger.info(`[CheckInReminders] Processing ${dueReminders.length} due reminders`);

    for (const reminder of dueReminders) {
      processed++;

      try {
        // Get the event request with all fields needed for condition evaluation
        const [event] = await db
          .select()
          .from(eventRequests)
          .where(eq(eventRequests.id, reminder.eventRequestId))
          .limit(1);

        if (!event || event.deletedAt) {
          // Event deleted or doesn't exist - disable reminder
          await db
            .update(eventCheckInReminders)
            .set({ enabled: false, updatedAt: new Date() })
            .where(eq(eventCheckInReminders.id, reminder.id));
          continue;
        }

        // Skip completed/declined events - auto-disable
        if (['completed', 'declined', 'cancelled'].includes(event.status || '')) {
          await db
            .update(eventCheckInReminders)
            .set({ enabled: false, updatedAt: new Date() })
            .where(eq(eventCheckInReminders.id, reminder.id));
          continue;
        }

        // Evaluate whether the rule's condition is met
        const conditionMet = evaluateRuleCondition(
          reminder.ruleType,
          reminder.thresholdDays || 7,
          event
        );

        if (!conditionMet) {
          // Condition not met — reschedule for next check but don't send
          // Condition-based rules recheck daily; frequency-based use their frequency
          const nextDue = isConditionBasedRule(reminder.ruleType)
            ? calculateNextDue('daily')
            : calculateNextDue(reminder.frequency);
          await db
            .update(eventCheckInReminders)
            .set({ nextDueAt: nextDue, updatedAt: new Date() })
            .where(eq(eventCheckInReminders.id, reminder.id));
          continue;
        }

        // Get the user
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, reminder.userId))
          .limit(1);

        if (!user) {
          errors++;
          continue;
        }

        const userName = user.displayName || user.firstName || 'there';
        const orgName = event.organizationName || 'Unknown Organization';
        const eventDate = event.scheduledEventDate
          ? new Date(event.scheduledEventDate).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : event.desiredEventDate
            ? new Date(event.desiredEventDate).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'TBD';
        const eventStatus = event.status || 'unknown';

        let emailSent = false;
        let smsSent = false;

        // Send email if channel includes email
        if (reminder.channel === 'email' || reminder.channel === 'both') {
          const email = user.preferredEmail || user.email;
          if (email) {
            emailSent = await sendReminderEmail(
              email,
              userName,
              orgName,
              eventDate,
              eventStatus,
              event.id,
              reminder.ruleType,
              reminder.thresholdDays || 7
            );
          }
        }

        // Send SMS if channel includes SMS
        if (reminder.channel === 'sms' || reminder.channel === 'both') {
          const metadata = getUserMetadata(user);
          const smsConsent = metadata.smsConsent;
          if (smsConsent?.enabled && smsConsent.phoneNumber) {
            smsSent = await sendReminderSMS(
              smsConsent.phoneNumber,
              orgName,
              event.id,
              reminder.ruleType
            );
          }
        }

        if (emailSent || smsSent) {
          sent++;
        }

        // Update lastSentAt and calculate next due date
        // Condition-based rules use a cooldown after sending to avoid spam;
        // frequency-based rules (general_checkin) use their configured frequency
        const nextDue = isConditionBasedRule(reminder.ruleType)
          ? calculateNextDue('every_3_days') // 3-day cooldown after sending
          : calculateNextDue(reminder.frequency);
        await db
          .update(eventCheckInReminders)
          .set({
            lastSentAt: new Date(),
            nextDueAt: nextDue,
            updatedAt: new Date(),
          })
          .where(eq(eventCheckInReminders.id, reminder.id));
      } catch (error) {
        errors++;
        logger.error(`Error processing reminder ${reminder.id} (type: ${reminder.ruleType}):`, error);
      }
    }

    logger.info(
      `[CheckInReminders] Complete: ${processed} processed, ${sent} sent, ${errors} errors`
    );
  } catch (error) {
    logger.error('[CheckInReminders] Failed to process reminders:', error);
  }

  return { processed, sent, errors };
}
