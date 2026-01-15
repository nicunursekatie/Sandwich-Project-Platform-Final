import { Request, Response, NextFunction } from 'express';
import type { IStorage } from '../storage';
import { logger } from '../utils/production-safe-logger';

interface ActivityLoggerOptions {
  storage: IStorage;
}

// Semantic activity rule - maps API endpoints to meaningful user actions
interface ActivityRule {
  section: string;
  feature: string;
  action: string;
  details: string;
  groupKey?: string; // For deduplication - same groupKey within window = single log
  dedupeWindowMs?: number; // Time window for deduplication (default 60000 = 1 min)
  methods?: string[]; // Only log for these HTTP methods (default: all)
}

// In-memory cache for activity deduplication
// Key format: `${userId}:${groupKey}` -> timestamp of last log
const activityDedupeCache = new Map<string, number>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes
  for (const [key, timestamp] of activityDedupeCache.entries()) {
    if (now - timestamp > maxAge) {
      activityDedupeCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Semantic activity rules registry - maps API patterns to user-facing actions
// Order matters: more specific patterns should come first
const activityRules: Array<{ pattern: RegExp | string; rule: ActivityRule }> = [
  // Chat / Messaging
  {
    pattern: '/api/stream/credentials',
    rule: {
      section: 'Chat',
      feature: 'Stream Chat',
      action: 'Visit',
      details: 'Opened the Chat feature',
      groupKey: 'chat-visit',
      dedupeWindowMs: 120000,
    },
  },
  {
    pattern: '/conversations/recent',
    rule: {
      section: 'Chat',
      feature: 'Conversations',
      action: 'View',
      details: 'Viewed recent conversations',
      groupKey: 'chat-visit',
      dedupeWindowMs: 120000,
    },
  },
  {
    pattern: '/api/messaging',
    rule: {
      section: 'Chat',
      feature: 'Messaging',
      action: 'View',
      details: 'Accessed messaging system',
      groupKey: 'messaging-visit',
      dedupeWindowMs: 60000,
    },
  },

  // Event Requests
  {
    pattern: '/api/event-requests/status-counts',
    rule: {
      section: 'Event Requests',
      feature: 'Dashboard',
      action: 'View',
      details: 'Viewed Event Requests dashboard',
      groupKey: 'event-requests-dashboard',
      dedupeWindowMs: 60000,
    },
  },
  {
    pattern: '/api/event-requests/list',
    rule: {
      section: 'Event Requests',
      feature: 'Event List',
      action: 'View',
      details: 'Viewed event request list',
      groupKey: 'event-requests-dashboard',
      dedupeWindowMs: 60000,
    },
  },
  {
    pattern: '/api/event-requests/collaboration',
    rule: {
      section: 'Event Requests',
      feature: 'Collaboration',
      action: 'View',
      details: 'Accessed real-time collaboration on events',
      groupKey: 'event-collaboration',
      dedupeWindowMs: 120000,
    },
  },
  {
    pattern: /\/api\/event-requests\/\d+\/toolkit-sent/,
    rule: {
      section: 'Event Requests',
      feature: 'Event Management',
      action: 'Update',
      details: 'Marked event as scheduled (toolkit sent)',
      methods: ['PATCH', 'POST'],
    },
  },
  {
    pattern: /\/api\/event-requests\/\d+/,
    rule: {
      section: 'Event Requests',
      feature: 'Event Details',
      action: 'View',
      details: 'Viewed event request details',
      groupKey: 'event-details',
      dedupeWindowMs: 30000,
      methods: ['GET'],
    },
  },

  // Resources
  {
    pattern: '/resources/user/recent',
    rule: {
      section: 'Resources',
      feature: 'Documents',
      action: 'View',
      details: 'Viewed recently accessed documents',
      groupKey: 'resources-recent',
      dedupeWindowMs: 120000,
    },
  },

  // Directory - Hosts
  {
    pattern: '/api/hosts-with-contacts',
    rule: {
      section: 'Directory',
      feature: 'Hosts',
      action: 'View',
      details: 'Viewed host directory',
      groupKey: 'hosts-directory',
      dedupeWindowMs: 60000,
    },
  },
  {
    pattern: '/api/hosts/map',
    rule: {
      section: 'Directory',
      feature: 'Host Map',
      action: 'View',
      details: 'Viewed host locations on map',
      groupKey: 'hosts-map',
      dedupeWindowMs: 60000,
    },
  },
  {
    pattern: '/api/hosts',
    rule: {
      section: 'Directory',
      feature: 'Hosts',
      action: 'View',
      details: 'Accessed host management',
      groupKey: 'hosts-management',
      dedupeWindowMs: 60000,
      methods: ['GET'],
    },
  },

  // Directory - Drivers
  {
    pattern: '/api/drivers',
    rule: {
      section: 'Directory',
      feature: 'Drivers',
      action: 'View',
      details: 'Viewed driver directory',
      groupKey: 'drivers-directory',
      dedupeWindowMs: 60000,
      methods: ['GET'],
    },
  },

  // Directory - Recipients
  {
    pattern: '/api/recipients/map',
    rule: {
      section: 'Directory',
      feature: 'Recipient Map',
      action: 'View',
      details: 'Viewed recipient locations on map',
      groupKey: 'recipients-map',
      dedupeWindowMs: 60000,
    },
  },
  {
    pattern: '/api/recipients',
    rule: {
      section: 'Directory',
      feature: 'Recipients',
      action: 'View',
      details: 'Viewed recipient directory',
      groupKey: 'recipients-directory',
      dedupeWindowMs: 60000,
      methods: ['GET'],
    },
  },

  // Users / Admin
  {
    pattern: '/api/users/online',
    rule: {
      section: 'Platform',
      feature: 'Online Status',
      action: 'View',
      details: 'Checked who is online',
      groupKey: 'online-status',
      dedupeWindowMs: 300000, // 5 min - this polls frequently
    },
  },

  // Onboarding
  {
    pattern: '/api/onboarding',
    rule: {
      section: 'Onboarding',
      feature: 'Progress',
      action: 'View',
      details: 'Checked onboarding progress',
      groupKey: 'onboarding-check',
      dedupeWindowMs: 300000,
    },
  },

  // Event Reminders
  {
    pattern: '/api/event-reminders',
    rule: {
      section: 'Event Requests',
      feature: 'Reminders',
      action: 'View',
      details: 'Viewed event reminders',
      groupKey: 'event-reminders',
      dedupeWindowMs: 120000,
    },
  },

  // Collections
  {
    pattern: '/api/sandwich-collections/export',
    rule: {
      section: 'Collections',
      feature: 'Export',
      action: 'Export',
      details: 'Exported sandwich collection data',
    },
  },
  {
    pattern: '/api/sandwich-collections',
    rule: {
      section: 'Collections',
      feature: 'Collection Entry',
      action: 'View',
      details: 'Viewed sandwich collections',
      groupKey: 'collections-view',
      dedupeWindowMs: 60000,
      methods: ['GET'],
    },
  },

  // Projects
  {
    pattern: '/api/projects',
    rule: {
      section: 'Projects',
      feature: 'Project Management',
      action: 'View',
      details: 'Viewed projects',
      groupKey: 'projects-view',
      dedupeWindowMs: 60000,
      methods: ['GET'],
    },
  },

  // Meetings
  {
    pattern: '/api/meetings',
    rule: {
      section: 'Meetings',
      feature: 'Meeting Management',
      action: 'View',
      details: 'Viewed meetings',
      groupKey: 'meetings-view',
      dedupeWindowMs: 60000,
      methods: ['GET'],
    },
  },

  // Work Logs
  {
    pattern: '/api/work-logs',
    rule: {
      section: 'Work Log',
      feature: 'Time Tracking',
      action: 'View',
      details: 'Viewed work logs',
      groupKey: 'worklogs-view',
      dedupeWindowMs: 60000,
      methods: ['GET'],
    },
  },

  // TSP Holding Zone
  {
    pattern: '/api/holding-zone',
    rule: {
      section: 'Holding Zone',
      feature: 'Ideas & Tasks',
      action: 'View',
      details: 'Viewed TSP Holding Zone',
      groupKey: 'holding-zone-view',
      dedupeWindowMs: 60000,
      methods: ['GET'],
    },
  },

  // Emails
  {
    pattern: '/api/emails',
    rule: {
      section: 'Communication',
      feature: 'Email',
      action: 'View',
      details: 'Accessed email system',
      groupKey: 'emails-view',
      dedupeWindowMs: 60000,
      methods: ['GET'],
    },
  },

  // Kudos
  {
    pattern: '/api/kudos',
    rule: {
      section: 'Communication',
      feature: 'Kudos',
      action: 'View',
      details: 'Viewed kudos messages',
      groupKey: 'kudos-view',
      dedupeWindowMs: 60000,
      methods: ['GET'],
    },
  },

  // Driver Planning
  {
    pattern: '/api/driver-candidates',
    rule: {
      section: 'Driver Planning',
      feature: 'Route Planning',
      action: 'View',
      details: 'Accessed driver planning tools',
      groupKey: 'driver-planning',
      dedupeWindowMs: 60000,
    },
  },

  // Analytics
  {
    pattern: '/api/analytics',
    rule: {
      section: 'Analytics',
      feature: 'Reports',
      action: 'View',
      details: 'Viewed analytics dashboard',
      groupKey: 'analytics-view',
      dedupeWindowMs: 60000,
    },
  },

  // Reports
  {
    pattern: '/api/reports',
    rule: {
      section: 'Reports',
      feature: 'Report Generation',
      action: 'View',
      details: 'Accessed reports',
      groupKey: 'reports-view',
      dedupeWindowMs: 60000,
      methods: ['GET'],
    },
  },
];

// Paths to completely skip - these provide zero user insight
const skipPaths = [
  '/api/auth/user',
  '/api/message-notifications',
  '/api/emails/unread-count',
  '/api/messaging/unread',
  '/unread',
  '/api/notifications/counts',
  '/count',
  '/stats',
  '/kudos/unnotified',
  '/api/online',
  '/api/health',
  '/api/ping',
  '/socket.io',
  '/api/dismissed-announcements',
  '/api/activity-log',
  '/api/activity-logs',
  '/api/announcements/dismissed',
];

function matchActivityRule(path: string, method: string): ActivityRule | null {
  for (const { pattern, rule } of activityRules) {
    const matches =
      typeof pattern === 'string'
        ? path.includes(pattern)
        : pattern.test(path);

    if (matches) {
      // Check if method is allowed
      if (rule.methods && !rule.methods.includes(method)) {
        continue;
      }
      return rule;
    }
  }
  return null;
}

function shouldDedupe(userId: number, groupKey: string, windowMs: number): boolean {
  const cacheKey = `${userId}:${groupKey}`;
  const lastLog = activityDedupeCache.get(cacheKey);
  const now = Date.now();

  if (lastLog && now - lastLog < windowMs) {
    return true; // Skip - within dedup window
  }

  activityDedupeCache.set(cacheKey, now);
  return false;
}

// Map HTTP methods to readable actions for fallback
const methodToAction: Record<string, { action: string; description: string }> = {
  GET: { action: 'View', description: 'Viewed' },
  POST: { action: 'Create', description: 'Created' },
  PUT: { action: 'Update', description: 'Updated' },
  PATCH: { action: 'Update', description: 'Updated' },
  DELETE: { action: 'Delete', description: 'Deleted' },
};

export function createActivityLogger(options: ActivityLoggerOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip OPTIONS and paths with zero insight value
    const shouldSkip =
      req.method === 'OPTIONS' ||
      skipPaths.some((path) => req.path.includes(path));

    if (shouldSkip) {
      return next();
    }

    // Store original end method
    const originalEnd = res.end;

    // Override end method to log after response
    (res as any).end = function (this: Response, chunk?: any, encoding?: any) {
      setImmediate(async () => {
        try {
          const user = (req as any).user;

          if (user?.id && res.statusCode < 400) {
            // Try to match a semantic activity rule
            const rule = matchActivityRule(req.path, req.method);

            let section: string;
            let feature: string;
            let action: string;
            let details: string;

            if (rule) {
              // Check deduplication
              if (rule.groupKey && rule.dedupeWindowMs) {
                if (shouldDedupe(user.id, rule.groupKey, rule.dedupeWindowMs)) {
                  // Skip logging - already logged recently
                  return originalEnd.call(this, chunk, encoding);
                }
              }

              section = rule.section;
              feature = rule.feature;
              action = rule.action;
              details = rule.details;
            } else {
              // Fallback for unmapped endpoints - generate meaningful description
              const actionInfo = methodToAction[req.method] || { action: 'Access', description: 'Accessed' };
              action = actionInfo.action;

              // Extract section from path
              const pathParts = req.path.split('/').filter((p) => p && p !== 'api');
              
              if (pathParts.length > 0) {
                // Capitalize and format section name
                const rawSection = pathParts[0].replace(/-/g, ' ');
                section = rawSection.charAt(0).toUpperCase() + rawSection.slice(1);
                
                // Build meaningful feature name
                if (pathParts.length > 1) {
                  const rawFeature = pathParts[1].replace(/-/g, ' ');
                  feature = rawFeature.charAt(0).toUpperCase() + rawFeature.slice(1);
                } else {
                  feature = section;
                }
                
                // Build details based on action and section
                if (action === 'Create') {
                  details = `Created new ${section.toLowerCase()} entry`;
                } else if (action === 'Update') {
                  const idMatch = req.path.match(/\/(\d+)(?:\/|$)/);
                  details = idMatch
                    ? `Updated ${section.toLowerCase()} #${idMatch[1]}`
                    : `Updated ${section.toLowerCase()} settings`;
                } else if (action === 'Delete') {
                  const idMatch = req.path.match(/\/(\d+)(?:\/|$)/);
                  details = idMatch
                    ? `Deleted ${section.toLowerCase()} #${idMatch[1]}`
                    : `Deleted ${section.toLowerCase()} item`;
                } else {
                  details = `Viewed ${section.toLowerCase()}`;
                }
              } else {
                section = 'Platform';
                feature = 'Navigation';
                details = 'Navigated the platform';
              }
            }

            // Update user's last active timestamp
            await options.storage.updateUserLastActive(user.id);

            // Build metadata
            const metadata: any = {
              url: req.originalUrl || req.url,
              method: req.method,
              statusCode: res.statusCode,
              timestamp: new Date().toISOString(),
            };

            // Add query params if meaningful
            if (Object.keys(req.query).length > 0) {
              metadata.queryParams = req.query;
            }

            // Create activity log entry
            await options.storage.logUserActivity({
              userId: user.id,
              action,
              section,
              page: req.path,
              feature,
              details,
              sessionId: (req as any).sessionID,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent') || 'Unknown',
              metadata,
            });
          }
        } catch (error) {
          logger.error('Error logging user activity:', error);
        }
      });

      return originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}
