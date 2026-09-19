/**
 * Pure helpers backing the "Start Work / Stop Work" stopwatch on the Work Log page.
 * Kept free of database and Express imports so the arithmetic can be unit tested.
 */

// A forgotten timer would otherwise log an absurd duration (days of "work") that
// skews every total, so cap what gets written and report that it was capped.
export const MAX_TIMER_MINUTES = 24 * 60;

export interface TimerDuration {
  hours: number;
  minutes: number;
  totalMinutes: number;
  capped: boolean;
}

/**
 * Convert stopwatch seconds into the hours/minutes columns of `work_logs`.
 * Any deliberate start/stop counts as at least one minute.
 */
export function elapsedToDuration(elapsedSeconds: number): TimerDuration {
  const safeSeconds = Number.isFinite(elapsedSeconds)
    ? Math.max(0, elapsedSeconds)
    : 0;
  const rawMinutes = Math.max(1, Math.round(safeSeconds / 60));
  const capped = rawMinutes > MAX_TIMER_MINUTES;
  const totalMinutes = capped ? MAX_TIMER_MINUTES : rawMinutes;

  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
    totalMinutes,
    capped,
  };
}

/**
 * The work date is the calendar day the timer STARTED, in Eastern time. Returned
 * as noon local so the timestamp can't drift across a day boundary when rendered.
 */
export function easternWorkDate(startedAt: Date): Date {
  // en-CA gives YYYY-MM-DD.
  const easternDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(startedAt);
  return new Date(`${easternDay}T12:00:00`);
}
