import { Request, Response, Router } from 'express';
import type { RouterDependencies } from '../types';
import { z } from 'zod';
import { logger } from '../../utils/production-safe-logger';

// Get announcements
const getAnnouncements = async (req: Request, res: Response) => {
  try {
    // Return empty array for now - can be implemented later
    res.json([]);
  } catch (error) {
    logger.error('Error getting announcements:', error);
    res.status(500).json({ error: 'Failed to get announcements' });
  }
};

const broadcastAnnouncementSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  actionUrl: z.string().optional(),
  actionText: z.string().optional(),
  targetRoles: z.array(z.string()).optional(), // Filter by user roles
});

export function createAnnouncementsRouter(deps: RouterDependencies) {
  const router = Router();
  const { isAuthenticated, storage } = deps;

  router.get('/', isAuthenticated, getAnnouncements);

  // Broadcast announcement to all users or specific roles
  router.post('/broadcast', isAuthenticated, async (req: any, res: Response) => {
    try {
      // Only admins can broadcast announcements
      if (!req.user?.permissions?.includes('admin')) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const announcementData = broadcastAnnouncementSchema.parse(req.body);
      const { targetRoles, ...notificationData } = announcementData;

      // Get all active users
      const allUsers = await storage.getAllUsers();
      let targetUsers = allUsers.filter((user: any) => user.isActive);

      // Filter by roles if specified
      if (targetRoles && targetRoles.length > 0) {
        targetUsers = targetUsers.filter((user: any) => targetRoles.includes(user.role));
      }

      // Create notifications for all target users
      let successCount = 0;
      let failureCount = 0;

      for (const user of targetUsers) {
        try {
          await storage.createNotification({
            userId: user.id,
            type: 'announcement',
            priority: notificationData.priority,
            title: notificationData.title,
            message: notificationData.message,
            category: 'updates',
            actionUrl: notificationData.actionUrl,
            actionText: notificationData.actionText,
          });
          successCount++;
        } catch (notifError) {
          logger.error(`Failed to create notification for ${user.id}:`, notifError);
          failureCount++;
        }
      }

      res.json({
        success: true,
        message: `Announcement sent to ${successCount} users`,
        successCount,
        failureCount,
        totalUsers: targetUsers.length,
      });
    } catch (error) {
      logger.error('Error broadcasting announcement:', error);
      res.status(500).json({ error: 'Failed to broadcast announcement' });
    }
  });

  return router;
}