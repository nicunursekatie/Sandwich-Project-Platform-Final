import { Router, Response } from 'express';
import { db } from '../db';
import { instantMessages, users } from '@shared/schema';
import { eq, or, and, desc } from 'drizzle-orm';
import { isAuthenticated } from '../auth';
import { AuthenticatedRequest } from '../types';
import { logger } from '../utils/production-safe-logger';
import { getSocketInstance } from '../socket-chat';

const router = Router();

// Get conversation with a specific user
router.get('/:userId', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const otherUserId = req.params.userId;

    // Get all messages between current user and the other user
    const messages = await db
      .select()
      .from(instantMessages)
      .where(
        or(
          and(
            eq(instantMessages.senderId, currentUser.id),
            eq(instantMessages.recipientId, otherUserId)
          ),
          and(
            eq(instantMessages.senderId, otherUserId),
            eq(instantMessages.recipientId, currentUser.id)
          )
        )
      )
      .orderBy(instantMessages.createdAt)
      .limit(100);

    // Mark messages from the other user as read
    await db
      .update(instantMessages)
      .set({ read: true, readAt: new Date() })
      .where(
        and(
          eq(instantMessages.senderId, otherUserId),
          eq(instantMessages.recipientId, currentUser.id),
          eq(instantMessages.read, false)
        )
      );

    res.json(messages);
  } catch (error) {
    logger.error('[Instant Messages] Error fetching conversation:', error);
    res.status(500).json({ message: 'Failed to fetch conversation' });
  }
});

// Send a new instant message
router.post('/', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { recipientId, content } = req.body;

    if (!recipientId || !content?.trim()) {
      return res.status(400).json({ message: 'recipientId and content are required' });
    }

    // Get sender's display name
    const senderName =
      currentUser.displayName ||
      `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() ||
      currentUser.email ||
      'Unknown User';

    // Insert the message
    const [newMessage] = await db
      .insert(instantMessages)
      .values({
        senderId: currentUser.id,
        senderName,
        recipientId,
        content: content.trim(),
        read: false,
      })
      .returning();

    logger.log(`[Instant Messages] Message sent from ${currentUser.id} to ${recipientId}`);

    // Emit to recipient via Socket.IO for real-time delivery
    const io = getSocketInstance();
    if (io) {
      // Emit to recipient's messaging channel
      io.to(`messaging:${recipientId}`).emit('instant_message', newMessage);
      // Also emit to sender's messaging channel (for multi-device sync)
      io.to(`messaging:${currentUser.id}`).emit('instant_message', newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    logger.error('[Instant Messages] Error sending message:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
});

// Mark messages from a user as read
router.post('/:userId/read', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const otherUserId = req.params.userId;

    await db
      .update(instantMessages)
      .set({ read: true, readAt: new Date() })
      .where(
        and(
          eq(instantMessages.senderId, otherUserId),
          eq(instantMessages.recipientId, currentUser.id),
          eq(instantMessages.read, false)
        )
      );

    res.json({ success: true });
  } catch (error) {
    logger.error('[Instant Messages] Error marking messages as read:', error);
    res.status(500).json({ message: 'Failed to mark messages as read' });
  }
});

// Get unread count for instant messages
router.get('/unread/count', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const unreadMessages = await db
      .select()
      .from(instantMessages)
      .where(
        and(
          eq(instantMessages.recipientId, currentUser.id),
          eq(instantMessages.read, false)
        )
      );

    // Group by sender to get count per conversation
    const countBySender = unreadMessages.reduce((acc, msg) => {
      acc[msg.senderId] = (acc[msg.senderId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      total: unreadMessages.length,
      bySender: countBySender,
    });
  } catch (error) {
    logger.error('[Instant Messages] Error getting unread count:', error);
    res.status(500).json({ message: 'Failed to get unread count' });
  }
});

// Get recent conversations (list of users you've chatted with)
router.get('/conversations/recent', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Get distinct users this user has conversed with
    const sentMessages = await db
      .selectDistinct({ recipientId: instantMessages.recipientId })
      .from(instantMessages)
      .where(eq(instantMessages.senderId, currentUser.id));

    const receivedMessages = await db
      .selectDistinct({ senderId: instantMessages.senderId })
      .from(instantMessages)
      .where(eq(instantMessages.recipientId, currentUser.id));

    // Combine unique user IDs
    const userIds = new Set([
      ...sentMessages.map(m => m.recipientId),
      ...receivedMessages.map(m => m.senderId),
    ]);

    // Get user details for each conversation partner
    const conversationPartners = await Promise.all(
      Array.from(userIds).map(async (userId) => {
        const [user] = await db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            displayName: users.displayName,
            email: users.email,
            profileImageUrl: users.profileImageUrl,
          })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!user) return null;

        // Get last message and unread count
        const [lastMessage] = await db
          .select()
          .from(instantMessages)
          .where(
            or(
              and(
                eq(instantMessages.senderId, currentUser.id),
                eq(instantMessages.recipientId, userId)
              ),
              and(
                eq(instantMessages.senderId, userId),
                eq(instantMessages.recipientId, currentUser.id)
              )
            )
          )
          .orderBy(desc(instantMessages.createdAt))
          .limit(1);

        const unreadMessages = await db
          .select()
          .from(instantMessages)
          .where(
            and(
              eq(instantMessages.senderId, userId),
              eq(instantMessages.recipientId, currentUser.id),
              eq(instantMessages.read, false)
            )
          );

        return {
          user,
          lastMessage,
          unreadCount: unreadMessages.length,
        };
      })
    );

    // Filter out nulls and sort by last message time
    const validConversations = conversationPartners
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => {
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return new Date(b.lastMessage.createdAt!).getTime() - new Date(a.lastMessage.createdAt!).getTime();
      });

    res.json(validConversations);
  } catch (error) {
    logger.error('[Instant Messages] Error getting recent conversations:', error);
    res.status(500).json({ message: 'Failed to get recent conversations' });
  }
});

export default router;
