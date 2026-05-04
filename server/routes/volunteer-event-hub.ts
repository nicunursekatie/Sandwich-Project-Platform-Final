/**
 * Volunteer Event Hub Routes
 *
 * API routes for volunteers and speakers to browse and sign up for events.
 * Includes notification system for coordinators when signups occur.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { eq, and, or, gte, inArray, sql, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  eventRequests,
  eventVolunteers,
  users,
  insertEventVolunteerSchema
} from '@shared/schema';
import { isAuthenticated } from '../auth';
import { PERMISSIONS } from '@shared/auth-utils';
import { hasPermission } from '@shared/unified-auth-utils';
import { logger } from '../utils/production-safe-logger';
import type { AuthenticatedRequest } from '../types/express';
import { EmailNotificationService } from '../services/email-notification-service';
import { getAppBaseUrl } from '../config/constants';
import sgMail from '@sendgrid/mail';
import { EMAIL_FOOTER_HTML } from '../utils/email-footer';
import { getUnfilledCounts, getSpeakerCount, getVolunteerCount, getTotalDriverCount } from '../utils/assignment-utils';

const router = Router();

// Coordinator emails for notifications
const COORDINATOR_EMAILS = [
  'katie@thesandwichproject.org'
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Send notification to coordinators when a volunteer signs up
 */
