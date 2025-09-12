import { Request, Response, Express } from "express";
import { eq, sql, and, gt, or, isNull } from "drizzle-orm";
import { messages, messageRecipients, conversations, conversationParticipants, chatMessages, kudosTracking, users, emailMessages } from "../../shared/schema";
import { db } from "../db";
import { isAuthenticated } from "../temp-auth";
import { hasPermission, PERMISSIONS } from "../../shared/auth-utils";

// Helper function to check if user has permission for specific chat type
function checkUserChatPermission(user: any, chatType: string): boolean {
  if (!user) return false;

  switch (chatType) {
    case 'core_team':
      return hasPermission(user, PERMISSIONS.CORE_TEAM_CHAT);
    case 'committee':
      return hasPermission(user, PERMISSIONS.COMMITTEE_CHAT);
    case 'hosts':
      return hasPermission(user, PERMISSIONS.HOST_CHAT);
    case 'drivers':
      return hasPermission(user, PERMISSIONS.DRIVER_CHAT);
    case 'recipients':
      return hasPermission(user, PERMISSIONS.RECIPIENT_CHAT);
    case 'direct':
      return hasPermission(user, PERMISSIONS.DIRECT_MESSAGES);
    case 'groups':
      return hasPermission(user, PERMISSIONS.GROUP_MESSAGES);
    case 'general':
      return hasPermission(user, PERMISSIONS.GENERAL_CHAT);
    default:
      return hasPermission(user, PERMISSIONS.GENERAL_CHAT);
  }
}

// Get unread message counts for a user
const getUnreadCounts = async (req: Request, res: Response) => {
    try {
      console.log('=== UNREAD COUNTS REQUEST ===');
      console.log('req.user exists:', !!(req as any).user);
      console.log('req.user?.id:', (req as any).user?.id);
      console.log('req.session exists:', !!(req as any).session);
      console.log('req.session?.user exists:', !!(req as any).session?.user);
      
      // Try to get user from both req.user and req.session.user for compatibility
      const userId = (req as any).user?.id || (req as any).session?.user?.id;
      const user = (req as any).user || (req as any).session?.user;
      
      if (!userId || !user) {
        console.log('Authentication failed: No user ID found');
        return res.status(401).json({ message: "Unauthorized" });
      }

      console.log('Using user data:', { id: userId, permissions: user.permissions?.length || 0 });

      // Initialize counts
      let unreadCounts = {
        general: 0,
        committee: 0,
        hosts: 0,
        drivers: 0,
        recipients: 0,
        core_team: 0,
        direct: 0,
        groups: 0,
        kudos: 0,
        total: 0
      };

      try {
        // Get chat message counts from Socket.IO chat system (chat_messages table)
        const chatChannels = [
          { channel: 'general', permission: 'general_chat', key: 'general' },
          { channel: 'core-team', permission: 'core_team_chat', key: 'core_team' },
          { channel: 'committee', permission: 'committee_chat', key: 'committee' },
          { channel: 'host', permission: 'host_chat', key: 'hosts' },
          { channel: 'driver', permission: 'driver_chat', key: 'drivers' },
          { channel: 'recipient', permission: 'recipient_chat', key: 'recipients' }
        ];
        
        for (const { channel, permission, key } of chatChannels) {
          // Check if user has permission to see this channel
          if (!checkUserChatPermission(user, key)) {
            continue;
          }
          
          // Count unread messages in this channel (messages that haven't been marked as read)
          const { chatMessageReads } = await import("../../shared/schema");
          const unreadCount = await db
            .select({ count: sql<number>`COUNT(*)::int` })
            .from(chatMessages)
            .leftJoin(chatMessageReads, 
              and(
                eq(chatMessageReads.messageId, chatMessages.id),
                eq(chatMessageReads.userId, userId)
              )
            )
            .where(
              and(
                eq(chatMessages.channel, channel),
                // Not from current user
                sql`${chatMessages.userId} != ${userId}`,
                // Not already read
                isNull(chatMessageReads.id)
              )
            );
          
          const count = parseInt(String(unreadCount[0]?.count || 0));
          unreadCounts[key as keyof typeof unreadCounts] = count;
        }

        // Calculate total will be done after formal messaging counts

        // Get unread email-style message counts (direct/group messages)
        // Use the correct email_messages table that powers the inbox interface
        try {
          const directMessageCount = await db
            .select({ count: sql<number>`COUNT(*)::int` })
            .from(emailMessages)
            .where(
              and(
                eq(emailMessages.recipientId, userId),
                eq(emailMessages.isRead, false),
                eq(emailMessages.isDraft, false),
                eq(emailMessages.isTrashed, false),
                eq(emailMessages.isArchived, false)
              )
            );

          unreadCounts.direct = parseInt(String(directMessageCount[0]?.count || 0));
          unreadCounts.groups = 0; // Groups functionality not implemented yet
        } catch (directMsgError) {
          console.error('Error getting direct message counts:', directMsgError);
          unreadCounts.direct = 0;
          unreadCounts.groups = 0;
        }

        // Get unread kudos count from email system
        try {
          const kudosCount = await db
            .select({ count: sql<number>`COUNT(*)::int` })
            .from(emailMessages)
            .where(
              and(
                eq(emailMessages.recipientId, userId),
                eq(emailMessages.isRead, false),
                eq(emailMessages.isDraft, false),
                eq(emailMessages.isTrashed, false),
                eq(emailMessages.isArchived, false),
                sql`${emailMessages.subject} LIKE '%Kudos%' OR ${emailMessages.content} LIKE '%kudos%'`
              )
            );

          unreadCounts.kudos = parseInt(String(kudosCount[0]?.count || 0));
        } catch (kudosError) {
          console.error('Error getting kudos counts:', kudosError);
          unreadCounts.kudos = 0;
        }

        // Calculate total
        unreadCounts.total = unreadCounts.general + unreadCounts.committee + 
                           unreadCounts.hosts + unreadCounts.drivers + 
                           unreadCounts.recipients + unreadCounts.core_team + 
                           unreadCounts.direct + unreadCounts.groups + unreadCounts.kudos;

      } catch (dbError) {
        console.error('Database query error in unread counts:', dbError);
        // Return fallback counts on database error
      }

      res.json(unreadCounts);
    } catch (error) {
      console.error("Error getting unread counts:", error);
      res.status(500).json({ error: "Failed to get unread counts" });
    }
};

