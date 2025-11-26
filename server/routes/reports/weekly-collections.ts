import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { sandwichCollections } from '@shared/schema';
import { sql, isNull } from 'drizzle-orm';

const weeklyCollectionsRouter = Router();

interface LocationBreakdown {
  location: string;
  individual: number;
  groupTotal: number;
  groupEventCount: number;
}

interface WeeklyData {
  weekStartDate: string;
  weekEndDate: string;
  collectionCount: number;
  totalSandwiches: number;
  individual: number;
  groupCollections: number;
  locationBreakdowns: LocationBreakdown[];
}

// GET /api/reports/weekly-collections
// Query params: startDate, endDate (YYYY-MM-DD format), exactDates (optional boolean)
weeklyCollectionsRouter.get('/', async (req, res) => {
  try {
    const { startDate, endDate, exactDates } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'startDate and endDate query parameters are required (YYYY-MM-DD format)',
      });
    }

    const start = new Date(String(startDate));
    const end = new Date(String(endDate));
    const useExactDates = exactDates === 'true';

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

    let queryStartStr: string;
    let queryEndStr: string;

    if (useExactDates) {
      // Use exact dates as provided
      queryStartStr = start.toISOString().split('T')[0];
      queryEndStr = end.toISOString().split('T')[0];
    } else {
      // Expand the date range to include full Wednesday-Tuesday weeks
      // Find the Wednesday of the week containing the start date
      const startDayOfWeek = start.getDay();
      const daysToGoBackFromStart = (startDayOfWeek - 3 + 7) % 7;
      const expandedStart = new Date(start);
      expandedStart.setDate(expandedStart.getDate() - daysToGoBackFromStart);

      // Find the Tuesday of the week containing the end date
      const endDayOfWeek = end.getDay();
      const daysToGoForwardToTuesday = (2 - endDayOfWeek + 7) % 7;
      const expandedEnd = new Date(end);
      expandedEnd.setDate(expandedEnd.getDate() + daysToGoForwardToTuesday);

      queryStartStr = expandedStart.toISOString().split('T')[0];
      queryEndStr = expandedEnd.toISOString().split('T')[0];
    }

    // Get all collections in the date range
    const collections = await db
      .select()
      .from(sandwichCollections)
      .where(sql`${sandwichCollections.collectionDate} >= ${queryStartStr} AND ${sandwichCollections.collectionDate} <= ${queryEndStr} AND ${isNull(sandwichCollections.deletedAt)}`)
      .orderBy(sandwichCollections.collectionDate);

    // Group by Wed-Tue weeks
    const weeklyMap = new Map<string, WeeklyData>();
    // Track location data per week: Map<weekKey, Map<location, LocationBreakdown>>
    const locationMap = new Map<string, Map<string, LocationBreakdown>>();

    for (const collection of collections) {
      const collectionDate = new Date(collection.collectionDate);

      // Get the Wednesday of this week (or the Wednesday before if not Wednesday)
      const dayOfWeek = collectionDate.getDay();
      // Calculate days to go back to reach Wednesday (3)
      // Formula: (dayOfWeek - 3 + 7) % 7 gives us days back from current day to Wednesday
      const daysToGoBack = (dayOfWeek - 3 + 7) % 7;
      const wednesday = new Date(collectionDate);
      wednesday.setDate(wednesday.getDate() - daysToGoBack);

      // Format Wednesday date as YYYY-MM-DD
      const wedStr = wednesday.toISOString().split('T')[0];
      const tuesday = new Date(wednesday);
      tuesday.setDate(tuesday.getDate() + 6);
      const tueStr = tuesday.toISOString().split('T')[0];
      const weekKey = `${wedStr}`;

      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, {
          weekStartDate: wedStr,
          weekEndDate: tueStr,
          collectionCount: 0,
          totalSandwiches: 0,
          individual: 0,
          groupCollections: 0,
          locationBreakdowns: [],
        });
        locationMap.set(weekKey, new Map());
      }

      const week = weeklyMap.get(weekKey)!;
      const weekLocations = locationMap.get(weekKey)!;
      week.collectionCount += 1;

      const individual = collection.individualSandwiches || 0;
      const location = collection.hostName || 'Unknown';

      // Handle both new groupCollections array and legacy group1/group2 fields
      let groupColl = 0;
      let groupEventCount = 0;

      if (collection.groupCollections && Array.isArray(collection.groupCollections) && collection.groupCollections.length > 0) {
        // NEW FORMAT: Use groupCollections JSON array - sum ALL groups
        groupColl = collection.groupCollections.reduce((sum: number, g: any) => sum + (g.count || 0), 0);
        groupEventCount = collection.groupCollections.length;
      } else {
        // LEGACY FORMAT: Use old group1Count and group2Count fields
        const g1 = collection.group1Count || 0;
        const g2 = collection.group2Count || 0;
        groupColl = g1 + g2;
        // Count legacy group events (if they have a count > 0)
        if (g1 > 0) groupEventCount++;
        if (g2 > 0) groupEventCount++;
      }

      // Track location breakdown
      if (!weekLocations.has(location)) {
        weekLocations.set(location, {
          location,
          individual: 0,
          groupTotal: 0,
          groupEventCount: 0,
        });
      }
      const locData = weekLocations.get(location)!;
      locData.individual += individual;
      locData.groupTotal += groupColl;
      locData.groupEventCount += groupEventCount;

      week.individual += individual;
      week.groupCollections += groupColl;
      // Total is individual + all group collections
      week.totalSandwiches += individual + groupColl;
    }

    // Attach location breakdowns to each week
    for (const [weekKey, week] of weeklyMap) {
      const weekLocations = locationMap.get(weekKey);
      if (weekLocations) {
        week.locationBreakdowns = Array.from(weekLocations.values()).sort((a, b) =>
          a.location.localeCompare(b.location)
        );
      }
    }

    const result = Array.from(weeklyMap.values()).sort(
      (a, b) => new Date(a.weekStartDate).getTime() - new Date(b.weekStartDate).getTime()
    );

    res.json({
      startDate,
      endDate,
      weeks: result,
      totalWeeks: result.length,
      grandTotal: result.reduce((sum, week) => sum + week.totalSandwiches, 0),
    });
  } catch (error) {
    console.error('[Weekly Collections Report Error]', error);
    res.status(500).json({
      error: 'Failed to fetch weekly collections data',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default weeklyCollectionsRouter;
