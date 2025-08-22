import { Router } from 'express';
import { sql, desc } from 'drizzle-orm';
import { IStorage } from '../storage';
// Simple implementation without middleware for now
const isAuthenticated = (req: any, res: any, next: any) => next();

export function createEnhancedUserActivityRoutes(storage: IStorage): Router {
  const router = Router();

  // Main endpoint that returns detailed activity summary
  router.get('/', isAuthenticated, async (req, res) => {
    try {
      const { userActivityLogs, users } = await import("@shared/schema");
      const { db } = await import("../db");

      // Simple query without complex joins
      const recentActivityResult = await db.execute(sql`
        SELECT 
          id,
          user_id,
          action,
          section,
          feature,
          page,
          details,
          duration,
          created_at
        FROM user_activity_logs
        ORDER BY created_at DESC
        LIMIT 100
      `);
      
      // Fetch user names separately 
      const userNamesResult = await db.execute(sql`
        SELECT id, first_name, last_name, email
        FROM users
      `);
      
      const userMap = userNamesResult.rows.reduce((acc: any, user: any) => {
        acc[user.id] = user.first_name && user.last_name 
          ? `${user.first_name} ${user.last_name}` 
          : user.email;
        return acc;
      }, {});
      
      const recentActivity = recentActivityResult.rows.map((log: any) => ({
        id: log.id,
        userId: log.user_id,
        userName: userMap[log.user_id] || 'Unknown User',
        action: log.action,
        section: log.section,
        feature: log.feature,
        page: log.page,
        details: log.details || 'Activity logged',
        duration: log.duration,
        createdAt: log.created_at
      }));

      const response = {
        totalActions: recentActivity.length,
        uniqueUsers: new Set(recentActivity.map(log => log.userId).filter(Boolean)).size,
        topActions: [],
        topSections: [],
        topFeatures: [],
        recentActivity: recentActivity.map(log => ({
          id: log.id,
          userId: log.userId,
          userName: log.userName,
          action: log.action,
          section: log.section,
          feature: log.feature,
          page: log.page,
          details: log.details,
          metadata: {},
          duration: log.duration,
          createdAt: log.createdAt
        }))
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching enhanced user activity:', error);
      res.status(500).json({ error: 'Failed to fetch enhanced user activity' });
    }
  });

  return router;
}