async function sendVolunteerSignupNotification(
  volunteerName: string,
  volunteerEmail: string,
  eventId: number,
  organizationName: string,
  eventDate: string | null,
  roles: string[],
  notes: string | null
): Promise<void> {
  if (!process.env.SENDGRID_API_KEY) {
    logger.warn('SendGrid not configured - skipping volunteer signup notification');
    return;
  }

  try {
    const baseUrl = getAppBaseUrl();
    const eventUrl = `${baseUrl}/event-requests-v2?eventId=${eventId}`;
    const volunteerHubUrl = `${baseUrl}/volunteer-hub`;

    // Format event date
    const formattedDate = eventDate
      ? new Date(eventDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : 'Date TBD';

    // Format roles for display
    const roleDisplay = roles
      .map((role) => (
        role === 'driver' ? 'Driver'
        : role === 'speaker' ? 'Speaker'
        : role === 'general' ? 'General Volunteer'
        : role
      ))
      .join(', ');

    const msg = {
      to: COORDINATOR_EMAILS,
      from: 'katie@thesandwichproject.org',
      subject: `New Volunteer Signup: ${volunteerName} for ${organizationName} - The Sandwich Project`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #22c55e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .signup-details { background: white; padding: 15px; border-left: 4px solid #22c55e; margin: 15px 0; }
            .event-details { background: #e6f7f9; padding: 12px; border-left: 4px solid #236383; margin: 15px 0; }
            .action-required { background: #FEF3CD; border: 1px solid #FFEEBA; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .btn { display: inline-block; background: #236383; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 10px 5px 10px 0; }
            .btn-secondary { background: #6c757d; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Volunteer Signup!</h1>
            </div>
            <div class="content">
              <p>A volunteer has requested to help at an upcoming event:</p>

              <div class="signup-details">
                <strong>Volunteer:</strong> ${volunteerName}<br>
                <strong>Email:</strong> ${volunteerEmail}<br>
                <strong>Roles Requested:</strong> ${roleDisplay}
                ${notes ? `<br><strong>Notes:</strong> ${notes}` : ''}
              </div>

              <div class="event-details">
                <strong>Event:</strong> ${organizationName}<br>
                <strong>Date:</strong> ${formattedDate}
              </div>

              <div class="action-required">
                <strong>Action Required:</strong><br>
                Please review this signup request and confirm or decline the volunteer's participation.
                Check that the event details haven't changed and that the role is still needed.
              </div>

              <p>
                <a href="${eventUrl}" class="btn">Review Event</a>
                <a href="${volunteerHubUrl}" class="btn btn-secondary">View All Signups</a>
              </p>

              ${EMAIL_FOOTER_HTML}
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
New Volunteer Signup!

A volunteer has requested to help at an upcoming event:

Volunteer: ${volunteerName}
Email: ${volunteerEmail}
Roles Requested: ${roleDisplay}
${notes ? `Notes: ${notes}` : ''}

Event: ${organizationName}
Date: ${formattedDate}

ACTION REQUIRED:
Please review this signup request and confirm or decline the volunteer's participation.
Check that the event details haven't changed and that the role is still needed.

Review Event: ${eventUrl}
View All Signups: ${volunteerHubUrl}

---
The Sandwich Project - Fighting food insecurity one sandwich at a time
      `.trim(),
    };

    await sgMail.send(msg);
    logger.info(`Volunteer signup notification sent to coordinators for event ${eventId}`);
  } catch (error) {
    logger.error('Error sending volunteer signup notification:', error);
  }
}

/**
 * Send confirmation email to volunteer after they sign up (pending approval)
 */
async function sendVolunteerSignupConfirmationEmail(
  volunteerName: string,
  volunteerEmail: string,
  organizationName: string,
  eventDate: string | Date | null,
  eventStartTime: string | null,
  eventEndTime: string | null,
  eventAddress: string | null,
  roles: string[]
): Promise<void> {
  if (!process.env.SENDGRID_API_KEY || !volunteerEmail) {
    return;
  }

  try {
    const formattedDate = eventDate
      ? new Date(eventDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : 'Date TBD';

    const timeDisplay = eventStartTime
      ? `${eventStartTime}${eventEndTime ? ` – ${eventEndTime}` : ''}`
      : null;

    const roleDisplay = roles
      .map((role) => (
        role === 'driver' ? 'Driver'
        : role === 'speaker' ? 'Speaker'
        : role === 'general' ? 'General Volunteer'
        : role
      ))
      .join(', ');

    const msg = {
      to: volunteerEmail,
      from: 'katie@thesandwichproject.org',
      subject: `Signup Received — ${organizationName} on ${formattedDate}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #236383; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .event-details { background: #e6f7f9; padding: 15px; border-left: 4px solid #236383; margin: 15px 0; }
            .status-note { background: #FEF3CD; border: 1px solid #FFEEBA; padding: 15px; border-radius: 6px; margin: 15px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Thanks for Signing Up, ${volunteerName}!</h1>
            </div>
            <div class="content">
              <p>We've received your volunteer signup request for the following event:</p>

              <div class="event-details">
                <strong>Event:</strong> ${organizationName}<br>
                <strong>Date:</strong> ${formattedDate}<br>
                ${timeDisplay ? `<strong>Time:</strong> ${timeDisplay}<br>` : ''}
                ${eventAddress ? `<strong>Location:</strong> ${eventAddress}<br>` : ''}
                <strong>Role${roles.length > 1 ? 's' : ''}:</strong> ${roleDisplay}
              </div>

              <div class="status-note">
                <strong>What happens next?</strong><br>
                A coordinator will review your signup and confirm your participation. You'll receive another email once you're confirmed.
              </div>

              <p>Thank you for volunteering with The Sandwich Project! Your help makes a real difference in fighting food insecurity in our community.</p>

              ${EMAIL_FOOTER_HTML}
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Thanks for Signing Up, ${volunteerName}!

We've received your volunteer signup request:

Event: ${organizationName}
Date: ${formattedDate}
${timeDisplay ? `Time: ${timeDisplay}` : ''}
${eventAddress ? `Location: ${eventAddress}` : ''}
Role${roles.length > 1 ? 's' : ''}: ${roleDisplay}

WHAT HAPPENS NEXT:
A coordinator will review your signup and confirm your participation. You'll receive another email once you're confirmed.

Thank you for volunteering with The Sandwich Project!

---
The Sandwich Project - Fighting food insecurity one sandwich at a time
      `.trim(),
    };

    await sgMail.send(msg);
    logger.info(`Volunteer signup confirmation email sent to ${volunteerEmail}`);
  } catch (error) {
    logger.error('Error sending volunteer signup confirmation email:', error);
  }
}

/**
 * Send confirmation email to volunteer when their signup is approved
 */
async function sendVolunteerApprovalEmail(
  volunteerName: string,
  volunteerEmail: string,
  organizationName: string,
  eventDate: string | Date | null,
  eventStartTime: string | null,
  eventEndTime: string | null,
  eventAddress: string | null,
  role: string | null
): Promise<void> {
  if (!process.env.SENDGRID_API_KEY || !volunteerEmail) {
    return;
  }

  try {
    const formattedDate = eventDate
      ? new Date(eventDate).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : 'Date TBD';

    const timeDisplay = eventStartTime
      ? `${eventStartTime}${eventEndTime ? ` – ${eventEndTime}` : ''}`
      : null;

    const roleDisplay = role === 'driver' ? 'Driver'
      : role === 'speaker' ? 'Speaker'
      : role === 'general' ? 'General Volunteer'
      : role || 'Volunteer';

    const msg = {
      to: volunteerEmail,
      from: 'katie@thesandwichproject.org',
      subject: `You're Confirmed — ${organizationName} on ${formattedDate}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #22c55e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .event-details { background: #e6f7f9; padding: 15px; border-left: 4px solid #22c55e; margin: 15px 0; }
            .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>You're Confirmed!</h1>
            </div>
            <div class="content">
              <p>Great news, ${volunteerName}! Your volunteer signup has been confirmed. Here are the details:</p>

              <div class="event-details">
                <strong>Event:</strong> ${organizationName}<br>
                <strong>Date:</strong> ${formattedDate}<br>
                ${timeDisplay ? `<strong>Time:</strong> ${timeDisplay}<br>` : ''}
                ${eventAddress ? `<strong>Location:</strong> ${eventAddress}<br>` : ''}
                <strong>Your Role:</strong> ${roleDisplay}
              </div>

              <p>We'll send you a reminder before the event. If your plans change and you can no longer make it, please let us know as soon as possible so we can find a replacement.</p>

              <p>Thank you for making a difference with The Sandwich Project!</p>

              ${EMAIL_FOOTER_HTML}
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
You're Confirmed!

Great news, ${volunteerName}! Your volunteer signup has been confirmed.

Event: ${organizationName}
Date: ${formattedDate}
${timeDisplay ? `Time: ${timeDisplay}` : ''}
${eventAddress ? `Location: ${eventAddress}` : ''}
Your Role: ${roleDisplay}

We'll send you a reminder before the event. If your plans change, please let us know so we can find a replacement.

Thank you for making a difference with The Sandwich Project!

---
The Sandwich Project - Fighting food insecurity one sandwich at a time
      `.trim(),
    };

    await sgMail.send(msg);
    logger.info(`Volunteer approval confirmation email sent to ${volunteerEmail}`);
  } catch (error) {
    logger.error('Error sending volunteer approval confirmation email:', error);
  }
}

// ============================================================================
// Public Event Browsing Routes (for volunteers)
// ============================================================================

/**
 * Get all events available for volunteer signup
 * Returns scheduled and completed events (not new requests or in-process ones)
 */
router.get('/available-events', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Show scheduled + completed events to volunteers
    // Use Eastern Time to determine "today" since server may be in UTC
    // (at 7pm+ EST, UTC has already rolled to the next day)
    const now = new Date();
    const easternNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const today = new Date(easternNow.getFullYear(), easternNow.getMonth(), easternNow.getDate());

    logger.log(`[VolunteerHub] Fetching scheduled events`);

    const events = await db
      .select()
      .from(eventRequests)
      .where(
        and(
          eq(eventRequests.showOnVolunteerHub, true),
          or(
            eq(eventRequests.status, 'scheduled'),
            eq(eventRequests.status, 'rescheduled')
          )
        )
      )
      .orderBy(eventRequests.scheduledEventDate);

    logger.log(`[VolunteerHub] Found ${events.length} total events with scheduled/completed status`);

    // Filter to events with dates today or in the future
    // Include events with no date set (they're still active)
    const upcomingEvents = events.filter(event => {
      const eventDate = event.scheduledEventDate || event.desiredEventDate;
      if (!eventDate) {
        // Include events without dates - they're still active
        return true;
      }
      const eventDateObj = new Date(eventDate);
      return eventDateObj >= today;
    });

    logger.log(`[VolunteerHub] ${upcomingEvents.length} events are upcoming or have no date set`);

    // Calculate unfilled needs for each event using centralized utils
    const eventsWithNeeds = upcomingEvents.map(event => {
      const counts = getUnfilledCounts(event);

      return {
        id: event.id,
        organizationName: event.organizationName,
        organizationCategory: event.organizationCategory,
        department: event.department,
        eventAddress: event.eventAddress,
        city: event.city,
        state: event.state,
        zipCode: event.zipCode,
        latitude: event.latitude,
        longitude: event.longitude,
        scheduledEventDate: event.scheduledEventDate,
        desiredEventDate: event.desiredEventDate,
        eventStartTime: event.eventStartTime,
        eventEndTime: event.eventEndTime,
        estimatedSandwichCount: event.estimatedSandwichCount,
        status: event.status,
        // Unfilled needs from centralized utils
        ...counts,
        // Additional info for volunteers
        vanDriverNeeded: event.vanDriverNeeded && !event.assignedVanDriverId && !event.isDhlVan,
        selfTransport: event.selfTransport,
        pickupTime: event.pickupTime,
        eventNotes: event.notes, // Public notes about the event
      };
    });

    // Optionally filter to only events with unfilled needs
    const filterByNeeds = req.query.needsOnly === 'true';
    const filteredEvents = filterByNeeds
      ? eventsWithNeeds.filter(e => e.hasUnfilledNeeds)
      : eventsWithNeeds;

    res.json(filteredEvents);
  } catch (error) {
    logger.error('Error fetching available events:', error);
    res.status(500).json({ error: 'Failed to fetch available events' });
  }
});

/**
 * Get details for a specific event (volunteer view)
 */
router.get('/event/:eventId', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const eventId = parseInt(req.params.eventId);

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ error: 'Valid event ID required' });
    }

    const [event] = await db
      .select()
      .from(eventRequests)
      .where(eq(eventRequests.id, eventId))
      .limit(1);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get existing signups for this event
    const existingSignups = await db
      .select()
      .from(eventVolunteers)
      .where(eq(eventVolunteers.eventRequestId, eventId));

    // Get confirmed volunteer names
    const confirmedVolunteers = existingSignups
      .filter(v => v.status === 'confirmed' || v.status === 'assigned')
      .map(v => ({
        name: v.volunteerName || 'Anonymous',
        role: v.role,
      }));

    // Calculate needs using centralized utils
    const counts = getUnfilledCounts(event);

    res.json({
      id: event.id,
      organizationName: event.organizationName,
      organizationCategory: event.organizationCategory,
      department: event.department,
      eventAddress: event.eventAddress,
      city: event.city,
      state: event.state,
      zipCode: event.zipCode,
      latitude: event.latitude,
      longitude: event.longitude,
      scheduledEventDate: event.scheduledEventDate,
      desiredEventDate: event.desiredEventDate,
      eventStartTime: event.eventStartTime,
      eventEndTime: event.eventEndTime,
      estimatedSandwichCount: event.estimatedSandwichCount,
      speakersNeeded: counts.speakersNeeded,
      speakersUnfilled: counts.speakersUnfilled,
      volunteersNeeded: counts.volunteersNeeded,
      volunteersUnfilled: counts.volunteersUnfilled,
      driversNeeded: counts.driversNeeded,
      driversUnfilled: counts.driversUnfilled,
      vanDriverNeeded: event.vanDriverNeeded && !event.assignedVanDriverId && !event.isDhlVan,
      selfTransport: event.selfTransport,
      pickupTime: event.pickupTime,
      eventNotes: event.notes,
      confirmedVolunteers,
      pendingSignups: existingSignups.filter(v => v.status === 'pending').length,
    });
  } catch (error) {
    logger.error('Error fetching event details:', error);
    res.status(500).json({ error: 'Failed to fetch event details' });
  }
});

// ============================================================================
// Volunteer Signup Routes
// ============================================================================

/**
 * Request to volunteer for an event
 * Creates a pending signup that coordinators must confirm
 */
router.post('/signup/:eventId', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const callerId = req.user?.id;

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ error: 'Valid event ID required' });
    }

    if (!callerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Determine who this signup is FOR. Defaults to the caller (self-signup).
    // If targetUserId is supplied and differs from the caller, require the
    // assign-others permission — this is how coordinators staff events from
    // the Volunteer Hub.
    const { role, roles, notes, targetUserId: rawTargetUserId } = req.body;
    const targetUserId =
      typeof rawTargetUserId === 'string' && rawTargetUserId.trim() !== ''
        ? rawTargetUserId.trim()
        : callerId;
    const isAssigningOther = targetUserId !== callerId;

    if (isAssigningOther) {
      const canAssignOthers = hasPermission(req.user, PERMISSIONS.EVENT_REQUESTS_ASSIGN_OTHERS);
      if (!canAssignOthers) {
        return res.status(403).json({
          error: 'You do not have permission to assign other users to events.',
        });
      }
    }

    // Get target user details (the person being assigned / signing up)
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get event details
    const [event] = await db
      .select()
      .from(eventRequests)
      .where(eq(eventRequests.id, eventId))
      .limit(1);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const requestedRoles = Array.isArray(roles) ? roles : (role ? [role] : []);
    const normalizedRoles = Array.from(new Set(requestedRoles.filter(Boolean)));

    if (normalizedRoles.length === 0) {
      return res.status(400).json({ error: 'At least one role is required (driver, speaker, or general)' });
    }

    const invalidRoles = normalizedRoles.filter(r => !['driver', 'speaker', 'general'].includes(r));
    if (invalidRoles.length > 0) {
      return res.status(400).json({ error: 'Valid roles are driver, speaker, or general' });
    }

    // Check if target user already signed up for this event with any requested role
    const existingSignups = await db
      .select()
      .from(eventVolunteers)
      .where(
        and(
          eq(eventVolunteers.eventRequestId, eventId),
          eq(eventVolunteers.volunteerUserId, targetUserId),
          inArray(eventVolunteers.role, normalizedRoles)
        )
      )
      .limit(10);

    if (existingSignups.length > 0) {
      const existingRoles = existingSignups.map((signup) => signup.role).join(', ');
      return res.status(400).json({
        error: isAssigningOther
          ? `${user.firstName || 'That user'} is already signed up for this event as: ${existingRoles}`
          : `You have already signed up for this event as: ${existingRoles}`,
        existingSignup: existingSignups[0]
      });
    }

    const volunteerName = user.displayName ||
      `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
      user.email?.split('@')[0] ||
      'Unknown';

    // Coordinator assignments are pre-approved with status='assigned' (matches
    // the existing vocabulary used by the PATCH /signup/:id/status route).
    // Self-signups go to 'pending' for later coordinator review.
    const status = isAssigningOther ? 'assigned' : 'pending';

    // Driver assignments require DRIVER_SIGNUP_APPROVE (same rule the approval
    // route enforces). A coordinator without driver-approval can't assign
    // someone as a driver.
    if (isAssigningOther && normalizedRoles.includes('driver')) {
      const canApproveDrivers = hasPermission(req.user, PERMISSIONS.DRIVER_SIGNUP_APPROVE);
      if (!canApproveDrivers) {
        return res.status(403).json({
          error: 'You need driver approval permission to assign someone as a driver.',
        });
      }
    }

    const signedUpAt = new Date();
    const newSignups = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(eventVolunteers)
        .values(
          normalizedRoles.map((requestedRole) => ({
            eventRequestId: eventId,
            volunteerUserId: targetUserId,
            volunteerName: volunteerName,
            volunteerEmail: user.preferredEmail || user.email,
            volunteerPhone: user.phone,
            role: requestedRole,
            status,
            notes: notes || null,
            signedUpAt,
            assignedBy: isAssigningOther ? callerId : null,
            confirmedAt: isAssigningOther ? signedUpAt : null,
          }))
        )
        .returning();

      // Mirror assignment into eventRequests.assigned*Ids so the Event Request
      // Management tab (and the rest of the app) reflects it immediately.
      // This matches the PATCH /signup/:id/status mirror logic so the data
      // shape stays consistent whether a coordinator assigns via the Hub or
      // approves a self-signup.
      if (isAssigningOther) {
        const [eventRow] = await tx
          .select({
            assignedDriverIds: eventRequests.assignedDriverIds,
            assignedSpeakerIds: eventRequests.assignedSpeakerIds,
            assignedVolunteerIds: eventRequests.assignedVolunteerIds,
          })
          .from(eventRequests)
          .where(eq(eventRequests.id, eventId))
          .limit(1);

        if (eventRow) {
          const addUnique = (ids?: string[] | null) =>
            Array.from(new Set([...(ids || []), targetUserId]));
          const updates: {
            assignedDriverIds?: string[];
            assignedSpeakerIds?: string[];
            assignedVolunteerIds?: string[];
          } = {};
          if (normalizedRoles.includes('driver')) {
            updates.assignedDriverIds = addUnique(eventRow.assignedDriverIds);
          }
          if (normalizedRoles.includes('speaker')) {
            updates.assignedSpeakerIds = addUnique(eventRow.assignedSpeakerIds);
          }
          if (normalizedRoles.includes('general')) {
            updates.assignedVolunteerIds = addUnique(eventRow.assignedVolunteerIds);
          }
          if (Object.keys(updates).length > 0) {
            await tx
              .update(eventRequests)
              .set(updates)
              .where(eq(eventRequests.id, eventId));
          }
        }
      }

      return inserted;
    });

    if (isAssigningOther) {
      // Assignment flow: notify the assignee, skip the coordinator
      // pending-review blast (there's nothing to review — it's already approved).
      await sendVolunteerSignupConfirmationEmail(
        volunteerName,
        user.preferredEmail || user.email || '',
        event.organizationName || 'Unknown Organization',
        event.scheduledEventDate || event.desiredEventDate,
        event.eventStartTime,
        event.eventEndTime,
        event.eventAddress,
        normalizedRoles
      );
      logger.info(
        `Volunteer assignment created by ${callerId}: ${volunteerName} -> event ${eventId} as ${normalizedRoles.join(', ')}`
      );
    } else {
      // Self-signup flow: notify coordinators (approval needed) and confirm to the volunteer
      await sendVolunteerSignupNotification(
        volunteerName,
        user.preferredEmail || user.email || '',
        eventId,
        event.organizationName || 'Unknown Organization',
        event.scheduledEventDate || event.desiredEventDate,
        normalizedRoles,
        notes
      );
      await sendVolunteerSignupConfirmationEmail(
        volunteerName,
        user.preferredEmail || user.email || '',
        event.organizationName || 'Unknown Organization',
        event.scheduledEventDate || event.desiredEventDate,
        event.eventStartTime,
        event.eventEndTime,
        event.eventAddress,
        normalizedRoles
      );
      logger.info(`Volunteer signup created: ${volunteerName} for event ${eventId} as ${normalizedRoles.join(', ')}`);
    }

    res.status(201).json({
      success: true,
      message: isAssigningOther
        ? `${volunteerName} has been assigned to this event.`
        : 'Your signup request has been submitted. A coordinator will confirm your participation.',
      signups: newSignups,
    });
  } catch (error) {
    logger.error('Error creating volunteer signup:', error);
    res.status(500).json({ error: 'Failed to submit signup request' });
  }
});

/**
 * Cancel a volunteer signup
 */
router.delete('/signup/:signupId', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const signupId = parseInt(req.params.signupId);
    const userId = req.user?.id;

    if (!signupId || isNaN(signupId)) {
      return res.status(400).json({ error: 'Valid signup ID required' });
    }

    // Get the signup
    const [signup] = await db
      .select()
      .from(eventVolunteers)
      .where(eq(eventVolunteers.id, signupId))
      .limit(1);

    if (!signup) {
      return res.status(404).json({ error: 'Signup not found' });
    }

    // Only allow user to cancel their own signup (or coordinators)
    if (signup.volunteerUserId !== userId) {
      // Check if user is a coordinator (has admin or coordinator role)
      // For now, allow only the volunteer themselves
      return res.status(403).json({ error: 'You can only cancel your own signups' });
    }

    await db
      .delete(eventVolunteers)
      .where(eq(eventVolunteers.id, signupId));

    logger.info(`Volunteer signup cancelled: ${signupId} by user ${userId}`);

    res.json({ success: true, message: 'Signup cancelled successfully' });
  } catch (error) {
    logger.error('Error cancelling volunteer signup:', error);
    res.status(500).json({ error: 'Failed to cancel signup' });
  }
});

/**
 * Get current user's volunteer signups
 */
router.get('/my-signups', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const signups = await db
      .select({
        signup: eventVolunteers,
        event: eventRequests,
      })
      .from(eventVolunteers)
      .innerJoin(eventRequests, eq(eventVolunteers.eventRequestId, eventRequests.id))
      .where(eq(eventVolunteers.volunteerUserId, userId))
      .orderBy(desc(eventVolunteers.signedUpAt));

    const enrichedSignups = signups.map(({ signup, event }) => ({
      ...signup,
      event: {
        id: event.id,
        organizationName: event.organizationName,
        scheduledEventDate: event.scheduledEventDate,
        desiredEventDate: event.desiredEventDate,
        eventStartTime: event.eventStartTime,
        eventEndTime: event.eventEndTime,
        eventAddress: event.eventAddress,
        city: event.city,
        state: event.state,
        status: event.status,
      },
    }));

    res.json(enrichedSignups);
  } catch (error) {
    logger.error('Error fetching user signups:', error);
    res.status(500).json({ error: 'Failed to fetch your signups' });
  }
});

