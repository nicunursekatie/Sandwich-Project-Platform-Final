import sgMail from '@sendgrid/mail';
import { db } from "../db";
import { users } from "@shared/schema";
import { eq, or, like, sql } from "drizzle-orm";

// Initialize SendGrid
if (!process.env.SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY not found - email notifications will be disabled");
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
      mentions.push(...usernameMatches.map(match => match.substring(1)));
    }
    
    // Match @"display name" (quoted names)
    const quotedMatches = content.match(/@"([^"]+)"/g);
    if (quotedMatches) {
      mentions.push(...quotedMatches.map(match => match.substring(2, match.length - 1)));
    }
    
    // Match @email@domain.com (email addresses)
    const emailMatches = content.match(/@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g);
    if (emailMatches) {
      mentions.push(...emailMatches.map(match => match.substring(1)));
    }
    
    return [...new Set(mentions)]; // Remove duplicates
  }

  /**
   * Find users mentioned in a message and return their details
   */
  static async findMentionedUsers(mentions: string[]): Promise<Array<{ id: string; email: string; displayName: string | null; firstName: string | null; lastName: string | null }>> {
    if (mentions.length === 0) return [];

    try {
      // Search by display name, email, firstName, or lastName
      const allUsers = await db.select().from(users);
      const mentionedUsers = allUsers.filter(user => {
        const lowerEmail = user.email?.toLowerCase() || '';
        const lowerDisplayName = user.displayName?.toLowerCase() || '';
        const lowerFirstName = user.firstName?.toLowerCase() || '';
        const lowerLastName = user.lastName?.toLowerCase() || '';
        
        return mentions.some(mention => {
          const lowerMention = mention.toLowerCase();
          return lowerEmail === lowerMention ||
                 lowerDisplayName === lowerMention ||
                 lowerFirstName === lowerMention ||
                 lowerLastName === lowerMention;
        });
      });

      return mentionedUsers.filter(user => user.email); // Only return users with email addresses
    } catch (error) {
      console.error("Error finding mentioned users:", error);
      return [];
    }
  }

  /**
   * Send email notification for chat mentions
   */
  static async sendChatMentionNotification(notification: ChatMentionNotification): Promise<boolean> {
    if (!process.env.SENDGRID_API_KEY) {
      console.log("SendGrid not configured - skipping email notification");
      return false;
    }

    try {
      const msg = {
        to: notification.mentionedUserEmail,
        from: 'noreply@sandwichproject.org', // Use your verified sender email
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
                <p><strong>${notification.senderName}</strong> mentioned you in the <strong>#${notification.channel}</strong> chat room:</p>
                
                <div class="message-box">
                  "${notification.messageContent}"
                </div>
                
                <p>Click the button below to join the conversation:</p>
                <a href="${this.getChatUrl(notification.channel)}" class="btn">Join Chat Room</a>
                
                <div class="footer">
                  <p>This notification was sent because you were mentioned in a chat message.</p>
                  <p>The Sandwich Project - Building community through food assistance</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
Hello ${notification.mentionedUserName}!

${notification.senderName} mentioned you in the #${notification.channel} chat room:

"${notification.messageContent}"

Join the conversation: ${this.getChatUrl(notification.channel)}

---
The Sandwich Project - Building community through food assistance
        `.trim()
      };

      await sgMail.send(msg);
      console.log(`Chat mention notification sent to ${notification.mentionedUserEmail}`);
      return true;
    } catch (error) {
      console.error("Error sending chat mention notification:", error);
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
        
        const userName = user.displayName || user.firstName || user.email?.split('@')[0] || 'User';
        
        await this.sendChatMentionNotification({
          mentionedUserId: user.id,
          mentionedUserEmail: user.email!,
          mentionedUserName: userName,
          senderName,
          senderEmail,
          channel,
          messageContent: content,
          messageId
        });
      }
    } catch (error) {
      console.error("Error processing chat message for mentions:", error);
    }
  }

  /**
   * Generate chat room URL for the notification
   */
  private static getChatUrl(channel: string): string {
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://sandwich-project-platform-katielong2316.replit.app'
      : 'http://localhost:5000';
    
    return `${baseUrl}/dashboard?section=chat&channel=${encodeURIComponent(channel)}`;
  }
}