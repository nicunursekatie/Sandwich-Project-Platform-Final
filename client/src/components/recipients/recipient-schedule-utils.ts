import { getRegionFromCoordinates, getRecipientDisplayRegion } from '@/lib/atlanta-regions';
import { normalizeFocusArea } from '@/lib/focus-area-groups';
import type { Recipient } from '@shared/schema';

export const WEEK_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export const DAY_ABBREV: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

export type ScheduleEntry = { day: string; time: string; notes?: string };

export type SortColumn =
  | 'name'
  | 'status'
  | 'focusArea'
  | 'region'
  | 'collectionDays'
  | 'feedingDays'
  | 'estimatedSandwiches'
  | 'sandwichType'
  | 'primaryContact'
  | 'tspContact'
  | 'contract'
  | 'reportingGroup';

export type SortDirection = 'asc' | 'desc';

export function extractDaysFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  return WEEK_DAYS.filter((d) => lower.includes(d.toLowerCase()));
}

export function getCollectionSchedules(recipient: Recipient): ScheduleEntry[] {
  const schedules = (recipient as Recipient & { collectionSchedules?: ScheduleEntry[] }).collectionSchedules;
  if (Array.isArray(schedules) && schedules.length > 0) return schedules;
  if (recipient.collectionDay || recipient.collectionTime) {
    return [{ day: recipient.collectionDay || '', time: recipient.collectionTime || '' }];
  }
  return [];
}

export function getFeedingSchedules(recipient: Recipient): ScheduleEntry[] {
  const schedules = (recipient as Recipient & { feedingSchedules?: ScheduleEntry[] }).feedingSchedules;
  if (Array.isArray(schedules) && schedules.length > 0) return schedules;
  if (recipient.feedingDay || recipient.feedingTime) {
    return [{ day: recipient.feedingDay || '', time: recipient.feedingTime || '' }];
  }
  return [];
}

export function getRecipientCollectionDays(recipient: Recipient): string[] {
  const days = new Set<string>();
  for (const s of getCollectionSchedules(recipient)) {
    for (const d of extractDaysFromText(s.day)) days.add(d);
  }
  for (const d of extractDaysFromText(recipient.collectionDay)) days.add(d);
  return Array.from(days);
}

export function getRecipientFeedingDays(recipient: Recipient): string[] {
  const days = new Set<string>();
  for (const s of getFeedingSchedules(recipient)) {
    for (const d of extractDaysFromText(s.day)) days.add(d);
  }
  for (const d of extractDaysFromText(recipient.feedingDay)) days.add(d);
  return Array.from(days);
}

/** Map weekday → tooltip lines (time + notes) for schedule chips. */
export function getScheduleDayDetails(schedules: ScheduleEntry[]): Map<string, string[]> {
  const details = new Map<string, string[]>();

  for (const entry of schedules) {
    const matchedDays = extractDaysFromText(entry.day);
    const targets = matchedDays.length > 0 ? matchedDays : entry.day ? [entry.day] : [];

    for (const day of targets) {
      const canonical = WEEK_DAYS.find((d) => d.toLowerCase() === day.toLowerCase()) || day;
      const line = [entry.time, entry.notes].filter(Boolean).join(' · ') || entry.day || 'Scheduled';
      const existing = details.get(canonical) || [];
      if (!existing.includes(line)) existing.push(line);
      details.set(canonical, existing);
    }
  }

  return details;
}

export function earliestDayIndex(days: string[]): number {
  if (!days.length) return Infinity;
  let min = Infinity;
  for (const d of days) {
    const i = WEEK_DAYS.indexOf(d as (typeof WEEK_DAYS)[number]);
    if (i !== -1 && i < min) min = i;
  }
  return min;
}

export function getFocusAreas(recipient: Recipient): string[] {
  const rawAreas =
    Array.isArray((recipient as Recipient & { focusAreas?: string[] }).focusAreas) &&
    (recipient as Recipient & { focusAreas?: string[] }).focusAreas!.length > 0
      ? (recipient as Recipient & { focusAreas?: string[] }).focusAreas!
      : recipient.focusArea
        ? [recipient.focusArea]
        : [];
  return [...new Set(rawAreas.map((a) => normalizeFocusArea(a)).filter(Boolean))];
}

export function getRecipientRegion(recipient: Recipient): string {
  return getRecipientDisplayRegion(recipient) ||
    (recipient.latitude && recipient.longitude
      ? getRegionFromCoordinates(recipient.latitude, recipient.longitude)
      : 'Not geocoded');
}

export function getEstimatedSandwiches(recipient: Recipient): number | null {
  return recipient.weeklyEstimate ?? recipient.estimatedSandwiches ?? null;
}

export type ContractStatus = 'signed' | 'pending' | 'none';

export function getContractStatus(recipient: Recipient): ContractStatus {
  if (recipient.contractSigned) return 'signed';
  if (recipient.status === 'inactive') return 'none';
  return 'pending';
}

export function getPrimaryContactName(recipient: Recipient): string {
  return recipient.contactPersonName || recipient.contactName || '';
}

