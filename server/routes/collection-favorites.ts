/**
 * Personal "notable" bookmarks on sandwich collection log entries.
 * Distinct from kudos (which sends recognition to the submitter) —
 * these are per-user, private bookmarks for the user's own reference.
 *
 * Endpoints:
 *   GET    /api/collection-favorites              → array of collection IDs the
 *                                                   current user has favorited
 *   POST   /api/collection-favorites/:id          → favorite a collection
 *   DELETE /api/collection-favorites/:id          → unfavorite a collection
 */
import { Router, type Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { userCollectionFavorites } from '@shared/schema';
import { logger } from '../utils/production-safe-logger';
import type { AuthenticatedRequest } from '../types/express';

export function createCollectionFavoritesRouter(deps: {
  isAuthenticated: any;
}) {
  const router = Router();

  // List the current user's favorited collection IDs. Returns just the
  // ID array so the client can keep a Set in memory and toggle quickly.
  router.get(
    '/',
    deps.isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const rows = await db
          .select({ collectionId: userCollectionFavorites.collectionId })
          .from(userCollectionFavorites)
          .where(eq(userCollectionFavorites.userId, String(userId)));

        res.json({
          collectionIds: rows.map((r) => r.collectionId),
        });
      } catch (error) {
        logger.error('[CollectionFavorites] list error', error);
        res.status(500).json({ error: 'Failed to list favorites' });
      }
    },
  );

  // Favorite a collection. Idempotent — the unique constraint at the
  // DB level guarantees we never end up with duplicate rows even if
  // the client sends a stale request.
  router.post(
    '/:collectionId',
    deps.isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const collectionId = parseInt(req.params.collectionId, 10);
        if (!Number.isFinite(collectionId) || collectionId <= 0) {
          return res.status(400).json({ error: 'Invalid collection id' });
        }

        await db
          .insert(userCollectionFavorites)
          .values({
            userId: String(userId),
            collectionId,
          })
          .onConflictDoNothing();

        res.json({ ok: true, collectionId, favorited: true });
      } catch (error) {
        logger.error('[CollectionFavorites] favorite error', error);
        res.status(500).json({ error: 'Failed to favorite collection' });
      }
    },
  );

  // Unfavorite a collection. Also idempotent — deleting a row that's
  // already gone is fine.
  router.delete(
    '/:collectionId',
    deps.isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const collectionId = parseInt(req.params.collectionId, 10);
        if (!Number.isFinite(collectionId) || collectionId <= 0) {
          return res.status(400).json({ error: 'Invalid collection id' });
        }

        await db
          .delete(userCollectionFavorites)
          .where(
            and(
              eq(userCollectionFavorites.userId, String(userId)),
              eq(userCollectionFavorites.collectionId, collectionId),
            ),
          );

        res.json({ ok: true, collectionId, favorited: false });
      } catch (error) {
        logger.error('[CollectionFavorites] unfavorite error', error);
        res.status(500).json({ error: 'Failed to unfavorite collection' });
      }
    },
  );

  return router;
}
