/**
 * Check-In Reminder Processing Service
 *
 * Processes user-configured recurring reminders for event requests.
 * Users (TSP contacts) can toggle reminders on/off per event, set frequency
 * (daily, every 3 days, weekly, biweekly), and choose channel (email, SMS, both).
 */

import sgMail from '@sendgrid/mail';
import { db } from '../db';
import { eventCheckInReminders, eventRequests, users } from '@shared/schema';
import { and, eq, lte, isNotNull, isNull } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';
import { EMAIL_FOOTER_HTML } from '../utils/email-footer';
import { getAppBaseUrl } from '../config/constants';
import { getUserMetadata } from '@shared/types';
import { sendTSPFollowupReminderSMS } from '../sms-service';

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

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

async function sendCheckInEmail(
  email: string,
  userName: string,
  orgName: string,
  eventDate: string,
  eventStatus: string,
  eventId: number
): Promise<boolean> {
  if (!process.env.SENDGRID_API_KEY) return false;

  const baseUrl = getAppBaseUrl();
  const eventUrl = `${baseUrl}/dashboard?section=event-requests&eventId=${eventId}`;

  try {
    const msg = {
      to: email,
      from: 'katie@thesandwichproject.org',
      subject: `Check-in Reminder: ${orgName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #236383, #007E8C); padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: white; margin: 0;">Check-In Reminder</h2>
          </div>
          <div style="padding: 24px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p style="font-size: 16px; color: #374151;">Hi ${userName},</p>
            <p style="font-size: 15px; color: #4b5563;">
              This is your scheduled check-in reminder for:
            </p>
            <div style="background: white; border-left: 4px solid #FBAD3F; padding: 16px; margin: 16px 0; border-radius: 4px;">
              <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1f2937;">${orgName}</p>
              <p style="margin: 0 0 4px 0; font-size: 14px; color: #6b7280;">Event Date: ${eventDate}</p>
              <p style="margin: 0; font-size: 14px; color: #6b7280;">Status: ${eventStatus}</p>
            </div>
            <p style="font-size: 14px; color: #6b7280;">
              Take a moment to review the event status and follow up if needed.
            </p>
            <a href="${eventUrl}" style="display: inline-block; background: #007E8C; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 12px 0;">
              View Event Details
            </a>
            <p style="font-size: 12px; color: #9ca3af; margin-top: 16px;">
              You can adjust or turn off these reminders from the event detail page.
            </p>
          </div>
          ${EMAIL_FOOTER_HTML}
        </div>
      `,
    };

    await sgMail.send(msg);
    return true;
  } catch (error) {
    logger.error(`Failed to send check-in reminder email to ${email}:`, error);
    return false;
  }
}

async function sendCheckInSMS(
  phoneNumber: string,
  orgName: string,
  eventId: number
): Promise<boolean> {
  const baseUrl = getAppBaseUrl();
  const eventUrl = `${baseUrl}/dashboard?section=event-requests&eventId=${eventId}`;
  const message = `TSP Check-In: Time to follow up on ${orgName}. View details: ${eventUrl}`;

  try {
    const result = await sendTSPFollowupReminderSMS(phoneNumber, message);
    return result.success;
  } catch (error) {
    logger.error('Failed to send check-in reminder SMS:', error);
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
        // Get the event request
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
            emailSent = await sendCheckInEmail(
              email,
              userName,
              orgName,
              eventDate,
              eventStatus,
              event.id
            );
          }
        }

        // Send SMS if channel includes SMS
        if (reminder.channel === 'sms' || reminder.channel === 'both') {
          const metadata = getUserMetadata(user);
          const smsConsent = metadata.smsConsent;
          if (
            smsConsent?.enabled &&
            smsConsent.phoneNumber
          ) {
            smsSent = await sendCheckInSMS(
              smsConsent.phoneNumber,
              orgName,
              event.id
            );
          }
        }

        if (emailSent || smsSent) {
          sent++;
        }

        // Update lastSentAt and calculate next due date
        const nextDue = calculateNextDue(reminder.frequency);
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
        logger.error(`Error processing check-in reminder ${reminder.id}:`, error);
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
