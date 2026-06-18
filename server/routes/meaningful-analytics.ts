import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import {
  users,
  sandwichCollections,
  eventVolunteers,
  teamBoardItems,
  teamBoardComments,
  userActivityLogs,
  meetings,
  impactReports,
  auditLogs,
} from '@shared/schema';
import { sql, gte, and, isNull, isNotNull } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';

/**
 * GET /api/meaningful-analytics/user-contributions?days=30
 * GET /api/meaningful-analytics/platform-impact?days=30
 *
 * Backs the User Management → Impact tab. Aggregates per-user counts over the
 * requested window from the tables that actually carry creator/actor columns:
 *
 *   - sandwich_collections.created_by   → sandwichDataEntered
 *   - event_volunteers.assigned_by      → volunteersManaged
 *   - team_board_items.created_by       → messagesPosted (+ comments)
 *   - team_board_comments.user_id       → messagesPosted (+ items)
 *   - user_activity_logs.user_id        → daysActive (DISTINCT DATE)
 *   - users.last_login_at               → lastActive
 *
 * Two metrics that the Impact UI shows can't be attributed per-user with the
 * current schema (impactReports has no createdBy, meetings has no createdBy).
 * We return 0 for those at the user level and surface the platform-wide count
 * in the summary endpoint instead.
 */

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;

function parseDays(input: unknown): number {
  const n = parseInt(String(input ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_DAYS;
  return Math.min(n, MAX_DAYS);
}

function rangeStart(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// Weighted score: data entry is the highest-value activity for TSP. Volunteer
// coordination second, messaging third, presence (days active) fourth.
// Capped at 100 — the normalization base is set so a busy week clears 75.
function computeContributionScore(metrics: {
  sandwichDataEntered: number;
  volunteersManaged: number;
  messagesPosted: number;
  daysActive: number;
}): number {
  const raw =
    metrics.sandwichDataEntered * 3 +
    metrics.volunteersManaged * 4 +
    metrics.messagesPosted * 1 +
    metrics.daysActive * 2;
  // 50 raw points ≈ 100 score (e.g., 10 collections + 2 volunteer assignments
  // + 5 messages + 7 active days = 30+8+5+14 = 57 → 100). Tunable later.
  return Math.min(100, Math.round((raw / 50) * 100));
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

      // Single pass: pull every user, then run one aggregation query per metric
      // and zip the results together. Each metric query returns (user_id, count)
      // rows; we build a Map and look up each user's counts. This keeps the
      // queries simple and indexable without a giant join.

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

      const sandwichesByUser = await db
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

      const volunteersByUser = await db
        .select({
          userId: eventVolunteers.assignedBy,
          count: sql<number>`count(*)::int`,
        })
        .from(eventVolunteers)
        .where(
          and(
            isNotNull(eventVolunteers.assignedBy),
            gte(eventVolunteers.createdAt, since)
          )
        )
        .groupBy(eventVolunteers.assignedBy);

      const itemsByUser = await db
        .select({
          userId: teamBoardItems.createdBy,
          count: sql<number>`count(*)::int`,
        })
        .from(teamBoardItems)
        .where(gte(teamBoardItems.createdAt, since))
        .groupBy(teamBoardItems.createdBy);

      const commentsByUser = await db
        .select({
          userId: teamBoardComments.userId,
          count: sql<number>`count(*)::int`,
        })
        .from(teamBoardComments)
        .where(gte(teamBoardComments.createdAt, since))
        .groupBy(teamBoardComments.userId);

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

      const sandwichMap = toMap(sandwichesByUser);
      const volunteerMap = toMap(volunteersByUser);
      const itemsMap = toMap(itemsByUser);
      const commentsMap = toMap(commentsByUser);
      const activeDaysMap = toMap(activeDaysByUser);

      const contributions = allUsers.map((u) => {
        const sandwichDataEntered = sandwichMap.get(u.id) ?? 0;
        const volunteersManaged = volunteerMap.get(u.id) ?? 0;
        const messagesPosted =
          (itemsMap.get(u.id) ?? 0) + (commentsMap.get(u.id) ?? 0);
        const daysActive = activeDaysMap.get(u.id) ?? 0;
        const reportsGenerated = 0; // schema can't attribute per-user; surfaced platform-wide
        const meetingsScheduled = 0; // same

        return {
          userId: u.id,
          userName: displayNameFor(u),
          email: u.email ?? '',
          role: u.role ?? 'volunteer',
          sandwichDataEntered,
          volunteersManaged,
          reportsGenerated,
          messagesPosted,
          meetingsScheduled,
          daysActive,
          lastActive: u.lastLoginAt,
          totalContributionValue: computeContributionScore({
            sandwichDataEntered,
            volunteersManaged,
            messagesPosted,
            daysActive,
          }),
        };
      });

      // Sort highest contribution first so the UI gets a usable default ordering.
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

      // Each row is a scalar; await them in parallel for the platform summary.
      const [
        [sandwichCount],
        [volunteerCount],
        [hostsCount],
        [reportsCount],
        [activeUsersCount],
        [recentDataEntries],
        [recentCommunications],
        [recentCoordination],
      ] = await Promise.all([
        db
          .select({
            // Total sandwiches across the window — sum of individual + group counts.
            sum: sql<number>`coalesce(sum(
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
          )
          .then((rows) => [{ value: rows[0]?.sum ?? 0 }]),

        db
          .select({
            value: sql<number>`count(distinct ${eventVolunteers.volunteerUserId})::int`,
          })
          .from(eventVolunteers)
          .where(gte(eventVolunteers.createdAt, since)),

        // "Hosts connected" = distinct host names that received collections in window.
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

        // Distinct users with any activity in the window.
        db
          .select({
            value: sql<number>`count(distinct ${userActivityLogs.userId})::int`,
          })
          .from(userActivityLogs)
          .where(gte(userActivityLogs.createdAt, since)),

        db
          .select({ value: sql<number>`count(*)::int` })
          .from(sandwichCollections)
          .where(
            and(
              isNull(sandwichCollections.deletedAt),
              gte(sandwichCollections.submittedAt, since)
            )
          ),

        db
          .select({ value: sql<number>`count(*)::int` })
          .from(teamBoardItems)
          .where(gte(teamBoardItems.createdAt, since)),

        db
          .select({ value: sql<number>`count(*)::int` })
          .from(eventVolunteers)
          .where(gte(eventVolunteers.createdAt, since)),
      ]);

      const totalUsers = await db
        .select({ value: sql<number>`count(*)::int` })
        .from(users);

      const totalUserCount = totalUsers[0]?.value ?? 0;
      const active = activeUsersCount.value ?? 0;
      const userProductivity =
        totalUserCount > 0 ? Math.round((active / totalUserCount) * 100) : 0;

      res.json({
        totalSandwichesRecorded: sandwichCount.value,
        totalVolunteersManaged: volunteerCount.value,
        totalHostsConnected: hostsCount.value,
        totalReportsGenerated: reportsCount.value,
        activeContributors: active,
        // dataQualityScore would require a separate audit; surface a placeholder
        // until we define what "quality" means — kept here to satisfy the UI contract.
        dataQualityScore: 0,
        userProductivity,
        recentDataEntries: recentDataEntries.value,
        recentCommunications: recentCommunications.value,
        recentCoordination: recentCoordination.value,
      });
    } catch (err) {
      logger.error('platform-impact failed', err);
      res.status(500).json({ error: 'Failed to compute platform impact' });
    }
  });

  return router;
}
