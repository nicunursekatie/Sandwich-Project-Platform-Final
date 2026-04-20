import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { storage } from '../../storage-wrapper';
import { logger } from '../../utils/production-safe-logger';

// Scott's authoritative weekly archive ends on this date. Anything after is
// live-log-only; anything before is authoritative-only. Anything on/before
// this date in 2025 is authoritative; after is live log.
export const AUTHORITATIVE_CUTOFF_DATE = '2025-08-06';

export type YearlyTotal = {
  year: number;
  records: number;
  sandwiches: number;
  source: 'authoritative' | 'collection_log' | 'hybrid';
};

export type HybridStats = {
  byYear: Record<number, YearlyTotal>;
  total: number;
  cutoffDate: string;
  description: string;
};

export type WeeklySeasonalPattern = {
  week: number;
  avgSandwiches: number;
  yearsOfData: number;
};

export type AuthoritativeSeasonalData = {
  weeklyAverages: WeeklySeasonalPattern[];
  lowWeeks: WeeklySeasonalPattern[];
  highWeeks: WeeklySeasonalPattern[];
  topLocations: Array<{ location: string; sandwiches: number }>;
};

function sumGroupSandwiches(
  collections: Array<{
    groupCollections?: unknown;
    group1Count?: number | null;
    group2Count?: number | null;
  }>
): number {
  return collections.reduce((total, c) => {
    if (Array.isArray(c.groupCollections) && c.groupCollections.length > 0) {
      return (
        total +
        (c.groupCollections as Array<{ count?: number }>).reduce(
          (sum, g) => sum + (g.count || 0),
          0
        )
      );
    }
    return total + (c.group1Count || 0) + (c.group2Count || 0);
  }, 0);
}

/**
 * Compute per-year sandwich totals by combining the authoritative weekly
 * archive (complete for 2020-2024 and 2025 through AUTHORITATIVE_CUTOFF_DATE)
 * with the live sandwich_collections log (for dates after the cutoff).
 *
 * This is the single source of truth for annual/historical totals. Callers
 * MUST NOT read authoritative_weekly_collections.year SUMs directly — those
 * rows are incomplete for the year the cutoff falls in (currently 2025).
 */
export async function getHybridYearlyStats(): Promise<HybridStats> {
  const authoritativeRows = await db.execute(sql`
    SELECT
      year,
      SUM(sandwiches)::bigint AS total_sandwiches,
      COUNT(*)::bigint AS record_count
    FROM authoritative_weekly_collections
    WHERE year < 2025 OR (year = 2025 AND week_date <= ${AUTHORITATIVE_CUTOFF_DATE})
    GROUP BY year
    ORDER BY year
  `);

  const postCutoffRows = await db.execute(sql`
    SELECT
      SUBSTRING(collection_date, 1, 4)::integer AS year,
      SUM(individual_sandwiches)::bigint AS individual,
      COUNT(*)::bigint AS record_count
    FROM sandwich_collections
    WHERE collection_date > ${AUTHORITATIVE_CUTOFF_DATE}
      AND deleted_at IS NULL
    GROUP BY SUBSTRING(collection_date, 1, 4)
  `);

  // Group sandwiches (JSONB + legacy columns) aren't summable in SQL, so load
  // post-cutoff rows and compute in JS. This mirrors the original route logic.
  const allCollections = await storage.getAllSandwichCollections();
  const postCutoffCollections = allCollections.filter(
    (c) => c.collectionDate && c.collectionDate > AUTHORITATIVE_CUTOFF_DATE && !c.deletedAt
  );

  const byYear: Record<number, YearlyTotal> = {};

  for (const row of authoritativeRows.rows as Array<{
    year: number | string;
    total_sandwiches: number | string;
    record_count: number | string;
  }>) {
    const year = Number(row.year);
    byYear[year] = {
      year,
      records: Number(row.record_count),
      sandwiches: Number(row.total_sandwiches),
      source: 'authoritative',
    };
  }

  for (const row of postCutoffRows.rows as Array<{
    year: number | string;
    individual: number | string | null;
    record_count: number | string;
  }>) {
    const year = Number(row.year);
    const individual = Number(row.individual ?? 0);
    const yearCollections = postCutoffCollections.filter(
      (c) => c.collectionDate && c.collectionDate.startsWith(String(year))
    );
    const groupTotal = sumGroupSandwiches(yearCollections);
    const addedSandwiches = individual + groupTotal;
    const addedRecords = Number(row.record_count);

    if (byYear[year]) {
      byYear[year].records += addedRecords;
      byYear[year].sandwiches += addedSandwiches;
      byYear[year].source = 'hybrid';
    } else {
      byYear[year] = {
        year,
        records: addedRecords,
        sandwiches: addedSandwiches,
        source: 'collection_log',
      };
    }
  }

  const total = Object.values(byYear).reduce((sum, y) => sum + y.sandwiches, 0);

  return {
    byYear,
    total,
    cutoffDate: AUTHORITATIVE_CUTOFF_DATE,
    description: `Hybrid stats: Authoritative weekly data (2020-2024, 2025 through ${AUTHORITATIVE_CUTOFF_DATE}) + Collection log (after ${AUTHORITATIVE_CUTOFF_DATE})`,
  };
}

/**
 * Compute seasonal patterns (weekly averages + top locations) from the
 * authoritative archive only. These figures are intentionally historical —
 * they're used to answer "which weeks of the year tend to be high/low"
 * rather than "what was the total this year."
 */
export async function getAuthoritativeSeasonalData(): Promise<AuthoritativeSeasonalData | null> {
  try {
    const { authoritativeWeeklyCollections } = await import('@shared/schema');
    const rows = await db.select().from(authoritativeWeeklyCollections);
    if (rows.length === 0) return null;

    const weeklyPatterns: Record<
      number,
      { totalSandwiches: number; weekCount: number; years: Set<number> }
    > = {};
    const locationTotals: Record<string, number> = {};

    for (const record of rows) {
      const week = record.weekOfYear;
      if (!weeklyPatterns[week]) {
        weeklyPatterns[week] = {
          totalSandwiches: 0,
          weekCount: 0,
          years: new Set(),
        };
      }
      weeklyPatterns[week].totalSandwiches += record.sandwiches;
      weeklyPatterns[week].weekCount += 1;
      weeklyPatterns[week].years.add(record.year);

      locationTotals[record.location] =
        (locationTotals[record.location] || 0) + record.sandwiches;
    }

    const weeklyAverages: WeeklySeasonalPattern[] = Object.entries(weeklyPatterns)
      .map(([week, data]) => ({
        week: parseInt(week, 10),
        avgSandwiches: Math.round(data.totalSandwiches / data.weekCount),
        yearsOfData: data.years.size,
      }))
      .sort((a, b) => a.week - b.week);

    const sortedByAvg = [...weeklyAverages].sort(
      (a, b) => a.avgSandwiches - b.avgSandwiches
    );

    const topLocations = Object.entries(locationTotals)
      .map(([location, sandwiches]) => ({ location, sandwiches }))
      .sort((a, b) => b.sandwiches - a.sandwiches)
      .slice(0, 15);

    return {
      weeklyAverages,
      lowWeeks: sortedByAvg.slice(0, 10),
      highWeeks: sortedByAvg.slice(-10).reverse(),
      topLocations,
    };
  } catch (err) {
    logger.warn('Could not load authoritative seasonal data', { error: err });
    return null;
  }
}
