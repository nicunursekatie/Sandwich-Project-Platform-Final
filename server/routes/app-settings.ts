import { Router, Request, Response } from 'express';
import { db } from '../db';
import { appSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';
import { requireRole } from '../middleware/auth';
import { z } from 'zod';

export function createAppSettingsRouter(_deps: { isAuthenticated: any }) {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    try {
      const rows = await db.select().from(appSettings);
      const map: Record<string, string> = {};
      for (const r of rows) map[r.key] = r.value;
      res.json(map);
    } catch (error) {
      logger.error('Error fetching app settings:', error);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  router.get('/:key', async (req: Request, res: Response) => {
    try {
      const [row] = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, req.params.key))
        .limit(1);
      if (!row) return res.status(404).json({ error: 'Setting not found' });
      res.json(row);
    } catch (error) {
      logger.error('Error fetching app setting:', error);
      res.status(500).json({ error: 'Failed to fetch setting' });
    }
  });

  const updateSchema = z.object({
    value: z.string().min(1).max(1000),
    description: z.string().max(500).optional(),
  });

  router.patch(
    '/:key',
    requireRole('admin', 'super_admin', 'admin_coordinator'),
    async (req: Request, res: Response) => {
      try {
        const parsed = updateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
        }
        const userId = (req as any).user?.id ?? null;
        const { value, description } = parsed.data;

        const [existing] = await db
          .select()
          .from(appSettings)
          .where(eq(appSettings.key, req.params.key))
          .limit(1);

        if (existing) {
          const [updated] = await db
            .update(appSettings)
            .set({
              value,
              description: description ?? existing.description,
              updatedAt: new Date(),
              updatedBy: userId,
            })
            .where(eq(appSettings.key, req.params.key))
            .returning();
          return res.json(updated);
        }

        const [created] = await db
          .insert(appSettings)
          .values({
            key: req.params.key,
            value,
            description: description ?? null,
            updatedBy: userId,
          })
          .returning();
        res.json(created);
      } catch (error) {
        logger.error('Error updating app setting:', error);
        res.status(500).json({ error: 'Failed to update setting' });
      }
    }
  );

  return router;
}
