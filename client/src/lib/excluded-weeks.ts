/**
 * Excluded Weeks Utility (Client-side)
 *
 * Determines which collection weeks should be excluded from statistics.
 * Collection weeks run Wednesday to Tuesday.
 *
 * Excluded weeks include:
 * - Thanksgiving week (4th Thursday of November - ALWAYS excluded)
 * - Weeks where major holidays fall on Wednesday or Thursday
 */

// Format a Date as YYYY-MM-DD (local time)
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Parse a YYYY-MM-DD string as local date
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get the Wednesday that starts the collection week containing a given date.
 * Collection weeks run Wednesday (day 3) to Tuesday (day 2).
 */
export function getWednesdayOfWeek(date: Date): Date {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 3 = Wednesday
  const daysFromWednesday = (dayOfWeek + 4) % 7; // Days since last Wednesday
  const wednesday = new Date(date);
  wednesday.setDate(date.getDate() - daysFromWednesday);
  return wednesday;
}

/**
 * Calculate Thanksgiving (4th Thursday of November) for a given year
 */
function calculateThanksgiving(year: number): Date {
  // November 1st
  const nov1 = new Date(year, 10, 1);
  const dayOfWeek = nov1.getDay();

  // Days until first Thursday
  let daysToFirstThursday = (4 - dayOfWeek + 7) % 7;
  if (daysToFirstThursday === 0 && dayOfWeek !== 4) {
    daysToFirstThursday = 7;
  }

  // 4th Thursday = first Thursday + 21 days
  const thanksgiving = new Date(year, 10, 1 + daysToFirstThursday + 21);
  return thanksgiving;
}

/**
 * Major holidays that, if they fall on Wednesday or Thursday,
 * mean we don't collect that week
 */
const CONDITIONAL_HOLIDAYS = [
  { month: 1, day: 1, name: "New Year's Day" },
  { month: 7, day: 4, name: 'Independence Day' },
  { month: 12, day: 25, name: 'Christmas Day' },
];

/**
 * Get the Wednesday of Thanksgiving week for a given year
 */
export function getThanksgivingWeekWednesday(year: number): string {
  const thanksgiving = calculateThanksgiving(year);
  // Thanksgiving is Thursday, so Wednesday is 1 day before
  const wednesday = new Date(thanksgiving);
  wednesday.setDate(thanksgiving.getDate() - 1);
  return formatDate(wednesday);
}

/**
 * Check if a holiday falls on Wednesday (3) or Thursday (4)
 */
function holidayFallsOnWedOrThu(year: number, month: number, day: number): boolean {
  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();
  return dayOfWeek === 3 || dayOfWeek === 4;
}

/**
 * Get all excluded week Wednesdays for a given year.
 * Returns array of YYYY-MM-DD strings representing the Wednesday of each excluded week.
 */
export function getExcludedWeeksForYear(year: number): Array<{ wednesday: string; reason: string }> {
  const excludedWeeks: Array<{ wednesday: string; reason: string }> = [];

  // Thanksgiving week is ALWAYS excluded
  excludedWeeks.push({
    wednesday: getThanksgivingWeekWednesday(year),
    reason: 'Thanksgiving week',
  });

  // Check conditional holidays
  for (const holiday of CONDITIONAL_HOLIDAYS) {
    if (holidayFallsOnWedOrThu(year, holiday.month, holiday.day)) {
      const holidayDate = new Date(year, holiday.month - 1, holiday.day);
      const wednesday = getWednesdayOfWeek(holidayDate);
      const wednesdayStr = formatDate(wednesday);

      // Don't add duplicates
      if (!excludedWeeks.some((w) => w.wednesday === wednesdayStr)) {
        excludedWeeks.push({
          wednesday: wednesdayStr,
          reason: `${holiday.name} falls on ${holidayDate.toLocaleDateString('en-US', { weekday: 'long' })}`,
        });
      }
    }
  }

  return excludedWeeks;
}

/**
 * Check if a specific date falls within an excluded collection week.
 * The date can be any day - we'll find which collection week it belongs to.
 */
export function isInExcludedWeek(dateStr: string): { excluded: boolean; reason?: string } {
  const date = parseDate(dateStr);
  const year = date.getFullYear();
  const wednesday = getWednesdayOfWeek(date);
  const wednesdayStr = formatDate(wednesday);

  const excludedWeeks = getExcludedWeeksForYear(year);
  const match = excludedWeeks.find((w) => w.wednesday === wednesdayStr);

  if (match) {
    return { excluded: true, reason: match.reason };
  }

  return { excluded: false };
}

/**
 * Check if a Date object falls within an excluded collection week.
 */
export function isDateInExcludedWeek(date: Date): { excluded: boolean; reason?: string } {
  return isInExcludedWeek(formatDate(date));
}

/**
 * Get all excluded week Wednesdays for a date range.
 */
export function getExcludedWeeksInRange(startDate: string, endDate: string): string[] {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  const allExcludedWeeks: string[] = [];

  for (let year = startYear; year <= endYear; year++) {
    const yearExclusions = getExcludedWeeksForYear(year);
    for (const exclusion of yearExclusions) {
      const wednesdayDate = parseDate(exclusion.wednesday);
      if (wednesdayDate >= start && wednesdayDate <= end) {
        allExcludedWeeks.push(exclusion.wednesday);
      }
    }
  }

  return allExcludedWeeks;
}

/**
 * Filter an array of items with dates to exclude no-collection weeks.
 * Works with any object that has a date field.
 */
export function filterExcludedWeeks<T>(
  items: T[],
  getDate: (item: T) => string | Date
): T[] {
  return items.filter((item) => {
    const date = getDate(item);
    const dateStr = typeof date === 'string' ? date : formatDate(date);
    return !isInExcludedWeek(dateStr).excluded;
  });
}
