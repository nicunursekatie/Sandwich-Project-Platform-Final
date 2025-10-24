import { Request, Response, Router } from 'express';
import type { RouterDependencies } from '../types';
import { eq, sql, and, gt, or, isNull } from 'drizzle-orm';
import {
  messages,
  messageRecipients,
  conversations,
  conversationParticipants,
  chatMessages,
  kudosTracking,
  users,
  emailMessages,
} from '../../shared/schema';
import { db } from '../db';
import { hasPermission, PERMISSIONS } from '../../shared/auth-utils';
import { logger } from '../../utils/production-safe-logger';

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
    logger.log('=== UNREAD COUNTS REQUEST ===');
    logger.log('req.user exists:', !!(req as any).user);
    logger.log('req.user?.id:', (req as any).user?.id);
    logger.log('req.session exists:', !!(req as any).session);
    logger.log('req.session?.user exists:', !!(req as any).session?.user);

    // Try to get user from both req.user and req.session.user for compatibility
    const userId = (req as any).user?.id || (req as any).session?.user?.id;
    const user = (req as any).user || (req as any).session?.user;

    if (!userId || !user) {
      logger.log('Authentication failed: No user ID found');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    logger.log('Using user data:', {
      id: userId,
      permissions: user.permissions?.length || 0,
    });

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
      total: 0,
    };

    try {
      // Get chat message counts from Socket.IO chat system (chat_messages table)
      const chatChannels = [
        { channel: 'general', permission: 'general_chat', key: 'general' },
        {
          channel: 'core-team',
          permission: 'core_team_chat',
          key: 'core_team',
        },
        {
          channel: 'committee',
          permission: 'committee_chat',
          key: 'committee',
        },
        { channel: 'host', permission: 'host_chat', key: 'hosts' },
        { channel: 'driver', permission: 'driver_chat', key: 'drivers' },
        {
          channel: 'recipient',
          permission: 'recipient_chat',
          key: 'recipients',
        },
      ];

      for (const { channel, permission, key } of chatChannels) {
        // Check if user has permission to see this channel
        if (!checkUserChatPermission(user, key)) {
          continue;
        }

        // Count unread messages in this channel (messages that haven't been marked as read)
        const { chatMessageReads } = await import('../../shared/schema');
        const unreadCount = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(chatMessages)
          .leftJoin(
            chatMessageReads,
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

        unreadCounts.direct = parseInt(
          String(directMessageCount[0]?.count || 0)
        );
        unreadCounts.groups = 0; // Groups functionality not implemented yet
      } catch (directMsgError) {
        logger.error('Error getting direct message counts:', directMsgError);
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
        logger.error('Error getting kudos counts:', kudosError);
        unreadCounts.kudos = 0;
      }

      // Calculate total
      unreadCounts.total =
        unreadCounts.general +
        unreadCounts.committee +
        unreadCounts.hosts +
        unreadCounts.drivers +
        unreadCounts.recipients +
        unreadCounts.core_team +
        unreadCounts.direct +
        unreadCounts.groups +
        unreadCounts.kudos;
    } catch (dbError) {
      logger.error('Database query error in unread counts:', dbError);
      // Return fallback counts on database error
    }

    res.json(unreadCounts);
  } catch (error) {
    logger.error('Error getting unread counts:', error);
    res.status(500).json({ error: 'Failed to get unread counts' });
  }
};

// Mark chat messages as read when user views a chat channel
const markChatMessagesRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { channel, messageIds } = req.body;

    if (!channel) {
      return res.status(400).json({ error: 'Channel is required' });
    }

    logger.log(
      `Marking chat messages as read for user ${userId} in channel ${channel}`
    );

    // If specific message IDs are provided, mark those
    if (messageIds && Array.isArray(messageIds)) {
      const { chatMessageReads } = await import('../../shared/schema');
      
      // Convert to integers and get message details
      const numericIds = messageIds
        .map(id => parseInt(String(id)))
        .filter(id => !isNaN(id));

      // Insert read tracking records for each message, ignoring duplicates
      let markedCount = 0;
      for (const messageId of numericIds) {
        try {
          const result = await db
            .insert(chatMessageReads)
            .values({
              messageId,
              userId,
              channel,
            })
            .onConflictDoNothing()
            .returning();
          
          // Only count if row was actually inserted (not skipped due to conflict)
          if (result.length > 0) {
            markedCount++;
          }
        } catch (err) {
          // Silently handle duplicates - this is expected
          logger.log(`Message ${messageId} already marked as read for user ${userId}`);
        }
      }

      res.json({
        success: true,
        channel,
        userId,
        markedRead: markedCount,
      });
    } else {
      // Mark all messages in channel as read
      const { chatMessageReads } = await import('../../shared/schema');
      
      const channelMessages = await db
        .select({ id: chatMessages.id })
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.channel, channel),
            sql`${chatMessages.userId} != ${userId}` // Don't mark own messages
          )
        );

      // Insert read tracking records for all channel messages, ignoring duplicates
      let markedCount = 0;
      for (const message of channelMessages) {
        try {
          const result = await db
            .insert(chatMessageReads)
            .values({
              messageId: message.id,
              userId,
              channel,
            })
            .onConflictDoNothing()
            .returning();
          
          // Only count if row was actually inserted (not skipped due to conflict)
          if (result.length > 0) {
            markedCount++;
          }
        } catch (err) {
          // Silently handle duplicates - this is expected
          logger.log(`Message ${message.id} already marked as read for user ${userId}`);
        }
      }

      res.json({ success: true, channel, userId, markedRead: markedCount });
    }
  } catch (error) {
    logger.error('Error marking chat messages as read:', error);
    res.status(500).json({ error: 'Failed to mark chat messages as read' });
  }
};

