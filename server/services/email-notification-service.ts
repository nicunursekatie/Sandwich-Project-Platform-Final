import sgMail from '@sendgrid/mail';
import { db } from '../db';
import { users, eventRequests } from '@shared/schema';
import { eq, or, like, sql, inArray } from 'drizzle-orm';
import { EMAIL_FOOTER_HTML } from '../utils/email-footer';
import { logger } from '../utils/production-safe-logger';
import { getUserMetadata } from '@shared/types';
import { sendChatMentionSMS, sendTSPContactAssignmentSMS, sendTeamBoardAssignmentSMS, sendEventCommentSMS } from '../sms-service';

// Initialize SendGrid
if (!process.env.SENDGRID_API_KEY) {
  logger.warn(
    'SENDGRID_API_KEY not found - email notifications will be disabled'
  );
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

export interface ChatMentionNotification {
  mentionedUserId: string;
  mentionedUserEmail: string;
  mentionedUserName: string;
  senderName: string;
  senderEmail: string;
  channel: string;
  messageContent: string;
  messageId: number;
}

export class EmailNotificationService {
  /**
   * Detect @mentions in chat message content
   * Supports formats like @username, @"display name", @email@domain.com
   *
   * Uses a single combined regex to prevent overlapping matches.
   * Priority order: quoted names > email addresses > simple usernames
   */
  static detectMentions(content: string): string[] {
    const mentions: string[] = [];

    // Combined regex with alternation to prevent overlapping matches
    // Priority: 1) Quoted names 2) Email addresses 3) Simple usernames
    const mentionRegex = /@(?:"([^"]+)"|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})|([a-zA-Z0-9._-]+))/g;

    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      // Extract the matched mention from whichever group captured it
      const mention = match[1] || match[2] || match[3];
      if (mention) {
        mentions.push(mention);
      }
    }

    return [...new Set(mentions)]; // Remove duplicates
  }

  /**
   * Find users mentioned in a message and return their details
   */
  static async findMentionedUsers(mentions: string[]): Promise<
    Array<{
      id: string;
      email: string;
      displayName: string | null;
      firstName: string | null;
      lastName: string | null;
    }>
  > {
    if (mentions.length === 0) return [];

    try {
      // Lowercase all mentions for case-insensitive matching
      const lowerMentions = mentions.map(m => m.toLowerCase());

      // Use SQL WHERE clause to filter at database level (not in JavaScript!)
      // This prevents loading all users into memory
      const allMentionedUsers = await db
        .select()
        .from(users)
        .where(
          or(
            sql`LOWER(${users.email}) = ANY(${lowerMentions})`,
            sql`LOWER(${users.displayName}) = ANY(${lowerMentions})`,
            sql`LOWER(${users.firstName}) = ANY(${lowerMentions})`,
            sql`LOWER(${users.lastName}) = ANY(${lowerMentions})`
          )
        );

      // Filter and cast to ensure email is non-null
      return allMentionedUsers.filter((user): user is typeof user & { email: string } => 
        user.email !== null && user.email !== undefined
      );
    } catch (error) {
      logger.error('Error finding mentioned users:', error);
      return [];
    }
  }

  /**
   * Send email notification for chat mentions
   */
  static async sendChatMentionNotification(
    notification: ChatMentionNotification
  ): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.log('SendGrid not configured - skipping email notification');
      return false;
    }

    try {
      const msg = {
        to: notification.mentionedUserEmail,
        from: 'katie@thesandwichproject.org',
        subject: `You were mentioned in ${notification.channel} chat - The Sandwich Project`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #236383; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
              .message-box { background: white; padding: 15px; border-left: 4px solid #236383; margin: 15px 0; }
              .btn { display: inline-block; background: #236383; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 15px 0; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>💬 You were mentioned in chat!</h1>
              </div>
              <div class="content">
                <p>Hello ${notification.mentionedUserName}!</p>
                <p><strong>${
                  notification.senderName
                }</strong> mentioned you in the <strong>#${
                  notification.channel
                }</strong> chat room:</p>
                
                <div class="message-box">
                  "${notification.messageContent}"
                </div>
                
                <p>Click the button below to join the conversation:</p>
                <a href="${this.getChatUrl(
                  notification.channel
                )}" class="btn">Join Chat Room</a>
                
                <div class="footer">
                  <p>This notification was sent because you were mentioned in a chat message.</p>
                  <p>The Sandwich Project - Building community through food assistance</p>
                  <p style="font-size: 11px; color: #888;">To unsubscribe from these emails, please contact us at <a href="mailto:katie@thesandwichproject.org" style="color: #236383;">katie@thesandwichproject.org</a> or reply STOP.</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
Hello ${notification.mentionedUserName}!

${notification.senderName} mentioned you in the #${
          notification.channel
        } chat room:

