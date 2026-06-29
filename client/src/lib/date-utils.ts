/**
 * Date utilities to handle timezone issues consistently across the application
 *
 * The main issue is that HTML date inputs and JavaScript Date objects
 * can cause timezone conversions that shift dates by one day.
 * These utilities ensure dates are handled consistently as local dates.
 *
 * IMPORTANT: All users of this app are in Eastern Time (America/New_York).
 * All date display functions should use this timezone explicitly.
 */

// Eastern Time Zone - all users of this app are in this timezone
export const APP_TIMEZONE = 'America/New_York';

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
 * Handles both date-only strings (YYYY-MM-DD) and full datetime strings (YYYY-MM-DD HH:MM:SS.microseconds)
 * Always uses Eastern Time (America/New_York) for consistent display.
 */
export function formatDateForDisplay(dateString: string): string {
  if (!dateString) return '';

  try {
    let date: Date;

    // Extract just the date portion (YYYY-MM-DD) from various formats
    // Handles: "2025-12-16", "2025-12-16 00:00:00", "2025-12-16T00:00:00", etc.
    const dateMatch = dateString.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      // Always parse at noon to avoid timezone boundary issues
      date = new Date(dateMatch[1] + 'T12:00:00');
    } else {
      // Fallback for other formats
      date = new Date(dateString);
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString; // Return original if parsing fails
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: APP_TIMEZONE,
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
 * Format wall-clock hours (0–23) as 12-hour display without timezone conversion.
 */
function formatWallClock12h(hours24: number, minutes: number): string {
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Format time string for display (12-hour format with AM/PM).
 *
 * Event times are stored as Eastern wall-clock strings (e.g. "3:00 PM", "15:00")
 * — not UTC instants. Parse the string directly; do not run through Date
 * timezone conversion (that turned "3:00 PM" into 3:00 AM on the volunteer hub).
 */
export function formatTimeForDisplay(timeString: string): string {
  if (!timeString || timeString === 'TBD') return 'TBD';

  const trimmed = timeString.trim();

  // H:MM[:SS] AM/PM — e.g. "3:00 PM", "2:30:00 PM"
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const ampm = ampmMatch[3].toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    if (hours > 23 || minutes > 59) return trimmed;
    return formatWallClock12h(hours, minutes);
  }

  // 24-hour HH:MM[:SS]
  const h24Match = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (h24Match) {
    const hours = parseInt(h24Match[1], 10);
    const minutes = parseInt(h24Match[2], 10);
    if (hours > 23 || minutes > 59) return trimmed;
    return formatWallClock12h(hours, minutes);
  }

  return trimmed;
}

/**
 * Format a date-only string (YYYY-MM-DD) for short display (e.g., "Wed, Dec 15")
 * ALWAYS use this for event dates to avoid the "day early" timezone bug.
 * 
 * The bug: `new Date("2024-12-15")` is parsed as UTC midnight, which shifts
 * to the previous day when displayed in Eastern time.
 * 
 * The fix: Parse with `T12:00:00` (noon) to avoid timezone boundary issues.
 */
export function formatDateShort(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return 'Date TBD';

  try {
    let date: Date;

    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'string') {
      // Extract just the date portion (YYYY-MM-DD) from various formats
      // Handles: "2025-12-16", "2025-12-16 00:00:00", "2025-12-16T00:00:00", etc.
      const dateMatch = dateValue.match(/^(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        // Always parse at noon to avoid timezone boundary issues
        date = new Date(dateMatch[1] + 'T12:00:00');
      } else {
        date = new Date(dateValue);
      }
    } else {
      return 'Date TBD';
    }

    if (isNaN(date.getTime())) return 'Date TBD';

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: APP_TIMEZONE,
    });
  } catch {
    return 'Date TBD';
  }
}

/**
 * Parse a server-supplied event-date value into a Date that represents the
 * intended calendar day in *local* time — never one day off.
 *
 * The bug this fixes: the DB stores event dates as `timestamp` (no tz), which
 * Drizzle serializes as e.g. "2026-05-26T00:00:00.000Z". Passing that to
 * `new Date()` / `parseISO()` and then formatting in Eastern shifts the day
 * to May 25. We pull out the YYYY-MM-DD portion and rebuild at noon local.
 *
 * Use this anywhere you would otherwise do `parseISO(eventDate)` or
 * `new Date(eventDate)` for a date-only field (scheduledEventDate,
 * desiredEventDate, etc.).
 */
export function parseEventDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    // If this Date was built from a UTC-midnight ISO string, its UTC parts
    // hold the intended calendar day. Rebuild as local noon.
    const y = value.getUTCFullYear();
    const m = value.getUTCMonth();
    const d = value.getUTCDate();
    return new Date(y, m, d, 12, 0, 0, 0);
  }
  if (typeof value !== 'string') return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]) - 1;
    const day = Number(m[3]);
    const out = new Date(year, month, day, 12, 0, 0, 0);
    return isNaN(out.getTime()) ? null : out;
  }
  const fallback = new Date(value);
  return isNaN(fallback.getTime()) ? null : fallback;
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