// ============================================================================
// Coordinator Management Routes
// ============================================================================

/**
 * Get volunteer signups (for coordinators)
 * By default returns only pending signups. Pass ?all=true for all signups.
 */
router.get('/pending-signups', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const showAll = req.query.all === 'true';

    const query = db
      .select({
        signup: eventVolunteers,
        event: eventRequests,
      })
      .from(eventVolunteers)
      .innerJoin(eventRequests, eq(eventVolunteers.eventRequestId, eventRequests.id));

    const signups = showAll
      ? await query.orderBy(desc(eventVolunteers.signedUpAt))
      : await query.where(eq(eventVolunteers.status, 'pending')).orderBy(desc(eventVolunteers.signedUpAt));

    const enrichedSignups = signups.map(({ signup, event }) => ({
      ...signup,
      event: {
        id: event.id,
        organizationName: event.organizationName,
        scheduledEventDate: event.scheduledEventDate,
        desiredEventDate: event.desiredEventDate,
        eventStartTime: event.eventStartTime,
        status: event.status,
      },
    }));

    res.json(enrichedSignups);
  } catch (error) {
    logger.error('Error fetching pending signups:', error);
    res.status(500).json({ error: 'Failed to fetch pending signups' });
  }
});

/**
 * Confirm or decline a volunteer signup (for coordinators)
 */
