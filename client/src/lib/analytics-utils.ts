import type { SandwichCollection } from '@shared/schema';
import { logger } from '@/lib/logger';

/**
 * Parse a collection date string and ensure YYYY-MM-DD values are treated as local time.
 */
export function parseCollectionDate(dateStr: string): Date {
  if (!dateStr) {
    return new Date(NaN);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(`${dateStr}T00:00:00`);
  }

  return new Date(dateStr);
}

/**
 * Standardized group sandwiches calculation for consistent analytics across all components.
 * This function ensures all frontend components use the same logic as the backend stats endpoint.
 *
 * Priority:
 * 1. Use groupCollections JSONB array if available and non-empty
 * 2. Fallback to legacy group1Count + group2Count for older records
 */
export function calculateGroupSandwiches(
  collection: SandwichCollection
): number {
  // Primary: Use groupCollections JSONB array if available and non-empty
  if (
    collection.groupCollections &&
    Array.isArray(collection.groupCollections) &&
    collection.groupCollections.length > 0
  ) {
    return collection.groupCollections.reduce((sum, group) => {
      // Handle both 'count' and 'sandwichCount' field names for backward compatibility
      const count = Number(group.count || (group as any).sandwichCount || 0);
      return sum + count;
    }, 0);
  }

  // Handle string-encoded JSON (if data comes from API as string)
  if (
    collection.groupCollections &&
    typeof collection.groupCollections === 'string' &&
    collection.groupCollections !== '' &&
    collection.groupCollections !== '[]'
  ) {
    try {
      const groupData = JSON.parse(collection.groupCollections);
      if (Array.isArray(groupData) && groupData.length > 0) {
        return groupData.reduce((sum, group) => {
          const count = Number(group.count || group.sandwichCount || 0);
          return sum + count;
        }, 0);
      }
    } catch (e) {
      logger.log('Error parsing groupCollections JSON:', e);
      // Fall through to legacy calculation
    }
  }

  // Fallback: Use legacy group1Count + group2Count for older records
  const group1Count = Number((collection as any).group1Count || 0);
  const group2Count = Number((collection as any).group2Count || 0);
  return group1Count + group2Count;
}

/**
 * Calculate total sandwiches (individual + group) for a collection
 */
export function calculateTotalSandwiches(
  collection: SandwichCollection
): number {
  const individual = Number(collection.individualSandwiches || 0);
  const group = calculateGroupSandwiches(collection);
  return individual + group;
}

/**
 * Calculate the Friday start of the week for a given date.
 * Weeks run Friday to Thursday (with Thursday being distribution day).
 *
 * @param date - Any date within the week
 * @returns The Friday that starts that week
 */
export function getWeekStartFriday(date: Date): Date {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);

  const day = weekStart.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat

  // Calculate days to subtract to get to the previous or current Friday
  // Friday=0 days, Saturday=1 day, Sunday=2 days, Monday=3 days, ..., Thursday=6 days
  const daysFromFriday = (day + 2) % 7; // Convert to days since last Friday

  weekStart.setDate(weekStart.getDate() - daysFromFriday);
  return weekStart;
}

/**
 * Calculate the Thursday end of the week for a given Friday start date.
 *
 * @param fridayStart - The Friday start of the week
 * @returns The Thursday that ends that week
 */
export function getWeekEndThursday(fridayStart: Date): Date {
  const weekEnd = new Date(fridayStart);
  weekEnd.setDate(weekEnd.getDate() + 6); // Friday + 6 days = Thursday
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}

/**
 * Check if a week is complete (we've passed Thursday).
 *
 * @param fridayStart - The Friday start of the week
 * @param referenceDate - The current date (defaults to now)
 * @returns true if the week is complete (past Thursday), false if in progress
 */
export function isWeekComplete(fridayStart: Date, referenceDate: Date = new Date()): boolean {
  const thursday = getWeekEndThursday(fridayStart);
  return referenceDate > thursday;
}

/**
 * Calculate weekly data buckets from collections for accurate weekly analytics.
 * Weeks run Friday to Thursday (with Thursday being distribution day).
 */
