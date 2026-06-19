import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import {
  users,
  sandwichCollections,
  eventRequests,
  teamBoardComments,
  userActivityLogs,
  messages,
  impactReports,
} from '@shared/schema';
import { sql, gte, and, isNull, isNotNull, or, eq, inArray } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';

/**
 * GET /api/meaningful-analytics/user-contributions?days=30
 * GET /api/meaningful-analytics/platform-impact?days=30
 *
 * Backs the User Management → Impact tab.
 *
 * Per-user metrics:
 *   - eventsAssigned*       → event_requests where user is tspContact /
 *                              tspContactAssigned / additionalContact1 /
 *                              additionalContact2. NOT time-windowed; reflects
 *                              current event load regardless of creation date.
 *                              Broken down by status (completed vs active).
 *   - collectionLogsRecorded → sandwich_collections row count (not sandwich
 *                              total) attributed via created_by, in window.
 *   - messagesSent           → messages.sender_id + team_board_comments.user_id
 *                              in window. Covers chat + project-thread comments.
 *   - resourcesAccessed      → user_activity_logs rows with section='Resources'
 *                              in window. Captures uploads, views, downloads.
 *   - daysActive             → distinct DATE(created_at) on user_activity_logs.
 *   - lastActive             → users.last_login_at.
 *
 * Active event statuses (for eventsAssignedActive):
 *   new, in_process, scheduled, rescheduled, standby
 *
 * Contribution score is a weighted, normalized 0-100:
 *   completed events × 5 + collection logs × 3 + messages × 1 + resources × 1
 *   normalized so a busy week (e.g., 2 completed events + 4 logs + 8 messages
 *   + 5 resources) clears 75.
 */

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

const ACTIVE_EVENT_STATUSES = [
  'new',
  'in_process',
  'scheduled',
  'rescheduled',
  'standby',
];