router.patch('/signup/:signupId/status', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const signupId = parseInt(req.params.signupId);
    const { status, notes } = req.body;
    const coordinatorId = req.user?.id;

    if (!signupId || isNaN(signupId)) {
      return res.status(400).json({ error: 'Valid signup ID required' });
    }

    if (!status || !['confirmed', 'declined', 'assigned'].includes(status)) {
      return res.status(400).json({ error: 'Valid status required (confirmed, declined, or assigned)' });
    }

    const [signup] = await db
      .select()
      .from(eventVolunteers)
      .where(eq(eventVolunteers.id, signupId))
      .limit(1);

    if (!signup) {
      return res.status(404).json({ error: 'Signup not found' });
    }

    // Driver signups require DRIVER_SIGNUP_APPROVE permission
    if (signup.role === 'driver' && (status === 'confirmed' || status === 'assigned')) {
      if (!hasPermission(req.user, PERMISSIONS.DRIVER_SIGNUP_APPROVE)) {
        return res.status(403).json({ error: 'DRIVER_SIGNUP_APPROVE permission required to approve driver signups' });
      }
    }

    const shouldAssignVolunteer = (status === 'confirmed' || status === 'assigned') && !!signup.volunteerUserId;

    // Wrap assignment + status update in a transaction to prevent race conditions
    // when two concurrent approvals read and write the same event assignment arrays.
    const effectiveStatus = shouldAssignVolunteer ? 'assigned' : status;
    const isConfirmedOrAssigned = effectiveStatus === 'confirmed' || effectiveStatus === 'assigned';

    let updatedSignup: typeof signup | undefined;

    await db.transaction(async (tx) => {
      // If approved, mirror manual assignment behavior by adding the volunteer to the event assignment arrays.
      if (shouldAssignVolunteer) {
        const [event] = await tx
          .select({
            id: eventRequests.id,
            assignedDriverIds: eventRequests.assignedDriverIds,
            assignedSpeakerIds: eventRequests.assignedSpeakerIds,
            assignedVolunteerIds: eventRequests.assignedVolunteerIds,
          })
          .from(eventRequests)
          .where(eq(eventRequests.id, signup.eventRequestId))
          .limit(1);

        if (!event) {
          const error = new Error('Event not found for this signup') as Error & { statusCode?: number };
          error.statusCode = 404;
          throw error;
        }

        const assignedUserId = signup.volunteerUserId as string;
        const addUnique = (ids?: string[] | null) =>
          Array.from(new Set([...(ids || []), assignedUserId]));

        const assignmentUpdates: {
          assignedDriverIds?: string[];
          assignedSpeakerIds?: string[];
          assignedVolunteerIds?: string[];
        } = {};

        if (signup.role === 'driver') {
          assignmentUpdates.assignedDriverIds = addUnique(event.assignedDriverIds);
        } else if (signup.role === 'speaker') {
          assignmentUpdates.assignedSpeakerIds = addUnique(event.assignedSpeakerIds);
        } else {
          assignmentUpdates.assignedVolunteerIds = addUnique(event.assignedVolunteerIds);
        }

        await tx
          .update(eventRequests)
          .set(assignmentUpdates)
          .where(eq(eventRequests.id, signup.eventRequestId));
      }

      // Update the signup status
      const [signupRow] = await tx
        .update(eventVolunteers)
        .set({
          status: effectiveStatus,
          confirmedAt: isConfirmedOrAssigned ? new Date() : null,
          assignedBy: coordinatorId,
          notes: notes || signup.notes,
          updatedAt: new Date(),
        })
        .where(eq(eventVolunteers.id, signupId))
        .returning();

      updatedSignup = signupRow;
    });

    // Send confirmation email to volunteer when approved
    if (isConfirmedOrAssigned && signup.volunteerEmail) {
      try {
        const [event] = await db
          .select()
          .from(eventRequests)
          .where(eq(eventRequests.id, signup.eventRequestId))
          .limit(1);

        if (event) {
          await sendVolunteerApprovalEmail(
            signup.volunteerName || 'Volunteer',
            signup.volunteerEmail,
            event.organizationName || 'Unknown Organization',
            event.scheduledEventDate || event.desiredEventDate,
            event.eventStartTime,
            event.eventEndTime,
            event.eventAddress,
            signup.role
          );
        }
      } catch (emailError) {
        logger.error('Failed to send volunteer approval email, but signup was still approved:', emailError);
      }
    }

    logger.info(`Volunteer signup ${signupId} status updated to ${effectiveStatus} by ${coordinatorId}`);

    res.json({
      success: true,
      message: `Signup ${effectiveStatus} successfully`,
      signup: updatedSignup,
    });
  } catch (error) {
    if (error instanceof Error && (error as Error & { statusCode?: number }).statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    logger.error('Error updating signup status:', error);
    res.status(500).json({ error: 'Failed to update signup status' });
  }
});

/**
 * Get all signups for a specific event (for coordinators)
 */
router.get('/event/:eventId/signups', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const eventId = parseInt(req.params.eventId);

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ error: 'Valid event ID required' });
    }

    const signups = await db
      .select()
      .from(eventVolunteers)
      .where(eq(eventVolunteers.eventRequestId, eventId))
      .orderBy(desc(eventVolunteers.signedUpAt));

    res.json(signups);
  } catch (error) {
    logger.error('Error fetching event signups:', error);
    res.status(500).json({ error: 'Failed to fetch event signups' });
  }
});

export default router;
