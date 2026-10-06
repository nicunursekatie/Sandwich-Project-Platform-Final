import { addDays, format, parseISO, startOfWeek } from 'date-fns';

type LogEntry = {
  hours: number;
  minutes: number;
  workDate: string | Date | null;
  createdAt: string | Date;
};

export function workLogDate(value: string | Date) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return value;
  return new Date(value).toLocaleDateString('en-CA', {
    timeZone: 'America/New_York',
  });
}

export function formatWorkMinutes(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export function summarizeWorkLogs<T extends LogEntry>(
  logs: T[],
  today: string
) {
  const weekKey = (date: string) =>
    format(startOfWeek(parseISO(date), { weekStartsOn: 3 }), 'yyyy-MM-dd');
  const currentWeek = weekKey(today);
  const totals = { week: 0, month: 0, all: 0 };
  const weeks = new Map<
    string,
    { key: string; label: string; minutes: number; logs: T[] }
  >();
  for (const log of logs) {
    const date = workLogDate(log.workDate || log.createdAt);
    const key = weekKey(date);
    const minutes = Number(log.hours || 0) * 60 + Number(log.minutes || 0);
    totals.all += minutes;
    if (key === currentWeek) totals.week += minutes;
    if (date.slice(0, 7) === today.slice(0, 7)) totals.month += minutes;
    if (!weeks.has(key)) {
      const start = parseISO(key);
      weeks.set(key, {
        key,
        label: `${format(start, 'MMM d, yyyy')} – ${format(addDays(start, 6), 'MMM d, yyyy')}`,
        minutes: 0,
        logs: [],
      });
    }
    const week = weeks.get(key)!;
    week.minutes += minutes;
    week.logs.push(log);
  }
  const groups = [...weeks.values()].sort((a, b) => b.key.localeCompare(a.key));
  for (const group of groups) {
    group.logs.sort((a, b) =>
      workLogDate(b.workDate || b.createdAt).localeCompare(
        workLogDate(a.workDate || a.createdAt)
      )
    );
  }
  return { totals, groups, currentWeek };
}
