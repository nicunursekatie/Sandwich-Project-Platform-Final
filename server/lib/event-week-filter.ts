import { parseDateOnly, getTodayString } from '@shared/date-utils';
import { getEffectiveEventDate } from '@shared/event-validation-utils';
import type { EventRequest } from '@shared/schema';

/** Week scope query values — Monday–Sunday calendar weeks in Eastern Time. */
export type WeekScopeParam = 'current' | 'next' | '+2' | '+3';

const WEEK_SCOPE_OFFSETS: Record<WeekScopeParam, number> = {
  current: 0,
  next: 1,
  '+2': 2,
  '+3': 3,
};

export function parseWeekScopeOffset(weekParam: string): number | null {
  if (weekParam in WEEK_SCOPE_OFFSETS) {
    return WEEK_SCOPE_OFFSETS[weekParam as WeekScopeParam];
  }
  return null;
}

export function getWeekRangeForOffset(weekOffset: number): { start: Date; end: Date } {
  const today = parseDateOnly(getTodayString())!;
  const startOfWeek = new Date(today);
  const dayOfWeek = startOfWeek.getDay();
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startOfWeek.setDate(startOfWeek.getDate() - daysToSubtract + weekOffset * 7);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return { start: startOfWeek, end: endOfWeek };
}

export function filterEventsByWeekScope(
  events: EventRequest[],
  weekParam: string,
): EventRequest[] {
  const offset = parseWeekScopeOffset(weekParam);
  if (offset === null) return events;

  const { start, end } = getWeekRangeForOffset(offset);
  return events.filter((event) => {
    const eventDate = getEffectiveEventDate(event);
    if (!eventDate) return false;
    const date = parseDateOnly(eventDate);
    if (!date) return false;
    return date >= start && date <= end;
  });
}
