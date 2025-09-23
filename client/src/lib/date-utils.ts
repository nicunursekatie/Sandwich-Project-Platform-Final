/**
 * Date utilities to handle timezone issues consistently across the application
 *
 * The main issue is that HTML date inputs and JavaScript Date objects
 * can cause timezone conversions that shift dates by one day.
 * These utilities ensure dates are handled consistently as local dates.
 */

/**
 * Format a date string (YYYY-MM-DD) for HTML date input
 * This prevents timezone conversion issues by treating the date as local
 */
export function formatDateForInput(dateString: string): string {
  if (!dateString) return '';

  // If already in YYYY-MM-DD format, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return dateString;
  }

  // Parse the date as a local date to avoid timezone conversion
  const date = new Date(dateString + 'T12:00:00'); // Add noon time to avoid edge cases

  // Format as YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Format a date string for display purposes
 * Returns a user-friendly formatted date
 */
export function formatDateForDisplay(dateString: string): string {
  if (!dateString) return '';

  try {
    // Parse as local date to avoid timezone issues
    const date = new Date(dateString + 'T12:00:00');

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString; // Return original if parsing fails
  }
}

/**
 * Convert HTML date input value to consistent YYYY-MM-DD string
 * This ensures the date is stored consistently regardless of timezone
 */
export function normalizeDate(dateInputValue: string): string {
  if (!dateInputValue) return '';

  // HTML date inputs already provide YYYY-MM-DD format
  // But we ensure it's valid and consistent
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateInputValue)) {
    return dateInputValue;
  }

  // If somehow we get a different format, normalize it
  try {
    const date = new Date(dateInputValue + 'T12:00:00');
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch {
    return dateInputValue; // Return original if parsing fails
  }
}

/**
 * Check if a date is in the past (for meeting status)
 * Meetings stay as "current" for 3 hours after their scheduled time
 * Compares dates as local dates to avoid timezone issues
 */
export function isDateInPast(dateString: string, timeString?: string): boolean {
  if (!dateString) return false;

  try {
    // Use current date at start of day for comparison
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Parse meeting date as local date
    const meetingDate = new Date(dateString + 'T12:00:00');
    const meetingDateOnly = new Date(
      meetingDate.getFullYear(),
      meetingDate.getMonth(),
      meetingDate.getDate()
    );

    // If we have time and it's today, check time too with buffer
    if (timeString && meetingDateOnly.getTime() === today.getTime()) {
      const [hours, minutes] = timeString.split(':').map(Number);
      const meetingDateTime = new Date(
        meetingDate.getFullYear(),
        meetingDate.getMonth(),
        meetingDate.getDate(),
        hours,
        minutes
      );

      // Add 3-hour buffer - meeting stays "current" for 3 hours after start time
      const meetingEndTime = new Date(meetingDateTime.getTime() + (3 * 60 * 60 * 1000));
      return meetingEndTime < now;
    }

    // For dates without times, consider them past only after the day ends
    // Add one day buffer for meetings without specific times
    const dayAfterMeeting = new Date(meetingDateOnly.getTime() + (24 * 60 * 60 * 1000));
    return dayAfterMeeting < today;
  } catch {
    return false;
  }
}

/**
 * Get today's date in YYYY-MM-DD format for default values
 */
export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Format time string for display (12-hour format with AM/PM)
 */
export function formatTimeForDisplay(timeString: string): string {
  if (!timeString || timeString === 'TBD') return 'TBD';

  try {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));

    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return timeString;
  }
}

export type DateLike = string | Date | null | undefined;

/**
 * Parse collection dates without timezone drift.
 * HTML date inputs (YYYY-MM-DD) are treated as local dates so that
 * month boundaries remain stable regardless of server timezone.
 */
export function parseCollectionDate(dateInput: DateLike): Date | null {
  if (!dateInput) return null;

  if (dateInput instanceof Date) {
    const timestamp = dateInput.getTime();
    return Number.isNaN(timestamp) ? null : new Date(timestamp);
  }

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (trimmed === '') return null;

    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const [, yearStr, monthStr, dayStr] = isoMatch;
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1;
      const day = Number(dayStr);
      const parsed = new Date(year, monthIndex, day);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

/**
 * Convert a collection date into a YYYY-MM month key.
 */
export function getCollectionMonthKey(dateInput: DateLike): string | null {
  const parsed = parseCollectionDate(dateInput);
  if (!parsed) return null;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export interface MonthlyAggregation<T> {
  total: number;
  count: number;
  items: T[];
}

interface AggregateOptions<T> {
  getDate?: (item: T) => DateLike;
  getValue?: (item: T) => number;
}

/**
 * Aggregate arbitrary records by month using collection dates.
 */
export function aggregateCollectionsByMonth<T>(
  items: T[],
  options: AggregateOptions<T> = {}
): Record<string, MonthlyAggregation<T>> {
  const getDate = options.getDate ?? ((item: any) => item?.collectionDate);
  const getValue = options.getValue ?? (() => 1);

  const result: Record<string, MonthlyAggregation<T>> = {};

  for (const item of items) {
    const monthKey = getCollectionMonthKey(getDate(item));
    if (!monthKey) continue;

    const numericValue = Number(getValue(item)) || 0;

    if (!result[monthKey]) {
      result[monthKey] = { total: 0, count: 0, items: [] };
    }

    result[monthKey].total += numericValue;
    result[monthKey].count += 1;
    result[monthKey].items.push(item);
  }

  return result;
}
