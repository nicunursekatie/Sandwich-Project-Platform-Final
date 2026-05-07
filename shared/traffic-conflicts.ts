/**
 * Known dates with significant Atlanta-area traffic impact.
 * Surfaced as warnings on event request cards and date pickers so the
 * intake team can flag scheduling conflicts early.
 *
 * Dates use YYYY-MM-DD in Eastern Time (the timezone the app operates in).
 */

export interface TrafficConflict {
  date: string; // YYYY-MM-DD (Eastern Time)
  label: string; // Short title shown on the badge
  detail: string; // Match-up / longer description
  kickoffEt: string; // Human-readable kickoff time
}

export const TRAFFIC_CONFLICTS: TrafficConflict[] = [
  {
    date: '2026-06-15',
    label: 'Atlanta World Cup match',
    detail: 'Spain vs. Cabo Verde (Group H)',
    kickoffEt: '12:00 PM ET',
  },
  {
    date: '2026-06-18',
    label: 'Atlanta World Cup match',
    detail: 'South Africa vs. Czechia (Group A)',
    kickoffEt: '12:00 PM ET',
  },
  {
    date: '2026-06-21',
    label: 'Atlanta World Cup match',
    detail: 'Spain vs. Saudi Arabia (Group H)',
    kickoffEt: '12:00 PM ET',
  },
  {
    date: '2026-06-24',
    label: 'Atlanta World Cup match',
    detail: 'Morocco vs. Haiti (Group C)',
    kickoffEt: '6:00 PM ET',
  },
  {
    date: '2026-06-27',
    label: 'Atlanta World Cup match',
    detail: 'Congo DR vs. Uzbekistan (Group K)',
    kickoffEt: '7:30 PM ET',
  },
  {
    date: '2026-07-01',
    label: 'Atlanta World Cup match',
    detail: 'Round of 32 (1L vs. 3EHIJK)',
    kickoffEt: '12:00 PM ET',
  },
  {
    date: '2026-07-07',
    label: 'Atlanta World Cup match',
    detail: 'Round of 16 (W86 vs. W88)',
    kickoffEt: '12:00 PM ET',
  },
  {
    date: '2026-07-15',
    label: 'Atlanta World Cup match',
    detail: 'Semifinal',
    kickoffEt: '3:00 PM ET',
  },
];

const CONFLICT_BY_DATE: Record<string, TrafficConflict> = TRAFFIC_CONFLICTS.reduce(
  (acc, c) => {
    acc[c.date] = c;
    return acc;
  },
  {} as Record<string, TrafficConflict>,
);

/**
 * Convert any supported date input to a YYYY-MM-DD key in Eastern Time.
 * Accepts: Date instances, ISO timestamp strings, or already-formatted YYYY-MM-DD strings.
 * Returns null when the input can't be parsed.
 */
function toEasternDateKey(input: Date | string | null | undefined): string | null {
  if (!input) return null;

  if (typeof input === 'string') {
    // Already a plain YYYY-MM-DD — use as-is to avoid timezone drift.
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;

    // ISO timestamp string (e.g. "2026-06-24T16:00:00.000Z" or "2026-06-24T00:00:00.000Z")
    // Extract the date portion directly to avoid timezone conversion shifting the day.
    // These dates are conceptually date-only values stored as timestamps.
    const isoMatch = input.match(/^(\d{4}-\d{2}-\d{2})T/);
    if (isoMatch) return isoMatch[1];

    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    // For Date objects, use local date parts to avoid timezone shift
    // (dates are stored via parseDateOnly at local noon)
    const y = input.getFullYear();
    const m = String(input.getMonth() + 1).padStart(2, '0');
    const day = String(input.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return null;
}

export function getTrafficConflict(
  date: Date | string | null | undefined,
): TrafficConflict | null {
  const key = toEasternDateKey(date);
  if (!key) return null;
  return CONFLICT_BY_DATE[key] ?? null;
}

/**
 * Returns the first matching conflict across the supplied dates,
 * or null when none of them hit a known conflict date.
 * Use when an event has multiple relevant dates (desired vs scheduled).
 */
export function getTrafficConflictForEvent(
  ...dates: Array<Date | string | null | undefined>
): TrafficConflict | null {
  for (const d of dates) {
    const hit = getTrafficConflict(d);
    if (hit) return hit;
  }
  return null;
}
