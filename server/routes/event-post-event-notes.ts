import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db';
import { eventPostEventNotes } from '@shared/schema';
import { logger } from '../utils/production-safe-logger';

/**
 * Post-event Notes API Routes
 *
 * Mounted at /api/event-requests, so endpoints become:
 *   GET    /:eventId/post-event-notes
 *   POST   /:eventId/post-event-notes
 *   PATCH  /:eventId/post-event-notes/:noteId
 *   DELETE /:eventId/post-event-notes/:noteId
 *
 * Permissions:
 * - All endpoints require auth.
 * - Anyone authenticated can list and add notes.
 * - Edit and delete are restricted to the note's author OR a super_admin.
 */

const createNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(5000),
});

const updateNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(5000),
});

function canModifyNote(
  reqUser: { id: string; role?: string | null } | undefined,
  noteUserId: string,
): boolean {
  if (!reqUser?.id) return false;
  if (String(reqUser.id) === String(noteUserId)) return true;
  return reqUser.role === 'super_admin';
}

export function createEventPostEventNotesRouter() {
  const router = Router();

  // GET /:eventId/post-event-notes — list all notes for an event (newest first)
  router.get('/:eventId/post-event-notes', async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId, 10);
      if (Number.isNaN(eventId)) {
        return res.status(400).json({ error: 'Invalid event id' });
      }

      const notes = await db
        .select()
        .from(eventPostEventNotes)
        .where(eq(eventPostEventNotes.eventRequestId, eventId))
        .orderBy(desc(eventPostEventNotes.createdAt));

      res.json(notes);
    } catch (error) {
      logger.error('Error fetching post-event notes:', error);
      res.status(500).json({ error: 'Failed to fetch post-event notes' });
    }
  });

  // POST /:eventId/post-event-notes — add a note
  router.post('/:eventId/post-event-notes', async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId, 10);
      if (Number.isNaN(eventId)) {
        return res.status(400).json({ error: 'Invalid event id' });
      }

      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { content } = createNoteSchema.parse(req.body);
      const userName =
        [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
        user.displayName ||
        user.email ||
        'Unknown';

      const [created] = await db
        .insert(eventPostEventNotes)
        .values({
          eventRequestId: eventId,
          userId: String(user.id),
          userName,
          content,
        })
        .returning();

      res.status(201).json(created);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0]?.message ?? 'Validation error' });
      }
      logger.error('Error creating post-event note:', error);
      res.status(500).json({ error: 'Failed to create post-event note' });
    }
  });

  // PATCH /:eventId/post-event-notes/:noteId — edit a note (author or super_admin only)
  router.patch('/:eventId/post-event-notes/:noteId', async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId, 10);
      const noteId = parseInt(req.params.noteId, 10);
      if (Number.isNaN(eventId) || Number.isNaN(noteId)) {
        return res.status(400).json({ error: 'Invalid id' });
      }

      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const [existing] = await db
        .select()
        .from(eventPostEventNotes)
        .where(
          and(
            eq(eventPostEventNotes.id, noteId),
            eq(eventPostEventNotes.eventRequestId, eventId),
          ),
        );

      if (!existing) {
        return res.status(404).json({ error: 'Note not found' });
      }

      if (!canModifyNote(user, existing.userId)) {
        return res.status(403).json({ error: 'You can only edit your own notes' });
      }

      const { content } = updateNoteSchema.parse(req.body);
      const now = new Date();

      const [updated] = await db
        .update(eventPostEventNotes)
        .set({ content, editedAt: now, updatedAt: now })
        .where(eq(eventPostEventNotes.id, noteId))
        .returning();

      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors[0]?.message ?? 'Validation error' });
      }
      logger.error('Error updating post-event note:', error);
      res.status(500).json({ error: 'Failed to update post-event note' });
    }
  });

  // DELETE /:eventId/post-event-notes/:noteId — delete a note (author or super_admin only)
  router.delete('/:eventId/post-event-notes/:noteId', async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId, 10);
      const noteId = parseInt(req.params.noteId, 10);
      if (Number.isNaN(eventId) || Number.isNaN(noteId)) {
        return res.status(400).json({ error: 'Invalid id' });
      }

      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const [existing] = await db
        .select()
        .from(eventPostEventNotes)
        .where(
          and(
            eq(eventPostEventNotes.id, noteId),
            eq(eventPostEventNotes.eventRequestId, eventId),
          ),
        );

      if (!existing) {
        return res.status(404).json({ error: 'Note not found' });
      }

      if (!canModifyNote(user, existing.userId)) {
        return res.status(403).json({ error: 'You can only delete your own notes' });
      }

      await db.delete(eventPostEventNotes).where(eq(eventPostEventNotes.id, noteId));

      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting post-event note:', error);
      res.status(500).json({ error: 'Failed to delete post-event note' });
    }
  });

  return router;
}
