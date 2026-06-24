import { Router } from 'express';
import type { RouterDependencies } from '../types';
import { db } from '../db';
import { emailDrafts } from '@shared/schema';
import { and, desc, eq } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';

// CRUD for "Project Threads" compose drafts (gmail-style-inbox auto-save).
// Backed by the email_drafts table; every draft is scoped to its owning user.
export function createEmailDraftsRouter(deps: RouterDependencies) {
  const router = Router();
  const { isAuthenticated } = deps;

  // List the current user's drafts (newest first)
  router.get('/', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const drafts = await db
        .select()
        .from(emailDrafts)
        .where(eq(emailDrafts.userId, user.id))
        .orderBy(desc(emailDrafts.lastSaved));
      res.json(drafts);
    } catch (error) {
      logger.error('[Drafts API] Error listing drafts:', error);
      res.status(500).json({ message: 'Failed to fetch drafts' });
    }
  });

  // Create a new draft
  router.post('/', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const { recipientId, recipientName, subject, content } = req.body ?? {};
      const [draft] = await db
        .insert(emailDrafts)
        .values({
          userId: user.id,
          recipientId: recipientId ?? '',
          recipientName: recipientName ?? '',
          subject: subject ?? '',
          content: content ?? '',
          lastSaved: new Date(),
        })
        .returning();
      res.status(201).json(draft);
    } catch (error) {
      logger.error('[Drafts API] Error creating draft:', error);
      res.status(500).json({ message: 'Failed to create draft' });
    }
  });

  // Update an existing draft (only fields provided are changed), owner-scoped
  router.put('/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: 'Invalid draft id' });
      }
      const { recipientId, recipientName, subject, content } = req.body ?? {};
      const updates: Record<string, unknown> = { lastSaved: new Date() };
      if (recipientId !== undefined) updates.recipientId = recipientId;
      if (recipientName !== undefined) updates.recipientName = recipientName;
      if (subject !== undefined) updates.subject = subject;
      if (content !== undefined) updates.content = content;

      const [draft] = await db
        .update(emailDrafts)
        .set(updates)
        .where(and(eq(emailDrafts.id, id), eq(emailDrafts.userId, user.id)))
        .returning();
      if (!draft) {
        return res.status(404).json({ message: 'Draft not found' });
      }
      res.json(draft);
    } catch (error) {
      logger.error('[Drafts API] Error updating draft:', error);
      res.status(500).json({ message: 'Failed to update draft' });
    }
  });

  // Delete a draft (e.g. after it is sent or discarded), owner-scoped
  router.delete('/:id', isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user?.id) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      const id = parseInt(req.params.id, 10);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: 'Invalid draft id' });
      }
      const [deleted] = await db
        .delete(emailDrafts)
        .where(and(eq(emailDrafts.id, id), eq(emailDrafts.userId, user.id)))
        .returning();
      if (!deleted) {
        return res.status(404).json({ message: 'Draft not found' });
      }
      res.json({ success: true });
    } catch (error) {
      logger.error('[Drafts API] Error deleting draft:', error);
      res.status(500).json({ message: 'Failed to delete draft' });
    }
  });

  return router;
}
