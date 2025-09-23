import type { SandwichCollection } from '@shared/schema';

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
      console.log('Error parsing groupCollections JSON:', e);
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
 * Calculate weekly data buckets from collections for accurate weekly analytics
 */
export function calculateWeeklyData(collections: SandwichCollection[]): Array<{
  weekStartDate: string;
  weekLabel: string;
  totalSandwiches: number;
  totalCollections: number;
  uniqueHosts: number;
}> {
  const weeklyData: Record<
    string,
    {
      weekStartDate: string;
      weekLabel: string;
      totalSandwiches: number;
      totalCollections: number;
      hosts: Set<string>;
    }
  > = {};

  collections.forEach((collection) => {
    if (!collection.collectionDate) return;

    const date = parseCollectionDate(collection.collectionDate);

    // Calculate week start (Monday)
    const weekStart = new Date(date);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
    weekStart.setDate(diff);

    const weekKey = weekStart.toISOString().split('T')[0]; // YYYY-MM-DD format
    const weekLabel = `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = {
        weekStartDate: weekKey,
        weekLabel,
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
      ...week,
      uniqueHosts: week.hosts.size,
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
 * Calculate actual average weekly sandwiches from collections data
 */
export function calculateActualWeeklyAverage(
  collections: SandwichCollection[]
): number {
  const weeklyData = calculateWeeklyData(collections);

  if (weeklyData.length === 0) return 0;

  const totalSandwiches = weeklyData.reduce(
    (sum, week) => sum + week.totalSandwiches,
    0
  );
  return Math.round(totalSandwiches / weeklyData.length);
}
