import { Router } from 'express';
import { z } from 'zod';
// Auth will be handled by existing middleware
import { IStorage } from '../storage';

const activityLogSchema = z.object({
  action: z.string().min(1),
  section: z.string().min(1),
  feature: z.string().min(1),
  page: z.string().optional(),
  details: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export function createActivityLogRoutes(storage: IStorage) {
  const router = Router();

  // Log client-side activity
  router.post('/', async (req, res) => {
    try {
      const validatedData = activityLogSchema.parse(req.body);
      const user = (req as any).user;

      if (!user?.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Create activity log entry using existing storage method
      await storage.logUserActivity(
        user.id,
        validatedData.action,
        validatedData.section,
        validatedData.feature,
        validatedData.page || req.headers.referer || 'unknown',
        validatedData.details || '',
        null, // duration
        validatedData.metadata
      );

      res.json({ success: true });
    } catch (error) {
      console.error('Activity log error:', error);
      res.status(500).json({ error: 'Failed to log activity' });
    }
  });

  return router;
}