"${notification.messageContent}"

Join the conversation: ${this.getChatUrl(notification.channel)}

---
The Sandwich Project - Building community through food assistance

To unsubscribe from these emails, please contact us at katie@thesandwichproject.org or reply STOP.
        `.trim(),
      };

      await sgMail.send(msg);
      logger.log(
        `Chat mention notification sent to ${notification.mentionedUserEmail}`
      );

      // Send SMS notification if user has opted in
      try {
        const mentionedUser = await db.select().from(users).where(eq(users.id, notification.mentionedUserId)).limit(1);
        if (mentionedUser && mentionedUser.length > 0) {
          const metadata = getUserMetadata(mentionedUser[0]);
          const smsConsent = metadata.smsConsent;
          if (smsConsent?.status === 'confirmed' && smsConsent.enabled && smsConsent.phoneNumber) {
            const messagePreview = notification.messageContent.length > 50 
              ? notification.messageContent.substring(0, 50) + '...' 
              : notification.messageContent;
            const chatUrl = this.getChatUrl(notification.channel);
            await sendChatMentionSMS(
              smsConsent.phoneNumber,
              notification.mentionedUserName,
              notification.senderName,
              notification.channel,
              messagePreview,
              chatUrl
            );
            logger.log(`Chat mention SMS sent to ${smsConsent.phoneNumber}`);
          }
        }
      } catch (smsError) {
        logger.error('Error sending chat mention SMS (email still succeeded):', smsError);
      }

      return true;
    } catch (error) {
      logger.error('Error sending chat mention notification:', error);
      return false;
    }
  }

  /**
   * Send email notification when a user is assigned as TSP contact for an event
   */
  static async sendTspContactAssignmentNotification(
    userId: string,
    eventId: number,
    organizationName: string,
    eventDate: Date | string | null
  ): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.log('SendGrid not configured - skipping TSP contact assignment notification');
      return false;
    }

    try {
      // Fetch user details from database
      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      
      if (!user || user.length === 0 || !user[0].email) {
        logger.warn(`User ${userId} not found or has no email - cannot send TSP contact notification`);
        return false;
      }

      // Use preferred email if available, otherwise use regular email
      const userEmail = user[0].preferredEmail || user[0].email;
      const userName = user[0].displayName || user[0].firstName || userEmail.split('@')[0];
      
      // Format event date
      const formattedEventDate = eventDate 
        ? new Date(eventDate).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        : 'Date to be determined';

      // Generate event URL
      const eventUrl = this.getEventUrl(eventId);

      const msg = {
        to: userEmail,
        from: 'katie@thesandwichproject.org',
        subject: "You've been assigned as TSP Contact - The Sandwich Project",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #236383; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
              .event-details { background: white; padding: 15px; border-left: 4px solid #236383; margin: 15px 0; }
              .btn { display: inline-block; background: #236383; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 15px 0; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎯 You've been assigned as TSP Contact!</h1>
              </div>
              <div class="content">
                <p>Hello ${userName}!</p>
                <p>You have been assigned as the TSP Contact for the following event:</p>
                
                <div class="event-details">
                  <strong>Organization:</strong> ${organizationName}<br>
                  <strong>Event Date:</strong> ${formattedEventDate}
                </div>
                
                <p>As the TSP Contact, you will be the main point of contact for coordinating this sandwich-making event. Please review the event details and reach out to the organization to confirm arrangements.</p>
                
                <p>Click the button below to view the event details:</p>
                <a href="${eventUrl}" class="btn">View Event Details</a>
                
                ${EMAIL_FOOTER_HTML}
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
Hello ${userName}!

You have been assigned as the TSP Contact for the following event:

Organization: ${organizationName}
Event Date: ${formattedEventDate}

As the TSP Contact, you will be the main point of contact for coordinating this sandwich-making event. Please review the event details and reach out to the organization to confirm arrangements.

View event details: ${eventUrl}

---
The Sandwich Project - Fighting food insecurity one sandwich at a time

To unsubscribe from these emails, please contact us at katie@thesandwichproject.org or reply STOP.
        `.trim(),
      };

      await sgMail.send(msg);
      logger.log(`TSP contact assignment notification sent to ${userEmail} for event ${eventId}`);

      // Send SMS notification if user has opted in
      try {
        const metadata = getUserMetadata(user[0]);
        const smsConsent = metadata.smsConsent;
        if (smsConsent?.status === 'confirmed' && smsConsent.enabled && smsConsent.phoneNumber) {
          const eventUrl = this.getEventUrl(eventId);
          await sendTSPContactAssignmentSMS(
            smsConsent.phoneNumber,
            userName,
            organizationName,
            formattedEventDate,
            eventUrl
          );
          logger.log(`TSP contact assignment SMS sent to ${smsConsent.phoneNumber} for event ${eventId}`);
        }
      } catch (smsError) {
        logger.error('Error sending TSP contact assignment SMS (email still succeeded):', smsError);
      }

      return true;
    } catch (error) {
      logger.error('Error sending TSP contact assignment notification:', error);
      return false;
    }
  }

  /**
   * Send 24-hour reminder email to volunteers assigned to an event
   */
  static async sendVolunteerReminderNotification(
    volunteerEmail: string,
    volunteerName: string,
    eventId: number,
    organizationName: string,
    eventDate: Date | string,
    role: string
  ): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.log('SendGrid not configured - skipping volunteer reminder notification');
      return false;
    }

    try {
      // Format event date and time in organization's timezone (America/New_York)
      const eventDateTime = new Date(eventDate);
      const formattedDate = eventDateTime.toLocaleDateString('en-US', { 
        timeZone: 'America/New_York',
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const formattedTime = eventDateTime.toLocaleTimeString('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      // Format role for display
      const roleDisplay = role === 'driver' ? 'Driver' 
                        : role === 'speaker' ? 'Speaker' 
                        : 'Volunteer';

      // Generate event URL
      const eventUrl = this.getEventUrl(eventId);

      const msg = {
        to: volunteerEmail,
        from: 'katie@thesandwichproject.org',
        subject: `Reminder: Event tomorrow at ${organizationName} - The Sandwich Project`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #236383; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
              .event-details { background: white; padding: 15px; border-left: 4px solid #DE7C3A; margin: 15px 0; }
              .highlight { background: #FFF9E6; padding: 10px; border-radius: 5px; margin: 15px 0; }
              .btn { display: inline-block; background: #DE7C3A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 15px 0; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔔 Event Reminder - Tomorrow!</h1>
              </div>
              <div class="content">
                <p>Hello ${volunteerName}!</p>
                <p>This is a friendly reminder that you're scheduled to volunteer tomorrow as a <strong>${roleDisplay}</strong>:</p>
                
                <div class="event-details">
                  <strong>Organization:</strong> ${organizationName}<br>
                  <strong>Date:</strong> ${formattedDate}<br>
                  <strong>Time:</strong> ${formattedTime}<br>
                  <strong>Your Role:</strong> ${roleDisplay}
                </div>
                
                <div class="highlight">
                  <strong>📋 What to bring:</strong><br>
                  ${role === 'driver' ? '• Valid driver\'s license<br>• Your vehicle ready for pickup/delivery' 
                    : role === 'speaker' ? '• Any presentation materials<br>• Your enthusiasm for The Sandwich Project!' 
                    : '• Your enthusiasm and willingness to help!'}
                </div>
                
                <p>If you have any questions or need to make changes to your commitment, please contact us as soon as possible.</p>
                
                <p>Click the button below to view the full event details:</p>
                <a href="${eventUrl}" class="btn">View Event Details</a>
                
                <p style="margin-top: 20px;"><strong>Thank you for your commitment to fighting food insecurity!</strong></p>
                
                ${EMAIL_FOOTER_HTML}
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
Hello ${volunteerName}!

This is a friendly reminder that you're scheduled to volunteer tomorrow as a ${roleDisplay}:

Organization: ${organizationName}
Date: ${formattedDate}
Time: ${formattedTime}
Your Role: ${roleDisplay}

${role === 'driver' ? 'What to bring:\n• Valid driver\'s license\n• Your vehicle ready for pickup/delivery' 
  : role === 'speaker' ? 'What to bring:\n• Any presentation materials\n• Your enthusiasm for The Sandwich Project!' 
  : 'What to bring:\n• Your enthusiasm and willingness to help!'}

If you have any questions or need to make changes to your commitment, please contact us as soon as possible.

View event details: ${eventUrl}

Thank you for your commitment to fighting food insecurity!

---
The Sandwich Project - Fighting food insecurity one sandwich at a time

To unsubscribe from these emails, please contact us at katie@thesandwichproject.org or reply STOP.
        `.trim(),
      };

      await sgMail.send(msg);
      logger.log(`24-hour volunteer reminder sent to ${volunteerEmail} for event ${eventId}`);
      return true;
    } catch (error) {
      logger.error('Error sending volunteer reminder notification:', error);
      return false;
    }
  }

  /**
   * Process a chat message for mentions and send notifications
   */
  static async processChatMessage(
    content: string,
    senderId: string,
    senderName: string,
    senderEmail: string,
    channel: string,
    messageId: number
  ): Promise<void> {
    try {
      // Detect mentions in the message
      const mentions = this.detectMentions(content);
      if (mentions.length === 0) return;

      // Find users who were mentioned
      const mentionedUsers = await this.findMentionedUsers(mentions);

      // Send notifications to each mentioned user (except the sender)
      for (const user of mentionedUsers) {
        if (user.id === senderId) continue; // Don't notify the sender

        const userName =
          user.displayName ||
          user.firstName ||
          user.email?.split('@')[0] ||
          'User';

        await this.sendChatMentionNotification({
          mentionedUserId: user.id,
          mentionedUserEmail: user.email!,
          mentionedUserName: userName,
          senderName,
          senderEmail,
          channel,
          messageContent: content,
          messageId,
        });
      }
    } catch (error) {
      logger.error('Error processing chat message for mentions:', error);
    }
  }

  /**
   * Generate chat room URL for the notification
   */
  private static getChatUrl(channel: string): string {
    const baseUrl =
      process.env.NODE_ENV === 'production'
        ? 'https://sandwich-project-platform-katielong2316.replit.app'
        : 'http://localhost:5000';

    return `${baseUrl}/dashboard?section=chat&channel=${encodeURIComponent(
      channel
    )}`;
  }

  /**
   * Send email notification when a user is assigned to a team board item
   */
  static async sendTeamBoardAssignmentNotification(
    assignedUserIds: string[],
    itemId: number,
    itemContent: string,
    itemType: string,
    assignedBy: string
  ): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.log('SendGrid not configured - skipping team board assignment notification');
      return false;
    }

    try {
      // Fetch user details from database for all assigned users
      const assignedUsers = await db
        .select()
        .from(users)
        .where(inArray(users.id, assignedUserIds));

      if (!assignedUsers || assignedUsers.length === 0) {
        logger.warn(`No valid users found for team board assignment - IDs: ${assignedUserIds.join(', ')}`);
        return false;
      }

      // Send email to each assigned user
      for (const user of assignedUsers) {
        if (!user.email) {
          logger.warn(`User ${user.id} has no email - cannot send team board assignment notification`);
          continue;
        }

        // Use preferred email if available, otherwise use regular email
        const userEmail = user.preferredEmail || user.email;
        const userName = user.displayName || user.firstName || userEmail.split('@')[0];

        // Truncate content if too long for email
        const displayContent = itemContent.length > 200 
          ? itemContent.substring(0, 200) + '...' 
          : itemContent;

        // Format item type for display
        const itemTypeDisplay = itemType === 'task' ? 'Task'
                              : itemType === 'note' ? 'Note'
                              : itemType === 'idea' ? 'Idea'
                              : itemType === 'reminder' ? 'Reminder'
                              : 'Item';

        // Generate team board URL
        const teamBoardUrl = this.getTeamBoardUrl();

        const msg = {
          to: userEmail,
          from: 'katie@thesandwichproject.org',
          subject: `You've been assigned to a team board ${itemTypeDisplay.toLowerCase()} - The Sandwich Project`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #236383; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
                .item-details { background: white; padding: 15px; border-left: 4px solid #FBAD3F; margin: 15px 0; }
                .btn { display: inline-block; background: #236383; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 15px 0; }
                .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>📋 You've been assigned to a team board ${itemTypeDisplay.toLowerCase()}!</h1>
                </div>
                <div class="content">
                  <p>Hello ${userName}!</p>
                  <p>You have been assigned to the following team board ${itemTypeDisplay.toLowerCase()} by <strong>${assignedBy}</strong>:</p>
                  
                  <div class="item-details">
                    <strong>${itemTypeDisplay}:</strong><br>
                    ${displayContent}
                  </div>
                  
                  <p>Please review the ${itemTypeDisplay.toLowerCase()} details and take any necessary action.</p>
                  
                  <p>Click the button below to view the team board:</p>
                  <a href="${teamBoardUrl}" class="btn">View Team Board</a>
                  
                  ${EMAIL_FOOTER_HTML}
                </div>
              </div>
            </body>
            </html>
          `,
          text: `
Hello ${userName}!

You have been assigned to the following team board ${itemTypeDisplay.toLowerCase()} by ${assignedBy}:

${itemTypeDisplay}: ${displayContent}

Please review the ${itemTypeDisplay.toLowerCase()} details and take any necessary action.

View team board: ${teamBoardUrl}

---
The Sandwich Project - Fighting food insecurity one sandwich at a time

To unsubscribe from these emails, please contact us at katie@thesandwichproject.org or reply STOP.
          `.trim(),
        };

        await sgMail.send(msg);
        logger.log(`Team board assignment notification sent to ${userEmail} for item ${itemId}`);
      }

      // Send SMS notifications to users who have opted in
      const teamBoardUrl = this.getTeamBoardUrl();
      for (const user of assignedUsers) {
        try {
          const metadata = getUserMetadata(user);
          const smsConsent = metadata.smsConsent;
          if (smsConsent?.status === 'confirmed' && smsConsent.enabled && smsConsent.phoneNumber) {
            const userName = user.displayName || user.firstName || user.email?.split('@')[0] || 'User';
            const displayContent = itemContent.length > 50 
              ? itemContent.substring(0, 50) + '...' 
              : itemContent;
            await sendTeamBoardAssignmentSMS(
              smsConsent.phoneNumber,
              userName,
              displayContent,
              assignedBy,
              itemType,
              teamBoardUrl
            );
            logger.log(`Team board assignment SMS sent to ${smsConsent.phoneNumber} for item ${itemId}`);
          }
        } catch (smsError) {
          logger.error(`Error sending team board assignment SMS to user ${user.id} (emails still succeeded):`, smsError);
        }
      }

      return true;
    } catch (error) {
      logger.error('Error sending team board assignment notification:', error);
      return false;
    }
  }

  /**
   * Generate event URL for the notification
   */
  private static getEventUrl(eventId: number): string {
    const baseUrl =
      process.env.NODE_ENV === 'production'
        ? 'https://sandwich-project-platform-katielong2316.replit.app'
        : 'http://localhost:5000';

    return `${baseUrl}/event-requests-v2?eventId=${eventId}`;
  }

  /**
   * Generate team board URL for the notification
   */
  private static getTeamBoardUrl(): string {
    const baseUrl =
      process.env.NODE_ENV === 'production'
        ? 'https://sandwich-project-platform-katielong2316.replit.app'
        : 'http://localhost:5000';

    return `${baseUrl}/dashboard?section=team-board`;
  }

  /**
   * Send email notification for team board comment mentions
   */
  static async sendTeamBoardCommentMentionNotification(
    mentionedUserEmail: string,
    mentionedUserName: string,
    commenterName: string,
    itemContent: string,
    commentContent: string
  ): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.log('SendGrid not configured - skipping team board comment mention notification');
      return false;
    }

    try {
      // Truncate content if too long for email
      const displayItemContent = itemContent.length > 100
        ? itemContent.substring(0, 100) + '...'
        : itemContent;

      const displayCommentContent = commentContent.length > 200
        ? commentContent.substring(0, 200) + '...'
        : commentContent;

      // Generate team board URL
      const teamBoardUrl = this.getTeamBoardUrl();

      const msg = {
        to: mentionedUserEmail,
        from: 'katie@thesandwichproject.org',
        subject: `You were mentioned in a team board comment - The Sandwich Project`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #236383; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
              .item-box { background: #e6f7f9; padding: 12px; border-left: 4px solid #47B3CB; margin: 15px 0; font-size: 14px; }
              .comment-box { background: white; padding: 15px; border-left: 4px solid #236383; margin: 15px 0; }
              .btn { display: inline-block; background: #236383; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 15px 0; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>💬 You were mentioned in a team board comment!</h1>
              </div>
              <div class="content">
                <p>Hello ${mentionedUserName}!</p>
                <p><strong>${commenterName}</strong> mentioned you in a comment on a team board item:</p>

                <div class="item-box">
                  <strong>Team Board Item:</strong><br>
                  ${displayItemContent}
                </div>

                <div class="comment-box">
                  <strong>${commenterName} commented:</strong><br>
                  "${displayCommentContent}"
                </div>

                <p>Click the button below to view and respond:</p>
                <a href="${teamBoardUrl}" class="btn">View Team Board</a>

                ${EMAIL_FOOTER_HTML}
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
Hello ${mentionedUserName}!

${commenterName} mentioned you in a comment on a team board item:

Team Board Item:
${displayItemContent}

${commenterName} commented:
"${displayCommentContent}"

View team board: ${teamBoardUrl}

---
The Sandwich Project - Fighting food insecurity one sandwich at a time

To unsubscribe from these emails, please contact us at katie@thesandwichproject.org or reply STOP.
        `.trim(),
      };

      await sgMail.send(msg);
      logger.log(`Team board comment mention notification sent to ${mentionedUserEmail}`);
      return true;
    } catch (error) {
      logger.error('Error sending team board comment mention notification:', error);
      return false;
    }
  }

  /**
   * Process a team board comment for mentions and send notifications
   */
  static async processTeamBoardComment(
    commentContent: string,
    commenterId: string,
    commenterName: string,
    itemId: number,
    itemContent: string
  ): Promise<void> {
    try {
      // Detect mentions in the comment
      const mentions = this.detectMentions(commentContent);
      if (mentions.length === 0) return;

      // Find users who were mentioned
      const mentionedUsers = await this.findMentionedUsers(mentions);

      // Send notifications to each mentioned user (except the commenter)
      for (const user of mentionedUsers) {
        if (user.id === commenterId) continue; // Don't notify the commenter

        if (!user.email) {
          logger.warn(`Skipping mention notification: user ${user.id} has no email.`);
          continue;
        }

        const userName =
          user.displayName ||
          user.firstName ||
          user.email.split('@')[0] ||
          'User';

        await this.sendTeamBoardCommentMentionNotification(
          user.email,
          userName,
          commenterName,
          itemContent,
          commentContent
        );
      }
    } catch (error) {
      logger.error('Error processing team board comment for mentions:', error);
    }
  }

  /**
   * Send email notification when a comment is left on an event request
   * Notifies the TSP contact(s) assigned to that event
   */
  static async sendEventCommentNotification(
    eventId: number,
    commenterFirstName: string,
    commenterId: string,
    commentContent: string,
    commentCreatedAt: Date
  ): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.log('SendGrid not configured - skipping event comment notification');
      return false;
    }

    try {
      // Fetch the event request to get TSP contact info and event details
      const [event] = await db
        .select()
        .from(eventRequests)
        .where(eq(eventRequests.id, eventId))
        .limit(1);

      if (!event) {
        logger.warn(`Event ${eventId} not found - cannot send comment notification`);
        return false;
      }

      // Collect all TSP contact user IDs (primary + additional contacts)
      const tspContactIds: string[] = [];
      if (event.tspContact) tspContactIds.push(event.tspContact);
      if (event.tspContactAssigned && event.tspContactAssigned !== event.tspContact) {
        tspContactIds.push(event.tspContactAssigned);
      }
      if (event.additionalContact1) tspContactIds.push(event.additionalContact1);
      if (event.additionalContact2) tspContactIds.push(event.additionalContact2);

      // Remove duplicates and filter out the commenter (don't notify yourself)
      const uniqueContactIds = [...new Set(tspContactIds)].filter(id => id !== commenterId);

      if (uniqueContactIds.length === 0) {
        logger.log(`No TSP contacts to notify for event ${eventId} (or commenter is the only contact)`);
        return false;
      }

      // Fetch user details for all TSP contacts
      const tspUsers = await db
        .select()
        .from(users)
        .where(inArray(users.id, uniqueContactIds));

      if (tspUsers.length === 0) {
        logger.warn(`No valid TSP contact users found for event ${eventId}`);
        return false;
      }

      // Format event date
      const eventDate = event.scheduledEventDate || event.desiredEventDate;
      const formattedEventDate = eventDate
        ? new Date(eventDate + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : 'Date to be determined';

      // Format comment timestamp
      const formattedCommentTime = commentCreatedAt.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      // Generate event URL
      const eventUrl = this.getEventUrl(eventId);
      const organizationName = event.organizationName || 'Unknown Organization';

      // Send email to each TSP contact
      for (const user of tspUsers) {
        if (!user.email) {
          logger.warn(`User ${user.id} has no email - cannot send comment notification`);
          continue;
        }

        const userEmail = user.preferredEmail || user.email;
        const userName = user.displayName || user.firstName || userEmail.split('@')[0];

        // Truncate comment if too long
        const displayComment = commentContent.length > 500
          ? commentContent.substring(0, 500) + '...'
          : commentContent;

        const msg = {
          to: userEmail,
          from: 'katie@thesandwichproject.org',
          subject: `New comment on ${organizationName} event - The Sandwich Project`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #236383; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
                .event-details { background: #e6f7f9; padding: 12px; border-left: 4px solid #47B3CB; margin: 15px 0; font-size: 14px; }
                .comment-box { background: white; padding: 15px; border-left: 4px solid #236383; margin: 15px 0; }
                .comment-meta { color: #666; font-size: 13px; margin-bottom: 8px; }
                .btn { display: inline-block; background: #236383; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 15px 0; }
                .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>💬 New Comment on Event</h1>
                </div>
                <div class="content">
                  <p>Hello ${userName}!</p>
                  <p>A new comment has been added to an event you're assigned to:</p>

                  <div class="event-details">
                    <strong>Organization:</strong> ${organizationName}<br>
                    <strong>Event Date:</strong> ${formattedEventDate}
                  </div>

                  <div class="comment-box">
                    <div class="comment-meta">
                      <strong>${commenterFirstName}</strong> commented on ${formattedCommentTime}:
                    </div>
                    "${displayComment}"
                  </div>

                  <p>Click the button below to view the event and respond:</p>
                  <a href="${eventUrl}" class="btn">View Event Details</a>

                  ${EMAIL_FOOTER_HTML}
                </div>
              </div>
            </body>
            </html>
          `,
          text: `
Hello ${userName}!

A new comment has been added to an event you're assigned to:

Organization: ${organizationName}
Event Date: ${formattedEventDate}

${commenterFirstName} commented on ${formattedCommentTime}:
"${displayComment}"

View event details and respond: ${eventUrl}

---
The Sandwich Project - Fighting food insecurity one sandwich at a time

To unsubscribe from these emails, please contact us at katie@thesandwichproject.org or reply STOP.
          `.trim(),
        };

        // Check if user has SMS enabled - if so, send SMS instead of email
        const metadata = getUserMetadata(user);
        const smsConsent = metadata.smsConsent;
        const hasSmsEnabled = smsConsent?.enabled && smsConsent?.phoneNumber;

        if (hasSmsEnabled) {
          // Send SMS notification instead of email
          try {
            await sendEventCommentSMS(
              smsConsent.phoneNumber,
              userName,
              commenterFirstName,
              organizationName,
              commentContent,
              eventUrl
            );
            logger.log(`Event comment SMS sent to ${smsConsent.phoneNumber} for event ${eventId} (skipped email)`);
          } catch (smsError) {
            // If SMS fails, fall back to email
            logger.error(`Failed to send event comment SMS to user ${user.id}, falling back to email:`, smsError);
            await sgMail.send(msg);
            logger.log(`Event comment notification sent to ${userEmail} for event ${eventId} (SMS fallback)`);
          }
        } else {
          // Send email notification
          await sgMail.send(msg);
          logger.log(`Event comment notification sent to ${userEmail} for event ${eventId}`);
        }
      }

      return true;
    } catch (error) {
      logger.error('Error sending event comment notification:', error);
      return false;
    }
  }

  /**
   * Process a team board item (task/note/idea) for mentions and send notifications
   */
  static async processTeamBoardItemMentions(
    itemContent: string,
    creatorId: string,
    creatorName: string,
    itemId: number
  ): Promise<void> {
    try {
      // Detect mentions in the item content
      const mentions = this.detectMentions(itemContent);
      if (mentions.length === 0) return;

      // Find users who were mentioned
      const mentionedUsers = await this.findMentionedUsers(mentions);

      // Send notifications to each mentioned user (except the creator)
      for (const user of mentionedUsers) {
        if (user.id === creatorId) continue; // Don't notify the creator

        if (!user.email) {
          logger.warn(`Skipping mention notification: user ${user.id} has no email.`);
          continue;
        }

        const userName =
          user.displayName ||
          user.firstName ||
          user.email.split('@')[0] ||
          'User';

        await this.sendTeamBoardItemMentionNotification(
          user.email,
          userName,
          creatorName,
          itemContent,
          itemId
        );
      }
    } catch (error) {
      logger.error('Error processing team board item for mentions:', error);
    }
  }

  /**
   * Send email notification for team board item mention
   */
  private static async sendTeamBoardItemMentionNotification(
    recipientEmail: string,
    recipientName: string,
    mentionerName: string,
    itemContent: string,
    itemId: number
  ): Promise<void> {
    try {
      const subject = `${mentionerName} mentioned you in a Holding Zone item`;
      const itemPreview = itemContent.length > 100
        ? itemContent.substring(0, 100) + '...'
        : itemContent;

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #236383;">You've been mentioned!</h2>
          <p>Hi ${recipientName},</p>
          <p><strong>${mentionerName}</strong> mentioned you in a Holding Zone item:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #236383; margin: 20px 0;">
            <p style="margin: 0; white-space: pre-wrap;">${itemPreview}</p>
          </div>
          <p>
            <a href="${process.env.CLIENT_URL || 'http://localhost:5000'}/dashboard?section=holding-zone"
               style="background-color: #236383; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Holding Zone
            </a>
          </p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This is an automated notification from The Sandwich Project platform.
          </p>
        </div>
      `;

      await sendEmail({
        to: recipientEmail,
        subject,
        text: `${mentionerName} mentioned you in a Holding Zone item:\n\n${itemPreview}\n\nView it in the Holding Zone section.`,
        html: htmlBody,
      });

      logger.info('Team board item mention notification sent', {
        recipientEmail,
        itemId,
      });
    } catch (error) {
      logger.error('Failed to send team board item mention notification:', error);
      throw error;
    }
  }

  /**
   * Send notification to TSP contact when an in-process event's date has passed
   */
  static async sendPastDateNotification(
    tspContactEmail: string,
    tspContactName: string,
    eventId: number,
    organizationName: string,
    eventDate: Date | string
  ): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      logger.log('SendGrid not configured - skipping past date notification');
      return false;
    }

    try {
      // Format event date
      const eventDateTime = new Date(eventDate);
      const formattedDate = eventDateTime.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Calculate how many days ago
      const now = new Date();
      const diffTime = now.getTime() - eventDateTime.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const daysAgoText = diffDays === 1 ? 'yesterday' : `${diffDays} days ago`;

      // Generate event URL
      const eventUrl = this.getEventUrl(eventId);

      const msg = {
        to: tspContactEmail,
        from: 'katie@thesandwichproject.org',
        subject: `Action Required: Event date passed for ${organizationName} - The Sandwich Project`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #A31C41; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
              .alert-box { background-color: #FEE2E2; border: 1px solid #EF4444; padding: 15px; border-radius: 6px; margin: 15px 0; }
              .event-details { background-color: #fff; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #A31C41; }
              .btn { display: inline-block; background-color: #236383; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
              .actions { background-color: #F0FDF4; padding: 15px; border-radius: 6px; margin: 15px 0; }
              .actions ul { margin: 10px 0; padding-left: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>⚠️ Event Date Has Passed</h1>
              </div>
              <div class="content">
                <p>Hello ${tspContactName},</p>

                <div class="alert-box">
                  <strong>This event's requested date has passed and requires your attention.</strong>
                </div>

                <div class="event-details">
                  <strong>Organization:</strong> ${organizationName}<br>
                  <strong>Requested Date:</strong> ${formattedDate} (${daysAgoText})<br>
                  <strong>Status:</strong> Still In Process
                </div>

                <div class="actions">
                  <strong>📋 Please take one of the following actions:</strong>
                  <ul>
                    <li><strong>Reschedule:</strong> Contact the organization to set a new event date</li>
                    <li><strong>Postpone:</strong> Mark as postponed if they need more time</li>
                    <li><strong>Decline:</strong> Mark as declined if the event is no longer happening</li>
                  </ul>
                </div>

                <p>Click the button below to review the event and update its status:</p>
                <a href="${eventUrl}" class="btn">Review Event</a>

                ${EMAIL_FOOTER_HTML}
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
Hello ${tspContactName},

⚠️ EVENT DATE HAS PASSED - ACTION REQUIRED

This event's requested date has passed and requires your attention:

Organization: ${organizationName}
Requested Date: ${formattedDate} (${daysAgoText})
Status: Still In Process

Please take one of the following actions:
• Reschedule: Contact the organization to set a new event date
• Postpone: Mark as postponed if they need more time
• Decline: Mark as declined if the event is no longer happening

Review event: ${eventUrl}

---
The Sandwich Project - Fighting food insecurity one sandwich at a time

To unsubscribe from these emails, please contact us at katie@thesandwichproject.org or reply STOP.
        `.trim(),
      };

      await sgMail.send(msg);
      logger.log(`Past date notification sent to ${tspContactEmail} for event ${eventId}`);
      return true;
    } catch (error) {
      logger.error('Error sending past date notification:', error);
      return false;
    }
  }
}
