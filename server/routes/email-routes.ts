import { Router } from 'express';
import { emailService } from '../services/email-service';
import { isAuthenticated } from '../temp-auth';
import { db } from '../db';
import { kudosTracking, users, emailMessages } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { storage } from '../storage-wrapper';

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
    console.log(
      `[Email API] Getting emails for folder: ${folder}, user: ${user.email}, threaded: ${threaded}`
    );

    // Threading removed - always return flat list
    {
      // Return flat list of emails
      const emails = await emailService.getEmailsByFolder(user.id, folder);

      // Format emails for Gmail interface
      const formattedEmails = emails.map((email) => ({
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
        committee: email.contextType || 'email',
      }));

      console.log(
        `[Email API] Found ${formattedEmails.length} emails in ${folder}`
      );
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

    const {
      recipientId,
      recipientName,
      recipientEmail,
      subject,
      content,
      isDraft,
      contextType,
      contextId,
      contextTitle,
      attachments,
      includeSchedulingLink,
      requestPhoneCall,
    } = req.body;

    if (!subject || !content) {
      return res
        .status(400)
        .json({ message: 'Subject and content are required' });
    }

    if (!isDraft && (!recipientId || !recipientName || !recipientEmail)) {
      return res
        .status(400)
        .json({ message: 'Recipient information is required' });
    }

    console.log(
      `[Email API] Sending email from ${user.email} to ${recipientEmail}`
    );

    // Get user's complete profile data including preferred email and phone number
    const fullUserData = await storage.getUser(user.id);
    
    const newEmail = await emailService.sendEmail({
      senderId: user.id,
      senderName: `${user.firstName} ${user.lastName}`.trim() || user.email,
      senderEmail: user.email,
      senderPreferredEmail: fullUserData?.preferredEmail,
      senderPhoneNumber: fullUserData?.phoneNumber,
      recipientId: recipientId || user.id, // For drafts
      recipientName: recipientName || 'Draft',
      recipientEmail: recipientEmail || user.email,
      subject,
      content,
      // Threading removed
      contextType: contextType || null,
      contextId: contextId || null,
      contextTitle: contextTitle || null,
      attachments: attachments || [],
      includeSchedulingLink: includeSchedulingLink || false,
      requestPhoneCall: requestPhoneCall || false,
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
      .select({
        messageId: kudosTracking.messageId,
        recipientId: kudosTracking.recipientId,
      })
      .from(kudosTracking)
      .where(eq(kudosTracking.id, emailId))
      .limit(1);

    let actualEmailId = emailId;

    if (kudoCheck.length > 0) {
      // This is a kudo ID, get the actual message ID
      actualEmailId = kudoCheck[0].messageId;
      console.log(
        `[Email API] Kudo ${emailId} corresponds to message ${actualEmailId}`
      );

      // Verify user is the recipient of this kudo
      if (kudoCheck[0].recipientId !== user.id) {
        return res
          .status(403)
          .json({ message: 'Not authorized to update this kudo' });
      }
    }

    if (!actualEmailId) {
      return res
        .status(404)
        .json({ message: 'No corresponding message found for this kudo' });
    }

    const success = await emailService.updateEmailStatus(
      actualEmailId,
      user.id,
      updates
    );

    if (!success) {
      return res
        .status(404)
        .json({ message: 'Email not found or access denied' });
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
      return res
        .status(404)
        .json({ message: 'Email not found or access denied' });
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

// Get drafts for a specific event request
router.get('/event/:eventRequestId/drafts', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { eventRequestId } = req.params;
    
    if (!eventRequestId) {
      return res.status(400).json({ message: 'Event request ID is required' });
    }

    console.log(`[Email API] Getting drafts for event request ${eventRequestId}, user: ${user.email}`);

    const drafts = await emailService.getDraftsByContext(
      user.id,
      'event_request',
      eventRequestId
    );

    // Format drafts for the email composer
    const formattedDrafts = drafts.map((draft) => ({
      id: draft.id,
      subject: draft.subject,
      content: draft.content,
      recipientName: draft.recipientName,
      recipientEmail: draft.recipientEmail,
      contextType: draft.contextType,
      contextId: draft.contextId,
      contextTitle: draft.contextTitle,
      attachments: draft.attachments || [],
      includeSchedulingLink: draft.includeSchedulingLink || false,
      requestPhoneCall: draft.requestPhoneCall || false,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    }));

    console.log(`[Email API] Found ${formattedDrafts.length} drafts for event request ${eventRequestId}`);
    res.json(formattedDrafts);
  } catch (error) {
    console.error('[Email API] Error fetching event drafts:', error);
    res.status(500).json({ message: 'Failed to fetch event drafts' });
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
      readAt: kudo.readAt,
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

    console.log(
      `[Email API] Marking message ${messageId} as read for user: ${user.email}`
    );

    // First check if this is a kudo ID instead of a message ID
    const kudoCheck = await db
      .select({
        messageId: kudosTracking.messageId,
        recipientId: kudosTracking.recipientId,
      })
      .from(kudosTracking)
      .where(eq(kudosTracking.id, messageId))
      .limit(1);

    let actualMessageId = messageId;

    if (kudoCheck.length > 0) {
      // This is a kudo ID, get the actual message ID
      actualMessageId = kudoCheck[0].messageId;
      console.log(
        `[Email API] Kudo ${messageId} corresponds to message ${actualMessageId}`
      );

      // Verify user is the recipient of this kudo
      if (kudoCheck[0].recipientId !== user.id) {
        return res
          .status(403)
          .json({ message: 'Not authorized to mark this kudo as read' });
      }
    }

    if (!actualMessageId) {
      return res
        .status(404)
        .json({ message: 'No corresponding message found for this kudo' });
    }

    // Import messaging service dynamically to avoid circular dependency
    const { messagingService } = await import('../services/messaging-service');

    // Mark the message as read in messageRecipients
    const success = await messagingService.markMessageRead(
      user.id,
      actualMessageId
    );

    if (!success) {
      return res
        .status(404)
        .json({ message: 'Message not found or already read' });
    }

    res.json({ success: true, message: 'Message marked as read' });
  } catch (error) {
    console.error('[Email API] Error marking message as read:', error);
    res.status(500).json({ message: 'Failed to mark message as read' });
  }
});

// Event-specific email endpoint with attachment support
router.post('/event', isAuthenticated, async (req: any, res) => {
  try {
    const user = req.user;
    if (!user?.id) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const {
      eventRequestId,
      recipientEmail,
      recipientName,
      subject,
      content,
      isDraft,
      attachments = [],
      contextType,
      contextId,
      contextTitle,
    } = req.body;

    if (!subject || !content) {
      return res
        .status(400)
        .json({ message: 'Subject and content are required' });
    }

    if (!isDraft && !recipientEmail) {
      return res.status(400).json({ message: 'Recipient email is required' });
    }

    console.log(
      `[Event Email API] Sending event email from ${user.email} to ${recipientEmail}`
    );
    console.log(`[Event Email API] Attachments: ${attachments.join(', ')}`);

    // Get user's complete profile data
    const fullUserData = await storage.getUser(user.id);
    const senderName = `${fullUserData?.firstName} ${fullUserData?.lastName}`.trim() || user.email;
    const replyToEmail = fullUserData?.preferredEmail || user.email;

    // For drafts, save to internal email system
    if (isDraft) {
      const newEmail = await emailService.sendEmail({
        senderId: user.id,
        senderName,
        senderEmail: user.email,
        senderPreferredEmail: fullUserData?.preferredEmail,
        senderPhoneNumber: fullUserData?.phoneNumber,
        recipientId: 'external',
        recipientName: recipientName || 'Event Contact',
        recipientEmail: recipientEmail || user.email,
        subject,
        content,
        isDraft: true,
        contextType: contextType || 'event_request',
        contextId: contextId || eventRequestId?.toString(),
        contextTitle: contextTitle || `Event Communication`,
        attachments,
      });

      console.log('[Event Email API] Draft saved successfully');
      return res.json({
        success: true,
        message: 'Draft saved successfully',
        emailId: newEmail.id,
      });
    }

    // For actual emails, send directly via SendGrid without wrapper
    const { sendEmail: sendGridEmail } = await import('../sendgrid');
    const { documents } = await import('@shared/schema');
    const { inArray } = await import('drizzle-orm');

    // Check if content is already full HTML (starts with <!DOCTYPE html>)
    const isFullHtml = content.trim().startsWith('<!DOCTYPE html>');
    
    // Convert content line breaks and markdown only if not already HTML
    let htmlContent;
    let textContent;
    
    if (isFullHtml) {
      // Content is already formatted HTML - use as-is
      htmlContent = content;
      // Extract text from HTML for plain text version (simple extraction)
      textContent = content
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    } else {
      // Convert markdown-style content to HTML
      htmlContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
      textContent = content;
    }

    // Process attachments - handle both document IDs and file paths
    let processedAttachments = [];
    if (attachments && attachments.length > 0) {
      const path = await import('path');
      
      for (const attachment of attachments) {
        // Check if it's a document ID (number) or file path (string)
        const docId = typeof attachment === 'string' ? parseInt(attachment) : attachment;
        
        if (!isNaN(docId)) {
          // It's a document ID - fetch from database
          const docs = await db
            .select({
              id: documents.id,
              filePath: documents.filePath,
              originalName: documents.originalName,
            })
            .from(documents)
            .where(inArray(documents.id, [docId]));
          
          if (docs.length > 0) {
            processedAttachments.push({
              filePath: docs[0].filePath,
              originalName: docs[0].originalName || undefined,
            });
          }
        } else if (typeof attachment === 'string' && attachment.startsWith('/uploads/')) {
          // It's a file path - use directly
          const absolutePath = path.join(process.cwd(), attachment);
          const fileName = path.basename(attachment);
          processedAttachments.push({
            filePath: absolutePath,
            originalName: fileName,
          });
        }
      }
    }

    // Send clean professional email via SendGrid
    const { EMAIL_FOOTER_TEXT, EMAIL_FOOTER_HTML } = await import('../utils/email-footer');
    
    // For full HTML documents, inject footer before closing tags
    let finalHtml;
    if (isFullHtml) {
      // Insert footer before </body></html>
      finalHtml = htmlContent.replace(
        /<\/body>\s*<\/html>/i,
        `${EMAIL_FOOTER_HTML}</body></html>`
      );
    } else {
      finalHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="white-space: pre-wrap; line-height: 1.6;">
            ${htmlContent}
          </div>
          ${EMAIL_FOOTER_HTML}
        </div>
      `;
    }
    
    await sendGridEmail({
      to: recipientEmail,
      from: 'katie@thesandwichproject.org',
      replyTo: replyToEmail,
      bcc: 'katielong2316@gmail.com', // BCC to Katie for quality monitoring
      subject,
      text: `${textContent}\n\n${EMAIL_FOOTER_TEXT}`,
      html: finalHtml,
      attachments: processedAttachments,
    });

    // Save a record in internal email system (without sending duplicate)
    const newEmail = await db.insert(emailMessages).values({
      senderId: user.id,
      senderName,
      senderEmail: user.email,
      recipientId: 'external',
      recipientName: recipientName || 'Event Contact',
      recipientEmail,
      subject,
      content,
      contextType: contextType || 'event_request',
      contextId: contextId || eventRequestId?.toString(),
      contextTitle: contextTitle || `Event Communication`,
      attachments,
      isDraft: false,
      isRead: true,
      isStarred: false,
      isArchived: false,
      isTrashed: false,
      includeSchedulingLink: false,
      requestPhoneCall: false,
    }).returning();

    console.log('[Event Email API] Email sent successfully');
    res.json({
      success: true,
      message: 'Email sent successfully',
      emailId: newEmail[0].id,
    });
  } catch (error) {
    console.error('[Event Email API] Error:', error);
    res.status(500).json({
      message: 'Failed to send email',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
