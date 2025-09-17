import { Router } from 'express';
import { messagingService } from '../services/messaging-service';
import { isAuthenticated } from '../temp-auth';

const router = Router();

// Get unread messages for the user
router.get('/unread', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { groupByContext } = req.query;

    if (groupByContext) {
      // Get unread counts by context
      const contextCounts = await messagingService.getUnreadCountsByContext(user.id);
      res.json(contextCounts);
    } else {
      // Get unread messages
      const messages = await messagingService.getUnreadMessages(user.id);
      res.json({ messages });
    }
  } catch (error) {
    console.error('[Messaging API] Error fetching unread messages:', error);
    res.json({ messages: [] });
  }
});

// Get unnotified kudos for login notifications
router.get('/kudos/unnotified', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    console.log(`[Messaging API] Getting unnotified kudos for user: ${user.email}`);

    const unnotifiedKudos = await messagingService.getUnnotifiedKudos(user.id);

    // Ensure we always return an array
    const kudosArray = Array.isArray(unnotifiedKudos) ? unnotifiedKudos : [];

    console.log(`[Messaging API] Found ${kudosArray.length} unnotified kudos`);
    res.json(kudosArray);
  } catch (error) {
    console.error('[Messaging API] Error fetching unnotified kudos:', error);
    // Return empty array on error to prevent slice errors
    res.json([]);
  }
});

// Mark kudos as initially notified
router.post('/kudos/mark-initial-notified', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { kudosIds } = req.body;

    if (!kudosIds || !Array.isArray(kudosIds)) {
      return res.status(400).json({ message: 'kudosIds array is required' });
    }

    console.log(`[Messaging API] Marking ${kudosIds.length} kudos as initially notified for user: ${user.email}`);

    await messagingService.markKudosInitiallyNotified(user.id, kudosIds);

    res.json({ success: true, message: 'Kudos marked as initially notified' });
  } catch (error) {
    console.error('[Messaging API] Error marking kudos as initially notified:', error);
    res.status(500).json({ message: 'Failed to mark kudos as initially notified' });
  }
});

// Get received kudos for a user
router.get('/kudos/received', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    console.log(`[Messaging API] Getting received kudos for user: ${user.email}`);

    const kudos = await messagingService.getReceivedKudos(user.id);

    // Ensure we always return an array
    const kudosArray = Array.isArray(kudos) ? kudos : [];

    console.log(`[Messaging API] Found ${kudosArray.length} received kudos`);
    res.json(kudosArray);
  } catch (error) {
    console.error('[Messaging API] Error fetching received kudos:', error);
    // Return empty array on error
    res.json([]);
  }
});

// Send kudos
router.post('/kudos/send', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const {
      recipientId,
      content,
      contextType,
      contextId,
      entityName,
    } = req.body;

    if (!recipientId || !contextType || !contextId || !entityName) {
      return res.status(400).json({ 
        message: 'recipientId, contextType, contextId, and entityName are required' 
      });
    }

    console.log(`[Messaging API] Sending kudos from ${user.email} to ${recipientId}`);

    const result = await messagingService.sendKudos({
      senderId: user.id,
      recipientId,
      content,
      contextType,
      contextId,
      entityName,
    });

    res.json(result);
  } catch (error) {
    console.error('[Messaging API] Error sending kudos:', error);
    res.status(500).json({ message: 'Failed to send kudos' });
  }
});

// Check if kudos was already sent
router.get('/kudos/check', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { recipientId, contextType, contextId } = req.query;

    if (!recipientId || !contextType || !contextId) {
      return res.status(400).json({ 
        message: 'recipientId, contextType, and contextId are required' 
      });
    }

    const hasSent = await messagingService.hasKudosSent(
      user.id,
      recipientId as string,
      contextType as string,
      contextId as string
    );

    res.json({ hasSent });
  } catch (error) {
    console.error('[Messaging API] Error checking kudos status:', error);
    res.status(500).json({ message: 'Failed to check kudos status' });
  }
});

export default router;
