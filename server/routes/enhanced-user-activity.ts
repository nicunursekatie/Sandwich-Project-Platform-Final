import { Router } from 'express';
import { isAuthenticated } from '../temp-auth';
import { IStorage } from '../storage.js';
import { sql, eq, and, desc, asc, count, inArray } from 'drizzle-orm';

export function createEnhancedUserActivityRoutes(storage: IStorage): Router {
  const router = Router();

  // Main endpoint that returns detailed activity summary
  router.get('/', isAuthenticated, async (req, res) => {
    try {
      const timeFilter = req.query.timeFilter as string || '24h';
      const sectionFilter = req.query.sectionFilter as string || 'all';
      const actionFilter = req.query.actionFilter as string || 'all';

      // Convert time filter to days
      let days = 1;
      if (timeFilter === '7d') days = 7;
      else if (timeFilter === '30d') days = 30;
      else if (timeFilter === '24h') days = 1;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { userActivityLogs, users } = await import("@shared/schema");
      const { db } = await import("../db");

      // Get detailed activity logs
      const recentActivity = await db
        .select({
          id: userActivityLogs.id,
          userId: userActivityLogs.userId,
          action: userActivityLogs.action,
          section: userActivityLogs.section,
          feature: userActivityLogs.feature,
          page: userActivityLogs.page,
          details: sql`COALESCE(CAST(${userActivityLogs.details} AS text), 'Activity logged')`.as('details'),
          metadata: sql`COALESCE(CAST(${userActivityLogs.metadata} AS text), '{}')`.as('metadata'),
          duration: userActivityLogs.duration,
          createdAt: userActivityLogs.createdAt
        })
        .from(userActivityLogs)
        .where(sql`${userActivityLogs.createdAt} >= ${startDate}`)
        .orderBy(desc(userActivityLogs.createdAt))
        .limit(100);

      // Get user names from the database
      const userIds = [...new Set(recentActivity.map(log => log.userId).filter(Boolean))];
      let usersData: Array<{id: string, name: string}> = [];
      
      if (userIds.length > 0) {
        try {
          console.log('🔍 Attempting to fetch user data for IDs:', userIds);
          const userRecords = await db
            .select({
              id: users.id,
              firstName: users.firstName,
              lastName: users.lastName,
              email: users.email
            })
            .from(users)
            .where(inArray(users.id, userIds));
          
          console.log('🔍 Raw user records from database:', userRecords);
          
          usersData = userRecords.map(user => ({
            id: user.id,
            name: user.firstName && user.lastName 
              ? `${user.firstName} ${user.lastName}` 
              : user.email || 'Unknown User'
          }));
          
          console.log('🔍 Processed user data:', usersData);
        } catch (error) {
          console.error('❌ Error fetching user names:', error);
          // Fallback to unknown users if query fails
          usersData = userIds.map(id => ({
            id,
            name: 'Unknown User'
          }));
        }
      }

      const userNameMap = usersData.reduce((acc: Record<string, string>, user) => {
        acc[user.id] = user.name;
        return acc;
      }, {});

      // Debug logging
      console.log('🔍 User Activity Debug:');
      console.log('- Found', userIds.length, 'unique user IDs:', userIds);
      console.log('- Fetched', usersData.length, 'user records');
      console.log('- User name map:', userNameMap);

      // Get simple counts
      const totalActions = recentActivity.length;
      const uniqueUsers = userIds.length;

      // Count actions
      const actionCounts = recentActivity.reduce((acc: Record<string, number>, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {});
      
      const topActions = Object.entries(actionCounts)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Count sections  
      const sectionCounts = recentActivity.reduce((acc: Record<string, number>, log) => {
        acc[log.section] = (acc[log.section] || 0) + 1;
        return acc;
      }, {});
      
      const topSections = Object.entries(sectionCounts)
        .map(([section, count]) => ({ section, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Count features
      const featureCounts = recentActivity
        .filter(log => log.feature)
        .reduce((acc: Record<string, number>, log) => {
          acc[log.feature!] = (acc[log.feature!] || 0) + 1;
          return acc;
        }, {});
      
      const topFeatures = Object.entries(featureCounts)
        .map(([feature, count]) => ({ feature, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const response = {
        totalActions,
        uniqueUsers,
        topActions,
        topSections,
        topFeatures,
        recentActivity: recentActivity.map(log => {
          let parsedMetadata = {};
          try {
            parsedMetadata = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata || {};
          } catch (e) {
            parsedMetadata = {};
          }
          
          return {
            id: log.id,
            userId: log.userId,
            userName: userNameMap[log.userId] || 'Unknown User',
            action: log.action,
            section: log.section,
            feature: log.feature,
            page: log.page,
            details: log.details && typeof log.details === 'string' ? log.details : 
                     `${log.action} - ${log.section}${log.feature ? ` - ${log.feature}` : ''}`,
            metadata: parsedMetadata,
            duration: log.duration,
            createdAt: log.createdAt
          };
        })
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching enhanced user activity:', error);
      res.status(500).json({ error: 'Failed to fetch enhanced user activity' });
    }
  });

  // Enhanced system statistics with granular insights
  router.get('/enhanced-stats', isAuthenticated, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Import schema dynamically to avoid circular dependencies
      const { userActivityLogs, users } = await import("@shared/schema");
      const { db } = await import("../db");

      // Get total users and active users
      const totalUsersResult = await db.select({ count: count() }).from(users);
      const totalUsers = totalUsersResult[0]?.count || 0;

      // Get active users in last 24 hours (distinct users, excluding admin accounts)
      const last24Hours = new Date();
      last24Hours.setHours(last24Hours.getHours() - 24);
      
      const adminAccounts = ['admin@sandwich.project', 'katielong2316@gmail.com', 'kenig.ka@gmail.com'];
      
      const activeUsersLast24hResult = await db
        .select({ count: sql`COUNT(DISTINCT ${userActivityLogs.userId})`.as('count') })
        .from(userActivityLogs)
        .where(
          and(
            sql`${userActivityLogs.createdAt} >= ${last24Hours}`,
            sql`${userActivityLogs.userId} NOT IN ${adminAccounts}`
          )
        );
      const activeUsersLast24h = Number(activeUsersLast24hResult[0]?.count || 0);

      // Get active users in last 12 hours for more recent activity (excluding admin accounts)
      const last12Hours = new Date();
      last12Hours.setHours(last12Hours.getHours() - 12);
      
      const activeUsersLast12hResult = await db
        .select({ count: sql`COUNT(DISTINCT ${userActivityLogs.userId})`.as('count') })
        .from(userActivityLogs)
        .where(
          and(
            sql`${userActivityLogs.createdAt} >= ${last12Hours}`,
            sql`${userActivityLogs.userId} NOT IN ${adminAccounts}`
          )
        );
      const activeUsersLast12h = Number(activeUsersLast12hResult[0]?.count || 0);

      // Get total actions in timeframe (excluding admin accounts)
      const totalActionsResult = await db
        .select({ count: count() })
        .from(userActivityLogs)
        .where(
          and(
            sql`${userActivityLogs.createdAt} >= ${startDate}`,
            sql`${userActivityLogs.userId} NOT IN ${adminAccounts}`
          )
        );
      const totalActions = totalActionsResult[0]?.count || 0;

      // Calculate average actions per user (based on 24h activity)
      const averageActionsPerUser = activeUsersLast24h > 0 ? totalActions / activeUsersLast24h : 0;

      // Get top sections by actions (use section field for better names, excluding admin accounts)
      const topSectionsResult = await db
        .select({
          section: userActivityLogs.section,
          actions: count()
        })
        .from(userActivityLogs)
        .where(
          and(
            sql`${userActivityLogs.createdAt} >= ${startDate}`,
            sql`${userActivityLogs.section} IS NOT NULL`,
            sql`${userActivityLogs.section} != 'General'`,
            sql`${userActivityLogs.userId} NOT IN ${adminAccounts}`
          )
        )
        .groupBy(userActivityLogs.section)
        .orderBy(desc(count()))
        .limit(8);

      // Get top features by usage (exclude Unknown values and admin accounts)
      const topFeaturesResult = await db
        .select({
          feature: userActivityLogs.feature,
          usage: count()
        })
        .from(userActivityLogs)
        .where(
          and(
            sql`${userActivityLogs.createdAt} >= ${startDate}`,
            sql`${userActivityLogs.feature} IS NOT NULL`,
            sql`${userActivityLogs.feature} != 'Unknown'`,
            sql`${userActivityLogs.userId} NOT IN ${adminAccounts}`
          )
        )
        .groupBy(userActivityLogs.feature)
        .orderBy(desc(count()))
        .limit(8);

      // Get daily active users for trend analysis (excluding admin accounts)
      const dailyActiveUsersResult = await db
        .select({
          date: sql`DATE(${userActivityLogs.createdAt})`.as('date'),
          users: sql`COUNT(DISTINCT ${userActivityLogs.userId})`.as('users')
        })
        .from(userActivityLogs)
        .where(
          and(
            sql`${userActivityLogs.createdAt} >= ${startDate}`,
            sql`${userActivityLogs.userId} NOT IN ${adminAccounts}`
          )
        )
        .groupBy(sql`DATE(${userActivityLogs.createdAt})`)
        .orderBy(asc(sql`DATE(${userActivityLogs.createdAt})`));

      const response = {
        totalUsers,
        activeUsers: activeUsersLast24h, // Primary metric: 24-hour active users
        activeUsersLast24h,
        activeUsersLast12h,
        totalActions,
        averageActionsPerUser,
        topSections: topSectionsResult.map(item => ({ 
          section: item.section, 
          actions: Number(item.actions) 
        })),
        topFeatures: topFeaturesResult.map(item => ({ 
          feature: item.feature, 
          usage: Number(item.usage) 
        })),
        dailyActiveUsers: dailyActiveUsersResult.map(item => ({
          date: item.date,
          users: Number(item.users)
        }))
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching enhanced stats:', error);
      res.status(500).json({ error: 'Failed to fetch enhanced statistics' });
    }
  });

  // Detailed user activities with behavioral insights
  router.get('/detailed-users', isAuthenticated, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { userActivityLogs, users } = await import("@shared/schema");
      const { db } = await import("../db");

      // Get all users with their activity metrics (simplified query, excluding admin accounts)
      const adminAccounts = ['admin@sandwich.project', 'katielong2316@gmail.com', 'kenig.ka@gmail.com'];
      
      const userActivities = await db
        .select({
          userId: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          totalActions: sql`COUNT(${userActivityLogs.id})`.as('totalActions'),
          lastActive: sql`MAX(${userActivityLogs.createdAt})`.as('lastActive'),
          topSection: sql`'Activity Data'`.as('topSection'), // Simplified for now
          topFeature: sql`'User Engagement'`.as('topFeature'), // Simplified for now
          timeSpent: sql`COALESCE(SUM(${userActivityLogs.duration}), 0)`.as('timeSpent'),
          sessionsCount: sql`COUNT(DISTINCT ${userActivityLogs.sessionId})`.as('sessionsCount')
        })
        .from(users)
        .leftJoin(userActivityLogs, and(
          eq(userActivityLogs.userId, users.id),
          sql`${userActivityLogs.createdAt} >= ${startDate}`
        ))
        .where(sql`${users.id} NOT IN ${adminAccounts}`)
        .groupBy(users.id, users.email, users.firstName, users.lastName)
        .orderBy(desc(sql`COUNT(${userActivityLogs.id})`));

      // Get features used by each user (excluding admin accounts)
      const userFeatures = await db
        .select({
          userId: userActivityLogs.userId,
          features: sql`array_agg(DISTINCT ${userActivityLogs.feature})`.as('features')
        })
        .from(userActivityLogs)
        .where(
          and(
            sql`${userActivityLogs.createdAt} >= ${startDate}`,
            sql`${userActivityLogs.feature} IS NOT NULL`,
            sql`${userActivityLogs.userId} NOT IN ${adminAccounts}`
          )
        )
        .groupBy(userActivityLogs.userId);

      // Get section breakdown for each user (excluding admin accounts)
      const sectionBreakdowns = await db
        .select({
          userId: userActivityLogs.userId,
          section: userActivityLogs.page,
          actions: count(),
          timeSpent: sql`COALESCE(SUM(${userActivityLogs.duration}), 0)`.as('timeSpent')
        })
        .from(userActivityLogs)
        .where(
          and(
            sql`${userActivityLogs.createdAt} >= ${startDate}`,
            sql`${userActivityLogs.userId} NOT IN ${adminAccounts}`
          )
        )
        .groupBy(userActivityLogs.userId, userActivityLogs.page);

      // Combine data
      const result = userActivities.map(user => {
        const features = userFeatures.find(f => f.userId === user.userId);
        const sections = sectionBreakdowns.filter(s => s.userId === user.userId);
        
        return {
          userId: user.userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          totalActions: Number(user.totalActions) || 0,
          lastActive: user.lastActive,
          topSection: user.topSection || 'None',
          topFeature: user.topFeature || 'None',
          timeSpent: Math.round((Number(user.timeSpent) || 0) / 60), // Convert to minutes
          sessionsCount: Number(user.sessionsCount) || 0,
          featuresUsed: features?.features ? 
            (Array.isArray(features.features) ? features.features : [features.features]).filter(f => f) : 
            [],
          sectionBreakdown: sections.map(s => ({
            section: s.section,
            actions: Number(s.actions),
            timeSpent: Math.round((Number(s.timeSpent) || 0) / 60)
          }))
        };
      });

      res.json(result);
    } catch (error) {
      console.error('Error fetching detailed user activities:', error);
      res.status(500).json({ error: 'Failed to fetch detailed user activities' });
    }
  });

  // Activity logs with filtering
  router.get('/logs', isAuthenticated, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const userId = req.query.userId as string;
      const action = req.query.action as string;
      const limit = parseInt(req.query.limit as string) || 100;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { userActivityLogs, users } = await import("@shared/schema");
      const { db } = await import("../db");

      // Build where conditions
      const conditions = [sql`${userActivityLogs.createdAt} >= ${startDate}`];
      
      if (userId && userId !== 'all') {
        conditions.push(eq(userActivityLogs.userId, userId));
      }
      
      if (action && action !== 'all') {
        conditions.push(eq(userActivityLogs.action, action));
      }

      const logs = await db
        .select({
          id: userActivityLogs.id,
          userId: userActivityLogs.userId,
          userName: sql`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`.as('userName'),
          action: userActivityLogs.action,
          section: userActivityLogs.page,
          feature: userActivityLogs.feature,
          page: userActivityLogs.page,
          duration: userActivityLogs.duration,
          createdAt: userActivityLogs.createdAt,
          metadata: userActivityLogs.metadata
        })
        .from(userActivityLogs)
        .leftJoin(users, eq(userActivityLogs.userId, users.id))
        .where(and(...conditions))
        .orderBy(desc(userActivityLogs.createdAt))
        .limit(limit);

      res.json(logs);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
  });

  // Individual user statistics
  router.get('/user-stats/:userId', isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      const days = parseInt(req.query.days as string) || 7;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { userActivityLogs } = await import("@shared/schema");
      const { db } = await import("../db");

      // Get user activities
      const activities = await db
        .select()
        .from(userActivityLogs)
        .where(
          and(
            eq(userActivityLogs.userId, userId),
            sql`${userActivityLogs.createdAt} >= ${startDate}`
          )
        )
        .orderBy(desc(userActivityLogs.createdAt));

      // Calculate statistics
      const totalActions = activities.length;
      const sectionsUsed = Array.from(new Set(activities.map(a => a.section)));
      
      // Top actions by count
      const actionCounts = activities.reduce((acc: Record<string, number>, activity) => {
        acc[activity.action] = (acc[activity.action] || 0) + 1;
        return acc;
      }, {});
      
      const topActions = Object.entries(actionCounts)
        .map(([action, count]) => ({ action, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Feature usage with duration
      const featureUsage = activities
        .filter(a => a.feature)
        .reduce((acc: Record<string, { count: number; totalDuration: number }>, activity) => {
          const feature = activity.feature!;
          if (!acc[feature]) {
            acc[feature] = { count: 0, totalDuration: 0 };
          }
          acc[feature].count++;
          acc[feature].totalDuration += activity.duration || 0;
          return acc;
        }, {});

      const featureUsageArray = Object.entries(featureUsage)
        .map(([feature, data]) => ({
          feature,
          count: data.count,
          avgDuration: data.count > 0 ? Math.round(data.totalDuration / data.count) : 0
        }))
        .sort((a, b) => b.count - a.count);

      // Section breakdown
      const sectionBreakdown = activities
        .reduce((acc: Record<string, { actions: number; timeSpent: number }>, activity) => {
          const section = activity.section;
          if (!acc[section]) {
            acc[section] = { actions: 0, timeSpent: 0 };
          }
          acc[section].actions++;
          acc[section].timeSpent += activity.duration || 0;
          return acc;
        }, {});

      const sectionBreakdownArray = Object.entries(sectionBreakdown)
        .map(([section, data]) => ({
          section,
          actions: data.actions,
          timeSpent: Math.round(data.timeSpent / 60) // Convert to minutes
        }))
        .sort((a, b) => b.actions - a.actions);

      // Daily activity
      const dailyActivity = activities.reduce((acc: Record<string, number>, activity) => {
        const date = activity.createdAt.toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

      const dailyActivityArray = Object.entries(dailyActivity)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Peak usage times (by hour)
      const peakUsageTimes = activities.reduce((acc: Record<number, number>, activity) => {
        const hour = activity.createdAt.getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {});

      const peakUsageTimesArray = Object.entries(peakUsageTimes)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }))
        .sort((a, b) => b.count - a.count);

      const response = {
        totalActions,
        sectionsUsed,
        topActions,
        dailyActivity: dailyActivityArray,
        featureUsage: featureUsageArray,
        sectionBreakdown: sectionBreakdownArray,
        peakUsageTimes: peakUsageTimesArray
      };

      res.json(response);
    } catch (error) {
      console.error('Error fetching user stats:', error);
      res.status(500).json({ error: 'Failed to fetch user statistics' });
    }
  });

  // Real-time activity tracking (for live updates)
  router.post('/track', isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      if (!user?.id) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const {
        action,
        section,
        feature,
        page,
        duration,
        metadata
      } = req.body;

      const activityData = {
        userId: user.id,
        action: action || 'View',
        section: section || 'Unknown',
        feature: feature || null,
        page: page || null,
        duration: duration || null,
        sessionId: (req as any).sessionID || null,
        ipAddress: req.ip || null,
        userAgent: req.get('User-Agent') || null,
        metadata: metadata || {}
      };

      await storage.logUserActivity(activityData);

      res.json({ success: true, message: 'Activity tracked successfully' });
    } catch (error) {
      console.error('Error tracking activity:', error);
      res.status(500).json({ error: 'Failed to track activity' });
    }
  });

  return router;
}