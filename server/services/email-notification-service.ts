import sgMail from '@sendgrid/mail';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq, or, like, sql, inArray } from 'drizzle-orm';
import { EMAIL_FOOTER_HTML } from '../utils/email-footer';
import { logger } from '../utils/production-safe-logger';

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
   */
  static detectMentions(content: string): string[] {
    const mentions: string[] = [];

    // Match @username (alphanumeric and underscore)
    const usernameMatches = content.match(/@([a-zA-Z0-9_]+)/g);
    if (usernameMatches) {
      mentions.push(...usernameMatches.map((match) => match.substring(1)));
    }

    // Match @"display name" (quoted names)
    const quotedMatches = content.match(/@"([^"]+)"/g);
    if (quotedMatches) {
      mentions.push(
        ...quotedMatches.map((match) => match.substring(2, match.length - 1))
      );
    }

    // Match @email@domain.com (email addresses)
    const emailMatches = content.match(
      /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
    );
    if (emailMatches) {
      mentions.push(...emailMatches.map((match) => match.substring(1)));
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
}
