import { parseCollectionDate } from '@/lib/analytics-utils';

/**
 * Calculate the start of the week (Friday) for a given date.
 * The week is defined as Friday to Thursday.
 * For example, if the input date is a Sunday, the function returns the previous Friday.
 *
 * @param {Date} date - The reference date.
 * @returns {Date} The Friday at the start of the week.
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  
  // JavaScript's getDay() returns 0=Sunday, 1=Monday, ..., 6=Saturday.
  // To get the number of days since the most recent Friday (0=Friday, 1=Saturday, ..., 6=Thursday),
  // we use a lookup array: [2, 3, 4, 5, 6, 0, 1][dayOfWeek]
  // Mapping:
  //   Sunday    (0) -> 2 (Friday is 2 days before)
  //   Monday    (1) -> 3
  //   Tuesday   (2) -> 4
  //   Wednesday (3) -> 5
  //   Thursday  (4) -> 6
  //   Friday    (5) -> 0 (already Friday)
  //   Saturday  (6) -> 1
  const daysFromFriday = [2, 3, 4, 5, 6, 0, 1][dayOfWeek];
  
  d.setDate(d.getDate() - daysFromFriday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calculate Wednesday vs special placement totals from collections and events
 * 
 * @param collections - Array of collections to process
 * @param events - Array of events to process
 * @param today - Reference date for filtering
 * @returns Object containing wednesdayTotal and specialPlacementTotal
 */
export function calculatePlacementTotals(
  collections: Array<{
    collectionDate: string;
    groupCollections?: Array<{
      sandwichCount: number;
    }>;
  }>,
  events: Array<{
    desiredEventDate: string;
    estimatedSandwichCount: number;
  }>,
  today: Date
): { wednesdayTotal: number; specialPlacementTotal: number } {
  let wednesdayTotal = 0;
  let specialPlacementTotal = 0;

  collections.forEach((c) => {
    const date = parseCollectionDate(c.collectionDate);
    const groupTotal = (Array.isArray(c.groupCollections) ? c.groupCollections : [])
      .reduce((gsum, g) => gsum + (g.sandwichCount || 0), 0);

    if (date.getDay() === 3) { // Wednesday
      wednesdayTotal += groupTotal;
    } else {
      specialPlacementTotal += groupTotal;
    }
  });

  events.forEach((event) => {
    const eventDate = new Date(event.desiredEventDate);
    const eventTotal = event.estimatedSandwichCount || 0;

    if (eventDate.getDay() === 3) { // Wednesday
      wednesdayTotal += eventTotal;
    } else {
      specialPlacementTotal += eventTotal;
    }
  });

  return { wednesdayTotal, specialPlacementTotal };
}
