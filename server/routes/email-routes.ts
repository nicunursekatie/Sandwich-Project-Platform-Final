import { Router } from 'express';
import { emailService } from '../services/email-service';
import { isAuthenticated } from '../temp-auth';
import { db } from '../db';
import { kudosTracking } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Get emails by folder with optional threading
router.get('/', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const folder = (req.query.folder as string) || 'inbox';
    const threaded = req.query.threaded === 'true';
    console.log(`[Email API] Getting emails for folder: ${folder}, user: ${user.email}, threaded: ${threaded}`);

    // Threading removed - always return flat list
    {
      // Return flat list of emails
      const emails = await emailService.getEmailsByFolder(user.id, folder);
      
      // Format emails for Gmail interface
      const formattedEmails = emails.map(email => ({
        id: email.id,
        senderId: email.senderId,
        senderName: email.senderName,
        senderEmail: email.senderEmail,
        recipientId: email.recipientId,
        recipientName: email.recipientName,
        recipientEmail: email.recipientEmail,
        content: email.content,
        subject: email.subject,
        createdAt: email.createdAt,
        threadId: email.id, // No threading - use email ID
        isRead: email.isRead,
        isStarred: email.isStarred,
        folder: folder,
        committee: email.contextType || 'email'
      }));

      console.log(`[Email API] Found ${formattedEmails.length} emails in ${folder}`);
      res.json(formattedEmails);
    }
  } catch (error) {
    console.error('[Email API] Error fetching emails:', error);
    res.status(500).json({ message: 'Failed to fetch emails' });
  }
});

// Send new email
router.post('/', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { recipientId, recipientName, recipientEmail, subject, content, isDraft, contextType, contextId, contextTitle } = req.body;

    if (!subject || !content) {
      return res.status(400).json({ message: 'Subject and content are required' });
    }

    if (!isDraft && (!recipientId || !recipientName || !recipientEmail)) {
      return res.status(400).json({ message: 'Recipient information is required' });
    }

    console.log(`[Email API] Sending email from ${user.email} to ${recipientEmail}`);

    const newEmail = await emailService.sendEmail({
      senderId: user.id,
      senderName: `${user.firstName} ${user.lastName}`.trim() || user.email,
      senderEmail: user.email,
      recipientId: recipientId || user.id, // For drafts
      recipientName: recipientName || 'Draft',
      recipientEmail: recipientEmail || user.email,
      subject,
      content,
      // Threading removed
      contextType: contextType || null,
      contextId: contextId || null,
      contextTitle: contextTitle || null,
      isDraft: isDraft || false,
    });

    res.status(201).json(newEmail);
  } catch (error) {
    console.error('[Email API] Error sending email:', error);
    res.status(500).json({ message: 'Failed to send email' });
  }
});

// Update email status (star, archive, trash, mark read)
router.patch('/:id', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const emailId = parseInt(req.params.id);
    const updates = req.body;

    console.log(`[Email API] Updating email ${emailId} status:`, updates);

    // Check if this is a kudo ID instead of an email ID
    const kudoCheck = await db
      .select({ messageId: kudosTracking.messageId, recipientId: kudosTracking.recipientId })
      .from(kudosTracking)
      .where(eq(kudosTracking.id, emailId))
      .limit(1);

    let actualEmailId = emailId;
    
    if (kudoCheck.length > 0) {
      // This is a kudo ID, get the actual message ID  
      actualEmailId = kudoCheck[0].messageId;
      console.log(`[Email API] Kudo ${emailId} corresponds to message ${actualEmailId}`);
      
      // Verify user is the recipient of this kudo
      if (kudoCheck[0].recipientId !== user.id) {
        return res.status(403).json({ message: 'Not authorized to update this kudo' });
      }
    }

    if (!actualEmailId) {
      return res.status(404).json({ message: 'No corresponding message found for this kudo' });
    }

    const success = await emailService.updateEmailStatus(actualEmailId, user.id, updates);

    if (!success) {
      return res.status(404).json({ message: 'Email not found or access denied' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Email API] Error updating email:', error);
    res.status(500).json({ message: 'Failed to update email' });
  }
});

