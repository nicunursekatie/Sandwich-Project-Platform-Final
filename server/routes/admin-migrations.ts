/**
 * Admin migration routes for one-time data fixes
 * These endpoints should only be accessible to admins
 */

import { Router } from 'express';
import { db } from '../db';
import { emailMessages } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';

export function createAdminMigrationsRouter(deps: { isAuthenticated: any }) {
  const router = Router();
  const { isAuthenticated } = deps;

  /**
   * POST /api/admin/migrations/link-email-threads
   * Links existing email replies to their parent messages based on subject matching
   */
  router.post('/link-email-threads', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      // Check if user has admin access (you may want to add additional permission checks)
      // For now we just require authentication

      logger.log('[Migration] Starting email thread linking migration...');

      // Get all emails
      const allEmails = await db
        .select({
          id: emailMessages.id,
          senderId: emailMessages.senderId,
          senderName: emailMessages.senderName,
          recipientId: emailMessages.recipientId,
          recipientName: emailMessages.recipientName,
          subject: emailMessages.subject,
          parentMessageId: emailMessages.parentMessageId,
          createdAt: emailMessages.createdAt,
        })
        .from(emailMessages)
        .orderBy(emailMessages.createdAt);

      logger.log(`[Migration] Found ${allEmails.length} total emails`);

      // Find emails that look like replies but have no parentMessageId
      const replyEmails = allEmails.filter(
        (email) =>
          email.subject?.toLowerCase().startsWith('re: ') &&
          email.parentMessageId === null
      );

      logger.log(`[Migration] Found ${replyEmails.length} reply emails without parent links`);

      let linkedCount = 0;
      let notFoundCount = 0;
      const linkDetails: Array<{ replyId: number; parentId: number; subject: string }> = [];

      for (const reply of replyEmails) {
        // Extract the original subject (remove "Re: " prefix)
        let originalSubject = reply.subject;
        while (originalSubject?.toLowerCase().startsWith('re: ')) {
          originalSubject = originalSubject.substring(4);
        }

        if (!originalSubject) {
          notFoundCount++;
          continue;
        }

        // Find potential parent messages
        const potentialParents = allEmails.filter((email) => {
          if (!email.createdAt || !reply.createdAt) return false;
          if (new Date(email.createdAt) >= new Date(reply.createdAt)) return false;
          if (email.id === reply.id) return false;

          const emailSubject = email.subject?.toLowerCase().replace(/^(re:\s*)+/i, '');
          const replyOriginalSubject = originalSubject.toLowerCase();

          if (emailSubject !== replyOriginalSubject) return false;

          // Participants should be related
          const isRelated =
            (reply.senderId === email.recipientId && reply.recipientId === email.senderId) ||
            (reply.senderId === email.senderId && reply.recipientId === email.recipientId) ||
            (reply.recipientId === email.senderId);

          return isRelated;
        });

        if (potentialParents.length === 0) {
          notFoundCount++;
          continue;
        }

        // Get most recent potential parent
        potentialParents.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });

        const parent = potentialParents[0];

        // Update the reply with parent message ID
        await db
          .update(emailMessages)
          .set({ parentMessageId: parent.id })
          .where(eq(emailMessages.id, reply.id));

        linkDetails.push({
          replyId: reply.id,
          parentId: parent.id,
          subject: reply.subject || '',
        });
        linkedCount++;
      }

      logger.log(`[Migration] Migration complete. Linked: ${linkedCount}, Not found: ${notFoundCount}`);

      res.json({
        success: true,
        summary: {
          totalEmails: allEmails.length,
          replyEmailsFound: replyEmails.length,
          successfullyLinked: linkedCount,
          couldNotFindParent: notFoundCount,
        },
        linkedEmails: linkDetails,
      });
    } catch (error) {
      logger.error('[Migration] Error during email thread migration:', error);
      res.status(500).json({
        message: 'Migration failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return router;
}