// Mark messages as read when user views a chat
const markMessagesRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).session?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { conversationId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: 'Conversation ID is required' });
    }

    console.log(
      `Marking messages as read for user ${userId} in conversation ${conversationId}`
    );

    // Update messageRecipients to mark messages in this conversation as read
    const result = await db
      .update(messageRecipients)
      .set({
        read: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(messageRecipients.recipientId, userId),
          eq(messageRecipients.read, false),
          // Get messages from this conversation
          sql`${messageRecipients.messageId} IN (SELECT id FROM ${messages} WHERE ${messages.conversationId} = ${conversationId})`
        )
      )
      .returning({ id: messageRecipients.id });

    const markedCount = result.length;

    console.log(`Marked ${markedCount} messages as read`);

    res.json({ success: true, markedCount });
  } catch (error) {
    logger.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
};

// Mark all messages as read for user
const markAllRead = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).session?.user?.id;
    const user = (req as any).user || (req as any).session?.user;

    if (!userId || !user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log(`Marking all messages as read for user ${userId}`);

    let totalMarkedCount = 0;

    // 1. Mark all formal message recipients as read (messageRecipients)
    const messageRecipientsResult = await db
      .update(messageRecipients)
      .set({
        read: true,
        readAt: new Date(),
      })
      .where(
        and(
          eq(messageRecipients.recipientId, userId),
          eq(messageRecipients.read, false)
        )
      )
      .returning({ id: messageRecipients.id });

    totalMarkedCount += messageRecipientsResult.length;
    console.log(`Marked ${messageRecipientsResult.length} formal messages as read`);

    // 2. Mark all email inbox messages as read (emailMessages)
    const emailMessagesResult = await db
      .update(emailMessages)
      .set({
        isRead: true,
      })
      .where(
        and(
          eq(emailMessages.recipientId, userId),
          eq(emailMessages.isRead, false),
          eq(emailMessages.isDraft, false),
          eq(emailMessages.isTrashed, false),
          eq(emailMessages.isArchived, false)
        )
      )
      .returning({ id: emailMessages.id });

    totalMarkedCount += emailMessagesResult.length;
    console.log(`Marked ${emailMessagesResult.length} email messages as read`);

    // 3. Mark all chat messages as read (chatMessageReads)
    const { chatMessageReads } = await import('../../shared/schema');

    // Get all channels the user has permission to access
    const chatChannels = [
      { channel: 'general', key: 'general' },
      { channel: 'core-team', key: 'core_team' },
      { channel: 'committee', key: 'committee' },
      { channel: 'host', key: 'hosts' },
      { channel: 'driver', key: 'drivers' },
      { channel: 'recipient', key: 'recipients' },
    ];

    for (const { channel, key } of chatChannels) {
      // Check if user has permission to see this channel
      if (!checkUserChatPermission(user, key)) {
        continue;
      }

      // Get all unread messages in this channel
      const channelMessages = await db
        .select({ id: chatMessages.id })
        .from(chatMessages)
        .leftJoin(
          chatMessageReads,
          and(
            eq(chatMessageReads.messageId, chatMessages.id),
            eq(chatMessageReads.userId, userId)
          )
        )
        .where(
          and(
            eq(chatMessages.channel, channel),
            sql`${chatMessages.userId} != ${userId}`, // Don't mark own messages
            isNull(chatMessageReads.id) // Not already read
          )
        );

      // Insert read tracking records for all unread messages, ignoring duplicates
      for (const message of channelMessages) {
        try {
          const result = await db
            .insert(chatMessageReads)
            .values({
              messageId: message.id,
              userId,
              channel,
            })
            .onConflictDoNothing()
            .returning();

          if (result.length > 0) {
            totalMarkedCount++;
          }
        } catch (err) {
          // Silently handle duplicates - this is expected
          console.log(`Message ${message.id} already marked as read for user ${userId}`);
        }
      }
    }

    console.log(`Total marked ${totalMarkedCount} messages as read`);

    res.json({ success: true, markedCount: totalMarkedCount });
  } catch (error) {
    logger.error('Error marking all messages as read:', error);
    res.status(500).json({ error: 'Failed to mark all messages as read' });
  }
};

export function createMessageNotificationsRouter(deps: RouterDependencies) {
  const router = Router();
  const { isAuthenticated } = deps;

  // Use the proper unread counts function with the existing database schema
  router.get('/unread-counts', isAuthenticated, getUnreadCounts);
  router.post('/mark-read', isAuthenticated, markMessagesRead);
  router.post('/mark-chat-read', isAuthenticated, markChatMessagesRead);
  router.post('/mark-all-read', isAuthenticated, markAllRead);

  return router;
}
