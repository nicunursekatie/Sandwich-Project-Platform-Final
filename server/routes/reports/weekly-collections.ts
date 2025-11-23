import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { sandwichCollections } from '@shared/schema';
import { sql, isNull } from 'drizzle-orm';

const weeklyCollectionsRouter = Router();

interface WeeklyData {
  weekStartDate: string;
  weekEndDate: string;
  collectionCount: number;
  totalSandwiches: number;
  individual: number;
  groupCollections: number;
}

// GET /api/reports/weekly-collections
// Query params: startDate, endDate (YYYY-MM-DD format)
weeklyCollectionsRouter.get('/', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'startDate and endDate query parameters are required (YYYY-MM-DD format)',
      });
    }

    const start = new Date(String(startDate));
    const end = new Date(String(endDate));

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD',
      });
    }

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
    
    const expandedStartStr = expandedStart.toISOString().split('T')[0];
    const expandedEndStr = expandedEnd.toISOString().split('T')[0];

    // Get all collections in the EXPANDED date range (full weeks)
    const collections = await db
      .select()
      .from(sandwichCollections)
      .where(sql`${sandwichCollections.collectionDate} >= ${expandedStartStr} AND ${sandwichCollections.collectionDate} <= ${expandedEndStr} AND ${isNull(sandwichCollections.deletedAt)}`)
      .orderBy(sandwichCollections.collectionDate);

    // Group by Wed-Tue weeks
    const weeklyMap = new Map<string, WeeklyData>();

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
        });
      }

      const week = weeklyMap.get(weekKey)!;
      week.collectionCount += 1;

      const individual = collection.individualSandwiches || 0;

      // Handle both new groupCollections array and legacy group1/group2 fields
      let groupColl = 0;

      if (collection.groupCollections && Array.isArray(collection.groupCollections) && collection.groupCollections.length > 0) {
        // NEW FORMAT: Use groupCollections JSON array - sum ALL groups
        groupColl = collection.groupCollections.reduce((sum: number, g: any) => sum + (g.count || 0), 0);
      } else {
        // LEGACY FORMAT: Use old group1Count and group2Count fields
        const g1 = collection.group1Count || 0;
        const g2 = collection.group2Count || 0;
        groupColl = g1 + g2;
      }

      week.individual += individual;
      week.groupCollections += groupColl;
      // Total is individual + all group collections
      week.totalSandwiches += individual + groupColl;
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