export function calculateWeeklyData(collections: SandwichCollection[]): Array<{
  weekStartDate: string;
  weekEndDate: string;
  weekLabel: string;
  totalSandwiches: number;
  totalCollections: number;
  uniqueHosts: number;
  isComplete: boolean;
}> {
  const weeklyData: Record<
    string,
    {
      weekStartDate: string;
      weekEndDate: string;
      weekLabel: string;
      fridayStart: Date;
      totalSandwiches: number;
      totalCollections: number;
      hosts: Set<string>;
    }
  > = {};

  collections.forEach((collection) => {
    if (!collection.collectionDate) return;

    const date = parseCollectionDate(collection.collectionDate);

    // Calculate week start (Friday)
    const fridayStart = getWeekStartFriday(date);
    const thursdayEnd = getWeekEndThursday(fridayStart);

    const weekKey = fridayStart.toISOString().split('T')[0]; // YYYY-MM-DD format
    const weekLabel = `${fridayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${thursdayEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = {
        weekStartDate: weekKey,
        weekEndDate: thursdayEnd.toISOString().split('T')[0],
        weekLabel,
        fridayStart,
        totalSandwiches: 0,
        totalCollections: 0,
        hosts: new Set(),
      };
    }

    const totalSandwiches = calculateTotalSandwiches(collection);
    weeklyData[weekKey].totalSandwiches += totalSandwiches;
    weeklyData[weekKey].totalCollections += 1;

    if (collection.hostName) {
      weeklyData[weekKey].hosts.add(collection.hostName);
    }
  });

  return Object.values(weeklyData)
    .map((week) => ({
      weekStartDate: week.weekStartDate,
      weekEndDate: week.weekEndDate,
      weekLabel: week.weekLabel,
      totalSandwiches: week.totalSandwiches,
      totalCollections: week.totalCollections,
      uniqueHosts: week.hosts.size,
      isComplete: isWeekComplete(week.fridayStart),
    }))
    .sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
}

/**
 * Get the record week (best performing week) from collections data
 */
export function getRecordWeek(collections: SandwichCollection[]): {
  total: number;
  weekLabel: string;
} {
  const weeklyData = calculateWeeklyData(collections);

  if (weeklyData.length === 0) {
    return { total: 0, weekLabel: 'No data' };
  }

  const recordWeek = weeklyData.reduce((best, week) =>
    week.totalSandwiches > best.totalSandwiches ? week : best
  );

  return {
    total: recordWeek.totalSandwiches,
    weekLabel: recordWeek.weekLabel,
  };
}

/**
 * Calculate actual average weekly sandwiches from collections data.
 * Only includes complete weeks (past Thursday) to avoid skewing the average.
 */
export function calculateActualWeeklyAverage(
  collections: SandwichCollection[]
): number {
  const weeklyData = calculateWeeklyData(collections);

  // Filter to only complete weeks to avoid skewing average with partial data
  const completeWeeks = weeklyData.filter(week => week.isComplete);

  if (completeWeeks.length === 0) return 0;

  const totalSandwiches = completeWeeks.reduce(
    (sum, week) => sum + week.totalSandwiches,
    0
  );
  return Math.round(totalSandwiches / completeWeeks.length);
}

// ============================================================================
// SANDWICH TYPE BREAKDOWN FUNCTIONS
// ============================================================================

/**
 * Type breakdown structure for sandwich analytics
 */
export interface TypeBreakdown {
  deli: number;
  turkey: number;
  ham: number;
  pbj: number;
  total: number;
}

/**
 * Calculate individual sandwich type breakdown for a collection.
 * 
 * Returns breakdown of individual sandwiches by type (deli, turkey, ham, pbj).
 * Backward compatible - returns zeros if type data is not available.
 * 
 * @param collection - Sandwich collection to analyze
 * @returns Type breakdown with deli, turkey, ham, pbj counts and total
 */
export function calculateIndividualTypeBreakdown(
  collection: SandwichCollection
): TypeBreakdown {
  const deli = Number(collection.individualDeli || 0);
  const turkey = Number(collection.individualTurkey || 0);
  const ham = Number(collection.individualHam || 0);
  const pbj = Number(collection.individualPbj || 0);
  
  return {
    deli,
    turkey,
    ham,
    pbj,
    total: deli + turkey + ham + pbj,
  };
}

/**
 * Calculate group sandwich type breakdown for a collection.
 * 
 * Aggregates type data from all groups in the collection's groupCollections array.
 * Backward compatible - returns zeros if type data is not available.
 * 
 * @param collection - Sandwich collection to analyze
 * @returns Type breakdown with deli, turkey, ham, pbj counts and total
 */
export function calculateGroupTypeBreakdown(
  collection: SandwichCollection
): TypeBreakdown {
  let deli = 0;
  let turkey = 0;
  let ham = 0;
  let pbj = 0;

  // Primary: Use groupCollections JSONB array if available and non-empty
  if (
    collection.groupCollections &&
    Array.isArray(collection.groupCollections) &&
    collection.groupCollections.length > 0
  ) {
    collection.groupCollections.forEach((group) => {
      deli += Number(group.deli || 0);
      turkey += Number(group.turkey || 0);
      ham += Number(group.ham || 0);
      pbj += Number(group.pbj || 0);
    });
    
    return {
      deli,
      turkey,
      ham,
      pbj,
      total: deli + turkey + ham + pbj,
    };
  }

  // Handle string-encoded JSON (if data comes from API as string)
  if (
    collection.groupCollections &&
    typeof collection.groupCollections === 'string' &&
    collection.groupCollections !== '' &&
    collection.groupCollections !== '[]'
  ) {
    try {
      const groupData = JSON.parse(collection.groupCollections);
      if (Array.isArray(groupData) && groupData.length > 0) {
        groupData.forEach((group) => {
          deli += Number(group.deli || 0);
          turkey += Number(group.turkey || 0);
          ham += Number(group.ham || 0);
          pbj += Number(group.pbj || 0);
        });
      }
    } catch (e) {
      logger.log('Error parsing groupCollections JSON for type breakdown:', e);
      // Return zeros on error
    }
  }

  return {
    deli,
    turkey,
    ham,
    pbj,
    total: deli + turkey + ham + pbj,
  };
}

/**
 * Calculate total sandwich type breakdown for a collection.
 * 
 * Combines individual and group type data to provide complete breakdown.
 * Backward compatible - returns zeros if type data is not available.
 * 
 * @param collection - Sandwich collection to analyze
 * @returns Type breakdown with combined deli, turkey, ham, pbj counts and total
 */
export function calculateTotalTypeBreakdown(
  collection: SandwichCollection
): TypeBreakdown {
  const individualBreakdown = calculateIndividualTypeBreakdown(collection);
  const groupBreakdown = calculateGroupTypeBreakdown(collection);

  return {
    deli: individualBreakdown.deli + groupBreakdown.deli,
    turkey: individualBreakdown.turkey + groupBreakdown.turkey,
    ham: individualBreakdown.ham + groupBreakdown.ham,
    pbj: individualBreakdown.pbj + groupBreakdown.pbj,
    total: individualBreakdown.total + groupBreakdown.total,
  };
}

/**
 * Aggregate sandwich type breakdown across multiple collections.
 * 
 * Sums type data across all collections in the dataset to provide organization-wide totals.
 * Backward compatible - handles collections without type data gracefully.
 * 
 * @param collections - Array of sandwich collections to aggregate
 * @returns Type breakdown with total deli, turkey, ham, pbj counts across all collections
 */
export function aggregateTypeBreakdownAcrossCollections(
  collections: SandwichCollection[]
): TypeBreakdown {
  let totalDeli = 0;
  let totalTurkey = 0;
  let totalHam = 0;
  let totalPbj = 0;

  collections.forEach((collection) => {
    const breakdown = calculateTotalTypeBreakdown(collection);
    totalDeli += breakdown.deli;
    totalTurkey += breakdown.turkey;
    totalHam += breakdown.ham;
    totalPbj += breakdown.pbj;
  });

  return {
    deli: totalDeli,
    turkey: totalTurkey,
    ham: totalHam,
    pbj: totalPbj,
    total: totalDeli + totalTurkey + totalHam + totalPbj,
  };
}