function parseDays(input: unknown): number {
  const n = parseInt(String(input ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_DAYS;
  return Math.min(n, MAX_DAYS);
}

function rangeStart(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function computeContributionScore(metrics: {
  eventsAssignedCompleted: number;
  collectionLogsRecorded: number;
  messagesSent: number;
  resourcesAccessed: number;
}): number {
  const raw =
    metrics.eventsAssignedCompleted * 5 +
    metrics.collectionLogsRecorded * 3 +
    metrics.messagesSent * 1 +
    metrics.resourcesAccessed * 1;
  // 35 raw points ≈ 100 score. E.g., 2 completed events + 4 logs + 8 messages
  // + 5 resources = 10 + 12 + 8 + 5 = 35 → 100. Tunable.
  return Math.min(100, Math.round((raw / 35) * 100));
}

function displayNameFor(u: {
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  email: string | null;
}): string {
  if (u.displayName?.trim()) return u.displayName.trim();
  const parts = [u.firstName?.trim(), u.lastName?.trim()].filter(Boolean);
  if (parts.length) return parts.join(' ');
  return u.email ?? 'Unknown user';
}

export function createMeaningfulAnalyticsRouter(): Router {
  const router = Router();

  router.get('/user-contributions', async (req: Request, res: Response) => {
    try {
      const days = parseDays(req.query.days);
      const since = rangeStart(days);

      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          displayName: users.displayName,
          role: users.role,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users);

      // ---- Events assigned (current state, NOT time-windowed) ----
      // A user is "assigned" if they appear in any of four contact columns.
      // We pull all relevant events and tally per-user in JS to handle the
      // multi-column OR cleanly. For TSP scale (~1100 event records) this is
      // fine; if it grows we can move to a per-column UNION ALL.
      const assignedEvents = await db
        .select({
          id: eventRequests.id,
          status: eventRequests.status,
          tspContact: eventRequests.tspContact,
          tspContactAssigned: eventRequests.tspContactAssigned,
          additionalContact1: eventRequests.additionalContact1,
          additionalContact2: eventRequests.additionalContact2,
        })
        .from(eventRequests)
        .where(
          or(
            isNotNull(eventRequests.tspContact),
            isNotNull(eventRequests.tspContactAssigned),
            isNotNull(eventRequests.additionalContact1),
            isNotNull(eventRequests.additionalContact2)
          )
        );

      const eventsByUser = new Map<
        string,
        { total: number; completed: number; active: number }
      >();
      const bump = (
        userId: string | null,
        status: string | null,
        seenInThisEvent: Set<string>
      ) => {
        if (!userId) return;
        // A user only counts once per event even if they appear in multiple
        // contact columns on it.
        if (seenInThisEvent.has(userId)) return;
        seenInThisEvent.add(userId);
        const entry = eventsByUser.get(userId) ?? {
          total: 0,
          completed: 0,
          active: 0,
        };
        entry.total += 1;
        if (status === 'completed') entry.completed += 1;
        else if (status && ACTIVE_EVENT_STATUSES.includes(status))
          entry.active += 1;
        eventsByUser.set(userId, entry);
      };

      for (const e of assignedEvents) {
        const seen = new Set<string>();
        bump(e.tspContact, e.status, seen);
        bump(e.tspContactAssigned, e.status, seen);
        bump(e.additionalContact1, e.status, seen);
        bump(e.additionalContact2, e.status, seen);
      }

      // ---- Collection logs recorded (window) ----
      const logsByUser = await db
        .select({
          userId: sandwichCollections.createdBy,
          count: sql<number>`count(*)::int`,
        })
        .from(sandwichCollections)
        .where(
          and(
            isNotNull(sandwichCollections.createdBy),
            isNull(sandwichCollections.deletedAt),
            gte(sandwichCollections.submittedAt, since)
          )
        )
        .groupBy(sandwichCollections.createdBy);

      // ---- Messages sent (chat + project-thread comments) ----
      const chatMessagesByUser = await db
        .select({
          userId: messages.senderId,
          count: sql<number>`count(*)::int`,
        })
        .from(messages)
        .where(
          and(
            gte(messages.createdAt, since),
            isNull(messages.deletedAt)
          )
        )
        .groupBy(messages.senderId);

      const teamBoardCommentsByUser = await db
        .select({
          userId: teamBoardComments.userId,
          count: sql<number>`count(*)::int`,
        })
        .from(teamBoardComments)
        .where(gte(teamBoardComments.createdAt, since))
        .groupBy(teamBoardComments.userId);

      // ---- Resources accessed (window) ----
      const resourcesByUser = await db
        .select({
          userId: userActivityLogs.userId,
          count: sql<number>`count(*)::int`,
        })
        .from(userActivityLogs)
        .where(
          and(
            gte(userActivityLogs.createdAt, since),
            eq(userActivityLogs.section, 'Resources')
          )
        )
        .groupBy(userActivityLogs.userId);

      // ---- Days active (window) ----
      const activeDaysByUser = await db
        .select({
          userId: userActivityLogs.userId,
          count: sql<number>`count(distinct date(${userActivityLogs.createdAt}))::int`,
        })
        .from(userActivityLogs)
        .where(gte(userActivityLogs.createdAt, since))
        .groupBy(userActivityLogs.userId);

      const toMap = (rows: Array<{ userId: string | null; count: number }>) => {
        const m = new Map<string, number>();
        for (const r of rows) if (r.userId) m.set(r.userId, r.count);
        return m;
      };

      const logsMap = toMap(logsByUser);
      const chatMap = toMap(chatMessagesByUser);
      const teamBoardMap = toMap(teamBoardCommentsByUser);
      const resourcesMap = toMap(resourcesByUser);
      const activeDaysMap = toMap(activeDaysByUser);

      const contributions = allUsers.map((u) => {
        const evt = eventsByUser.get(u.id) ?? {
          total: 0,
          completed: 0,
          active: 0,
        };
        const collectionLogsRecorded = logsMap.get(u.id) ?? 0;
        const messagesSent =
          (chatMap.get(u.id) ?? 0) + (teamBoardMap.get(u.id) ?? 0);
        const resourcesAccessed = resourcesMap.get(u.id) ?? 0;
        const daysActive = activeDaysMap.get(u.id) ?? 0;

        return {
          userId: u.id,
          userName: displayNameFor(u),
          email: u.email ?? '',
          role: u.role ?? 'volunteer',
          eventsAssigned: evt.total,
          eventsAssignedCompleted: evt.completed,
          eventsAssignedActive: evt.active,
          collectionLogsRecorded,
          messagesSent,
          resourcesAccessed,
          daysActive,
          lastActive: u.lastLoginAt,
          totalContributionValue: computeContributionScore({
            eventsAssignedCompleted: evt.completed,
            collectionLogsRecorded,
            messagesSent,
            resourcesAccessed,
          }),
        };
      });

      contributions.sort(
        (a, b) => b.totalContributionValue - a.totalContributionValue
      );

      res.json(contributions);
    } catch (err) {
      logger.error('user-contributions failed', err);
      res
        .status(500)
        .json({ error: 'Failed to compute user contributions' });
    }
  });

  router.get('/platform-impact', async (req: Request, res: Response) => {
    try {
      const days = parseDays(req.query.days);
      const since = rangeStart(days);

      const [
        [sandwichTotal],
        [collectionLogsTotal],
        [eventsActiveTotal],
        [eventsCompletedInWindow],
        [hostsCount],
        [reportsCount],
        [activeUsersCount],
        [messagesTotal],
        [resourcesTotal],
      ] = await Promise.all([
        // Total sandwich count across the window (sum of all sandwich numbers)
        db
          .select({
            value: sql<number>`coalesce(sum(
              coalesce(${sandwichCollections.individualSandwiches}, 0)
              + coalesce(${sandwichCollections.group1Count}, 0)
              + coalesce(${sandwichCollections.group2Count}, 0)
            ), 0)::int`,
          })
          .from(sandwichCollections)
          .where(
            and(
              isNull(sandwichCollections.deletedAt),
              gte(sandwichCollections.submittedAt, since)
            )
          ),

        // Total collection log entries in the window
        db
          .select({ value: sql<number>`count(*)::int` })
          .from(sandwichCollections)
          .where(
            and(
              isNull(sandwichCollections.deletedAt),
              gte(sandwichCollections.submittedAt, since)
            )
          ),

        // Currently active events (any TSP user is on the event card today)
        db
          .select({ value: sql<number>`count(*)::int` })
          .from(eventRequests)
          .where(inArray(eventRequests.status, ACTIVE_EVENT_STATUSES)),

        // Completed events updated within the window
        db
          .select({ value: sql<number>`count(*)::int` })
          .from(eventRequests)
          .where(
            and(
              eq(eventRequests.status, 'completed'),
              gte(eventRequests.updatedAt, since)
            )
          ),

        // Distinct host names that received collections in window
        db
          .select({
            value: sql<number>`count(distinct ${sandwichCollections.hostName})::int`,
          })
          .from(sandwichCollections)
          .where(
            and(
              isNull(sandwichCollections.deletedAt),
              gte(sandwichCollections.submittedAt, since)
            )
          ),

        db
          .select({ value: sql<number>`count(*)::int` })
          .from(impactReports)
          .where(gte(impactReports.createdAt, since)),

        // Distinct users with any activity in the window
        db
          .select({
            value: sql<number>`count(distinct ${userActivityLogs.userId})::int`,
          })
          .from(userActivityLogs)
          .where(gte(userActivityLogs.createdAt, since)),

        // Total messages (chat) in window — fast scalar for the summary
        db
          .select({ value: sql<number>`count(*)::int` })
          .from(messages)
          .where(
            and(gte(messages.createdAt, since), isNull(messages.deletedAt))
          ),

        // Total resource accesses in window
        db
          .select({ value: sql<number>`count(*)::int` })
          .from(userActivityLogs)
          .where(
            and(
              gte(userActivityLogs.createdAt, since),
              eq(userActivityLogs.section, 'Resources')
            )
          ),
      ]);

      const totalUsers = await db
        .select({ value: sql<number>`count(*)::int` })
        .from(users);

      const totalUserCount = totalUsers[0]?.value ?? 0;
      const active = activeUsersCount.value ?? 0;
      const userProductivity =
        totalUserCount > 0 ? Math.round((active / totalUserCount) * 100) : 0;

      res.json({
        totalSandwichesRecorded: sandwichTotal.value,
        totalCollectionLogs: collectionLogsTotal.value,
        totalEventsActive: eventsActiveTotal.value,
        totalEventsCompleted: eventsCompletedInWindow.value,
        totalHostsConnected: hostsCount.value,
        totalReportsGenerated: reportsCount.value,
        activeContributors: active,
        userProductivity,
        totalMessages: messagesTotal.value,
        totalResourceAccesses: resourcesTotal.value,
      });
    } catch (err) {
      logger.error('platform-impact failed', err);
      res.status(500).json({ error: 'Failed to compute platform impact' });
    }
  });

  return router;
}
