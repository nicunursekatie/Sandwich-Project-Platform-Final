import { Router, Request, Response } from 'express';
import { db } from '../db';
import { appSettings } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '../utils/production-safe-logger';
import {
  NAV_USER_VIEW_SETTING_KEY,
  parseNavUserViewVisibleIds,
} from '@shared/nav-user-view';

const isNavConfigAdmin = (req: Request): boolean => {
  const user = (req as any).user;
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'super_admin') return true;
  const permissions: string[] = Array.isArray(user.permissions) ? user.permissions : [];
  return permissions.includes('ADMIN_PANEL_ACCESS');
};

export function createNavUserViewRouter(deps: { isAuthenticated: any }) {
  const router = Router();

  router.get('/', deps.isAuthenticated, async (_req: Request, res: Response) => {
    try {
      const [row] = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, NAV_USER_VIEW_SETTING_KEY))
        .limit(1);

      if (!row) {
        return res.json({ visibleNavIds: null, usesDefaults: true });
      }

      const visibleNavIds = parseNavUserViewVisibleIds(row.value);
      res.json({ visibleNavIds, usesDefaults: false });
    } catch (error) {
      logger.error('Error fetching nav user view config:', error);
      res.status(500).json({ error: 'Failed to fetch nav user view config' });
    }
  });

  const updateSchema = z.object({
    visibleNavIds: z.array(z.string().min(1).max(100)).max(200),
  });

  router.put('/', deps.isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!isNavConfigAdmin(req)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
      }

      const visibleNavIds = parsed.data.visibleNavIds;
      const userId = (req as any).user?.id ?? null;
      const value = JSON.stringify(visibleNavIds);

      const [existing] = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, NAV_USER_VIEW_SETTING_KEY))
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(appSettings)
          .set({
            value,
            description: 'Nav item IDs shown when an admin toggles User View in the sidebar',
            updatedAt: new Date(),
            updatedBy: userId,
          })
          .where(eq(appSettings.key, NAV_USER_VIEW_SETTING_KEY))
          .returning();
        return res.json({ visibleNavIds: parseNavUserViewVisibleIds(updated.value) });
      }

      const [created] = await db
        .insert(appSettings)
        .values({
          key: NAV_USER_VIEW_SETTING_KEY,
          value,
          description: 'Nav item IDs shown when an admin toggles User View in the sidebar',
          updatedBy: userId,
        })
        .returning();

      res.json({ visibleNavIds: parseNavUserViewVisibleIds(created.value) });
    } catch (error) {
      logger.error('Error updating nav user view config:', error);
      res.status(500).json({ error: 'Failed to update nav user view config' });
    }
  });

  return router;
}