// Simple in-memory storage for chat read tracking
// In production, this should use a proper database table
const chatReadTracker = new Map<string, Date>();

// Mark chat messages as read when user views a chat channel
const markChatMessagesRead = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || (req as any).session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { channel, messageIds } = req.body;

      if (!channel) {
        return res.status(400).json({ error: "Channel is required" });
      }

      console.log(`Marking chat messages as read for user ${userId} in channel ${channel}`);
      
      // If specific message IDs are provided, mark those
      if (messageIds && Array.isArray(messageIds)) {
        // Chat read tracking disabled - no database table
        // TODO: Implement if chat read tracking is needed
        
        res.json({ success: true, channel, userId, markedRead: messageIds.length });
      } else {
        // Mark all messages in channel as read
        const channelMessages = await db
          .select({ id: chatMessages.id })
          .from(chatMessages)
          .where(
            and(
              eq(chatMessages.channel, channel),
              sql`${chatMessages.userId} != ${userId}` // Don't mark own messages
            )
          );
        
        // Chat read tracking disabled - no database table
        // TODO: Implement if chat read tracking is needed
        const markedCount = channelMessages.length;
        
        res.json({ success: true, channel, userId, markedRead: markedCount });
      }
    } catch (error) {
      console.error("Error marking chat messages as read:", error);
      res.status(500).json({ error: "Failed to mark chat messages as read" });
    }
};

// Mark messages as read when user views a chat
const markMessagesRead = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || (req as any).session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { conversationId } = req.body;

      if (!conversationId) {
        return res.status(400).json({ error: "Conversation ID is required" });
      }

      // TODO: Implement read tracking when messageReads table is added
      res.json({ success: true, markedCount: 0 });
    } catch (error) {
      console.error("Error marking messages as read:", error);
      res.status(500).json({ error: "Failed to mark messages as read" });
    }
};

// Mark all messages as read for user
const markAllRead = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id || (req as any).session?.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // TODO: Implement when messageReads table is added
      res.json({ success: true, markedCount: 0 });
    } catch (error) {
      console.error("Error marking all messages as read:", error);
      res.status(500).json({ error: "Failed to mark all messages as read" });
    }
};

// Register routes function
export function registerMessageNotificationRoutes(app: Express) {
  // Use the proper unread counts function with the existing database schema
  app.get('/api/message-notifications/unread-counts', isAuthenticated, getUnreadCounts);
  app.post("/api/message-notifications/mark-read", isAuthenticated, markMessagesRead);
  app.post("/api/message-notifications/mark-chat-read", isAuthenticated, markChatMessagesRead);
  app.post("/api/message-notifications/mark-all-read", isAuthenticated, markAllRead);
}

// Legacy export for backward compatibility
export const messageNotificationRoutes = {
  getUnreadCounts,
  markMessagesRead,
  markChatMessagesRead,
  markAllRead
};