// Delete email
router.delete('/:id', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const emailId = parseInt(req.params.id);
    console.log(`[Email API] Deleting email ${emailId} for user ${user.email}`);

    const success = await emailService.deleteEmail(emailId, user.id);

    if (!success) {
      return res.status(404).json({ message: 'Email not found or access denied' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('[Email API] Error deleting email:', error);
    res.status(500).json({ message: 'Failed to delete email' });
  }
});

// Get unread email count
router.get('/unread-count', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const count = await emailService.getUnreadEmailCount(user.id);
    res.json({ count });
  } catch (error) {
    console.error('[Email API] Error getting unread count:', error);
    res.status(500).json({ message: 'Failed to get unread count' });
  }
});

// Search emails
router.get('/search', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const searchTerm = req.query.q as string;
    if (!searchTerm) {
      return res.status(400).json({ message: 'Search term is required' });
    }

    console.log(`[Email API] Searching emails for "${searchTerm}"`);

    const emails = await emailService.searchEmails(user.id, searchTerm);
    res.json(emails);
  } catch (error) {
    console.error('[Email API] Error searching emails:', error);
    res.status(500).json({ message: 'Failed to search emails' });
  }
});

// Get kudos for current user - integrates with messaging system
router.get('/kudos', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    console.log(`[Email API] Getting kudos for user: ${user.email}`);

    // Import here to avoid circular dependency
    const { messagingService } = await import('../services/messaging-service');
    const kudos = await messagingService.getReceivedKudos(user.id);

    // Format kudos for Gmail interface
    const formattedKudos = kudos.map((kudo: any) => ({
      id: kudo.id,
      sender: kudo.sender,
      senderName: kudo.senderName,
      message: kudo.message,
      content: kudo.message,
      projectTitle: kudo.projectTitle,
      entityName: kudo.entityName,
      contextType: kudo.contextType,
      contextId: kudo.contextId,
      createdAt: kudo.createdAt,
      sentAt: kudo.sentAt,
      isRead: kudo.isRead,
      readAt: kudo.readAt
    }));

    console.log(`[Email API] Found ${formattedKudos.length} kudos`);
    res.json(formattedKudos);
  } catch (error) {
    console.error('[Email API] Error fetching kudos:', error);
    res.status(500).json({ message: 'Failed to fetch kudos' });
  }
});

// Mark message as read - works for both emails and kudos
router.post('/:messageId/read', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const messageId = parseInt(req.params.messageId);
    if (isNaN(messageId)) {
      return res.status(400).json({ message: 'Invalid message ID' });
    }

    console.log(`[Email API] Marking message ${messageId} as read for user: ${user.email}`);

    // First check if this is a kudo ID instead of a message ID
    const kudoCheck = await db
      .select({ messageId: kudosTracking.messageId, recipientId: kudosTracking.recipientId })
      .from(kudosTracking)
      .where(eq(kudosTracking.id, messageId))
      .limit(1);

    let actualMessageId = messageId;
    
    if (kudoCheck.length > 0) {
      // This is a kudo ID, get the actual message ID
      actualMessageId = kudoCheck[0].messageId;
      console.log(`[Email API] Kudo ${messageId} corresponds to message ${actualMessageId}`);
      
      // Verify user is the recipient of this kudo
      if (kudoCheck[0].recipientId !== user.id) {
        return res.status(403).json({ message: 'Not authorized to mark this kudo as read' });
      }
    }

    if (!actualMessageId) {
      return res.status(404).json({ message: 'No corresponding message found for this kudo' });
    }

    // Import messaging service dynamically to avoid circular dependency
    const { messagingService } = await import('../services/messaging-service');
    
    // Mark the message as read in messageRecipients
    const success = await messagingService.markMessageRead(user.id, actualMessageId);
    
    if (!success) {
      return res.status(404).json({ message: 'Message not found or already read' });
    }

    res.json({ success: true, message: 'Message marked as read' });
  } catch (error) {
    console.error('[Email API] Error marking message as read:', error);
    res.status(500).json({ message: 'Failed to mark message as read' });
  }
});

export default router;