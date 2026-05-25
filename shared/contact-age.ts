/**
 * Computes the "age" of an event request's last contact attempt, expressed as
 * a tiered severity + a short label. Used for at-a-glance badges so the team
 * can see how stale each in-process event is.
 *
 * Counts up weekly indefinitely; switches to month phrasing once >= 4 weeks
 * for readability.
 */

export type ContactAgeTier =
  | 'fresh' // < 1 week since last contact (no badge)
  | 'wk1' // 1+ wks
  | 'wk2' // 2+ wks
  | 'wk3' // 3+ wks
  | 'mo1' // 4+ wks / 1+ mo
  | 'wk6' // 6+ wks (still under 2 months)
  | 'mo2plus'; // 2+ months and beyond

export interface ContactAgeBadge {
  tier: ContactAgeTier;
  /** Short label like "No contact 3+ wks" or "No contact 2+ mo" */
  label: string;
  /** Full integer number of weeks since the reference date */
  weeks: number;
}

/**
 * Compute the contact-age tier and label.
 *
 * @param lastContactAt - The most recent contact-attempt timestamp (or null if there's
 *                       never been one — caller is expected to short-circuit in that case,
 *                       but we still return 'fresh' defensively).
 * @param now           - Current time, defaulted to Date.now(). Injectable for testing.
 * @returns null if the contact is < 1 week old (no badge needed) OR if lastContactAt is
 *          missing / invalid; otherwise a ContactAgeBadge.
 */
export function getContactAgeBadge(
  lastContactAt: Date | string | null | undefined,
  now: Date = new Date(),
): ContactAgeBadge | null {
  if (!lastContactAt) return null;

  const ts = typeof lastContactAt === 'string' ? new Date(lastContactAt) : lastContactAt;
  if (Number.isNaN(ts.getTime())) return null;

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const elapsedMs = now.getTime() - ts.getTime();
  if (elapsedMs < msPerWeek) return null; // < 1 week — fresh enough, no badge

  const weeks = Math.floor(elapsedMs / msPerWeek);

  // Choose tier by week count.
  let tier: ContactAgeTier;
  if (weeks < 2) tier = 'wk1';
  else if (weeks < 3) tier = 'wk2';
  else if (weeks < 4) tier = 'wk3';
  else if (weeks < 6) tier = 'mo1';
  else if (weeks < 8) tier = 'wk6';
  else tier = 'mo2plus';

  // Label rule: under 4 wks → "X+ wks". 4-7 wks → "1+ mo" or "6+ wks" tier-specific.
  // 8+ wks → "X+ mo" (round down months).
  let label: string;
  if (weeks < 4) {
    label = `No contact ${weeks}+ wk${weeks === 1 ? '' : 's'}`;
  } else if (weeks < 6) {
    label = 'No contact 1+ mo';
  } else if (weeks < 8) {
    label = `No contact ${weeks}+ wks`;
  } else {
    const months = Math.floor(weeks / 4);
    label = `No contact ${months}+ mo`;
  }

  return { tier, label, weeks };
}

/**
 * Helper: from an event-request-like object, derive the most recent contact attempt
 * timestamp. Looks at `contactAttemptsLog` first (most accurate), then falls back to
 * `lastContactAttempt`.
 */
export function getLastContactTimestamp(
  request: {
    contactAttemptsLog?: unknown;
    lastContactAttempt?: Date | string | null;
  } | null | undefined,
): Date | null {
  if (!request) return null;
  const log = request.contactAttemptsLog;
  if (Array.isArray(log) && log.length > 0) {
    // Find the entry with the most recent timestamp
    let latest: number | null = null;
    for (const entry of log) {
      if (!entry || typeof entry !== 'object') continue;
      const ts = (entry as { timestamp?: string | Date }).timestamp;
      if (!ts) continue;
      const t = typeof ts === 'string' ? Date.parse(ts) : ts.getTime();
      if (!Number.isNaN(t) && (latest === null || t > latest)) latest = t;
    }
    if (latest !== null) return new Date(latest);
  }
  if (request.lastContactAttempt) {
    const d = typeof request.lastContactAttempt === 'string'
      ? new Date(request.lastContactAttempt)
      : request.lastContactAttempt;
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}
