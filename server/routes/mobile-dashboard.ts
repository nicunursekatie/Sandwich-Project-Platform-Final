import { Router } from 'express';
import type { RouterDependencies } from '../types';
import { db } from '../db';
import { sandwichCollections, recipients, eventRequests } from '@shared/schema';
import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { logger } from '../utils/production-safe-logger';

// Group-sandwich count for one collection — mirrors the client's
// calculateGroupSandwiches (client/src/lib/analytics-utils.ts): prefer the
// groupCollections JSONB array, fall back to legacy group1/group2 counts.
function groupSandwiches(c: any): number {
  const gc = c.groupCollections;
  if (Array.isArray(gc) && gc.length > 0) {
    return gc.reduce(
      (sum: number, g: any) => sum + Number(g?.count || g?.sandwichCount || 0),
      0
    );
  }
  if (typeof gc === 'string' && gc !== '' && gc !== '[]') {
    try {
      const parsed = JSON.parse(gc);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.reduce(
          (sum: number, g: any) =>
            sum + Number(g?.count || g?.sandwichCount || 0),
          0
        );
      }
    } catch {
      // fall through to legacy fields
    }
  }
  return Number(c.group1Count || 0) + Number(c.group2Count || 0);
}

const totalSandwiches = (c: any): number =>
  Number(c.individualSandwiches || 0) + groupSandwiches(c);

// The TSP operating week runs Friday 00:00 → Thursday 23:59 (Eastern). "Today"
// is resolved in Eastern time; the rest is pure date arithmetic.
function currentWeek() {
  const todayStr = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/New_York',
  }); // YYYY-MM-DD
  const today = new Date(`${todayStr}T00:00:00`);
  const daysFromFriday = (today.getDay() + 2) % 7; // Fri (5) -> 0
  const friday = new Date(today);
  friday.setDate(today.getDate() - daysFromFriday);
  const thursday = new Date(friday);
  thursday.setDate(friday.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  const startStr = fmt(friday);
  const endStr = fmt(thursday);
  return {
    startStr,
    endStr,
    startDate: new Date(`${startStr}T00:00:00`),
    endDate: new Date(`${endStr}T23:59:59`),
  };
}

// Dashboard stats + recent activity feed for the mobile home screen.
export function createMobileDashboardRouter(deps: RouterDependencies) {
  const router = Router();
  const { isAuthenticated } = deps;

  // GET /api/dashboard/stats — headline numbers for the current TSP week
  router.get('/dashboard/stats', isAuthenticated, async (_req, res) => {
    try {
      const { startStr, endStr, startDate, endDate } = currentWeek();

      // Sandwich totals collected this week (collection_date is a YYYY-MM-DD
      // string, so ISO string comparison gives the correct range).
      const weekCollections = await db
        .select()
        .from(sandwichCollections)
        .where(
          and(
            gte(sandwichCollections.collectionDate, startStr),
            lte(sandwichCollections.collectionDate, endStr),
            isNull(sandwichCollections.deletedAt)
          )
        );
      const weeklyTotal = weekCollections.reduce(
        (sum, c) => sum + totalSandwiches(c),
        0
      );

      // Active recipient organizations
      const activeRecipients = await db
        .select({ id: recipients.id })
        .from(recipients)
        .where(eq(recipients.status, 'active'));
      const recipientsServed = activeRecipients.length;

      // Events scheduled into this week (null scheduled dates are excluded by
      // the range comparison automatically).
      const weekEvents = await db
        .select({ status: eventRequests.status })
        .from(eventRequests)
        .where(
          and(
            gte(eventRequests.scheduledEventDate, startDate),
            lte(eventRequests.scheduledEventDate, endDate)
          )
        );
      const eventsThisWeek = weekEvents.filter(
        (e) => e.status === 'scheduled' || e.status === 'completed'
      ).length;
      const deliveries = weekEvents.filter(
        (e) => e.status === 'completed'
      ).length;

      res.json({ weeklyTotal, recipientsServed, deliveries, eventsThisWeek });
    } catch (error) {
      logger.error('[Dashboard API] Error building stats:', error);
      res.status(500).json({ message: 'Failed to fetch dashboard stats' });
    }
  });

  // GET /api/activity/recent — most recent sandwich collections as an activity feed
  router.get('/activity/recent', isAuthenticated, async (_req, res) => {
    try {
      const recent = await db
        .select()
        .from(sandwichCollections)
        .where(isNull(sandwichCollections.deletedAt))
        .orderBy(desc(sandwichCollections.submittedAt))
        .limit(10);

      const activity = recent.map((c) => ({
        description: `${c.hostName} logged ${totalSandwiches(
          c
        ).toLocaleString()} sandwiches`,
        timestamp: c.submittedAt,
      }));
      res.json(activity);
    } catch (error) {
      logger.error('[Dashboard API] Error building recent activity:', error);
      res.status(500).json({ message: 'Failed to fetch recent activity' });
    }
  });

  return router;
}
