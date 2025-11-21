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
  group1: number;
  group2: number;
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

    // Get all collections in the date range
    const collections = await db
      .select()
      .from(sandwichCollections)
      .where(sql`${sandwichCollections.collectionDate} >= ${startDate} AND ${sandwichCollections.collectionDate} <= ${endDate} AND ${isNull(sandwichCollections.deletedAt)}`)
      .orderBy(sandwichCollections.collectionDate);

    // Group by Wed-Tue weeks
    const weeklyMap = new Map<string, WeeklyData>();

    for (const collection of collections) {
      const collectionDate = new Date(collection.collectionDate);
      
      // Get the Wednesday of this week
      const dayOfWeek = collectionDate.getDay();
      const diff = collectionDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1) - 2; // Wednesday = 3
      const wednesday = new Date(collectionDate.setDate(diff));
      
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
          group1: 0,
          group2: 0,
          groupCollections: 0,
        });
      }

      const week = weeklyMap.get(weekKey)!;
      week.collectionCount += 1;
      
      const individual = collection.individualSandwiches || 0;
      const g1 = collection.group1Count || 0;
      const g2 = collection.group2Count || 0;
      let groupColl = 0;

      if (collection.groupCollections && Array.isArray(collection.groupCollections)) {
        groupColl = collection.groupCollections.reduce((sum: number, g: any) => sum + (g.count || 0), 0);
      }

      week.individual += individual;
      week.group1 += g1;
      week.group2 += g2;
      week.groupCollections += groupColl;
      week.totalSandwiches += individual + g1 + g2 + groupColl;
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