export function sortRecipients(
  list: Recipient[],
  column: SortColumn,
  direction: SortDirection
): Recipient[] {
  const sorted = [...list];
  const factor = direction === 'asc' ? 1 : -1;

  const compareStrings = (a: string, b: string) => (a || '').localeCompare(b || '') * factor;
  const compareNumbers = (a: number, b: number) => (a - b) * factor;

  sorted.sort((a, b) => {
    switch (column) {
      case 'name':
        return compareStrings(a.name || '', b.name || '');
      case 'status':
        return compareStrings(a.status || '', b.status || '');
      case 'focusArea':
        return compareStrings(getFocusAreas(a).join(', '), getFocusAreas(b).join(', '));
      case 'region':
        return compareStrings(getRecipientRegion(a), getRecipientRegion(b));
      case 'collectionDays': {
        const da = earliestDayIndex(getRecipientCollectionDays(a));
        const db = earliestDayIndex(getRecipientCollectionDays(b));
        if (da !== db) return compareNumbers(da, db);
        return compareStrings(a.name || '', b.name || '');
      }
      case 'feedingDays': {
        const da = earliestDayIndex(getRecipientFeedingDays(a));
        const db = earliestDayIndex(getRecipientFeedingDays(b));
        if (da !== db) return compareNumbers(da, db);
        return compareStrings(a.name || '', b.name || '');
      }
      case 'estimatedSandwiches': {
        const ea = getEstimatedSandwiches(a) ?? -1;
        const eb = getEstimatedSandwiches(b) ?? -1;
        if (ea !== eb) return compareNumbers(ea, eb);
        return compareStrings(a.name || '', b.name || '');
      }
      case 'sandwichType':
        return compareStrings(a.sandwichType || '', b.sandwichType || '');
      case 'primaryContact':
        return compareStrings(getPrimaryContactName(a), getPrimaryContactName(b));
      case 'tspContact':
        return compareStrings(a.tspContact || '', b.tspContact || '');
      case 'contract': {
        const order = { signed: 0, pending: 1, none: 2 };
        const ca = order[getContractStatus(a)];
        const cb = order[getContractStatus(b)];
        if (ca !== cb) return compareNumbers(ca, cb);
        return compareStrings(a.name || '', b.name || '');
      }
      case 'reportingGroup':
        return compareStrings(a.reportingGroup || '', b.reportingGroup || '');
      default:
        return compareStrings(a.name || '', b.name || '');
    }
  });

  return sorted;
}

export const RECIPIENT_FOCUS_AREAS = [
  'Youth',
  'Veterans',
  'Seniors',
  'Families',
  'Unhoused',
  'Refugees',
  'Disabilities',
  'Other',
] as const;

export type WeeklyScheduleBuckets = {
  collection: Record<string, Recipient[]>;
  feeding: Record<string, Recipient[]>;
  collectionUnscheduled: Recipient[];
  feedingUnscheduled: Recipient[];
};

function emptyDayBuckets(): Record<string, Recipient[]> {
  return {
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: [],
  };
}

/** Bucket recipients into collection + feeding day columns for the weekly calendar. */
export function buildWeeklyScheduleBuckets(recipients: Recipient[]): WeeklyScheduleBuckets {
  const collection = emptyDayBuckets();
  const feeding = emptyDayBuckets();
  const collectionUnscheduled: Recipient[] = [];
  const feedingUnscheduled: Recipient[] = [];

  for (const recipient of recipients) {
    const collectionDays = getRecipientCollectionDays(recipient);
    const feedingDays = getRecipientFeedingDays(recipient);

    if (collectionDays.length === 0) {
      collectionUnscheduled.push(recipient);
    } else {
      for (const day of collectionDays) {
        if (collection[day]) collection[day].push(recipient);
      }
    }

    if (feedingDays.length === 0) {
      feedingUnscheduled.push(recipient);
    } else {
      for (const day of feedingDays) {
        if (feeding[day]) feeding[day].push(recipient);
      }
    }
  }

  return { collection, feeding, collectionUnscheduled, feedingUnscheduled };
}

/** Time string for a specific weekday within a schedule list. */
export function getTimeForDayOnSchedule(
  schedules: ScheduleEntry[],
  day: string
): string | undefined {
  for (const entry of schedules) {
    const matchedDays = extractDaysFromText(entry.day);
    if (matchedDays.includes(day)) {
      return entry.time || undefined;
    }
  }
  return undefined;
}

/** Build schedule array from day chip selection + time (table inline edit). */
export function buildScheduleFromDaysAndTime(
  days: string[],
  time: string
): ScheduleEntry[] {
  const sortedDays = [...days].sort(
    (a, b) =>
      WEEK_DAYS.indexOf(a as (typeof WEEK_DAYS)[number]) -
      WEEK_DAYS.indexOf(b as (typeof WEEK_DAYS)[number])
  );
  if (sortedDays.length === 0 && !time.trim()) return [];
  return [{ day: sortedDays.join(', '), time: time.trim() }];
}

/** Parse existing schedules into selected weekdays + shared time for inline editor. */
export function parseScheduleForInlineEdit(schedules: ScheduleEntry[]): {
  days: string[];
  time: string;
} {
  const days = new Set<string>();
  let time = '';
  for (const entry of schedules) {
    for (const d of extractDaysFromText(entry.day)) days.add(d);
    if (!time && entry.time) time = entry.time;
  }
  const sorted = WEEK_DAYS.filter((d) => days.has(d));
  return { days: sorted, time };
}
