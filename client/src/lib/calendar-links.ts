/**
 * Client-side calendar link helpers for the Volunteer Hub.
 *
 * These mirror the server-side helpers in server/routes/volunteer-event-hub.ts
 * (used in approval emails) so the "Add to calendar" buttons shown right after
 * signup behave identically to the links a volunteer later receives by email.
 *
 * Event times are stored as Eastern Time (America/New_York) wall-clock strings
 * (e.g. "10:00 AM" means 10am in Atlanta). We convert them to the correct UTC
 * instant — accounting for EDT/EST — so a 10am event lands on the volunteer's
 * calendar as 10am, not shifted by the timezone offset. The event *day* is taken
 * from the date's UTC parts so it never drifts a day early.
 */

import { APP_TIMEZONE } from '@/lib/date-utils';

/**
 * Offset (in ms) of the app timezone from UTC at a given instant.
 * Positive east of UTC; for Eastern it's negative (-4h EDT, -5h EST).
 */
function appTimezoneOffsetMs(date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIMEZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  let hour = Number(map.hour);
  if (hour === 24) hour = 0; // some engines render midnight as 24
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - date.getTime();
}

/**
 * Convert an Eastern wall-clock time (the calendar day + h:mm) into the true UTC
 * instant, handling daylight saving automatically.
 */
function easternWallClockToUtc(
  year: number,
  monthIndex: number,
  day: number,
  hours: number,
  minutes: number,
): Date {
  // First approximation: pretend the wall clock is already UTC.
  const guess = Date.UTC(year, monthIndex, day, hours, minutes, 0);
  // Then shift by the zone's offset at (approximately) that instant.
  return new Date(guess - appTimezoneOffsetMs(new Date(guess)));
}

/**
 * Parse "HH:MM" or "H:MM AM/PM" into the true UTC Date for that Eastern
 * wall-clock time on the given calendar day. Returns null if the time can't be
 * parsed so callers can fall back to all-day.
 */
function combineDateAndTime(dateOnly: Date, time: string | null | undefined): Date | null {
  if (!time) return null;
  const m = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/);
  if (!m) return null;
  let hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);
  const ampm = m[3]?.toUpperCase();
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  // dateOnly holds the intended calendar day in its UTC parts.
  return easternWallClockToUtc(
    dateOnly.getUTCFullYear(),
    dateOnly.getUTCMonth(),
    dateOnly.getUTCDate(),
    hours,
    minutes,
  );
}

function formatICalDate(d: Date, allDay: boolean): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  if (allDay) return `${yyyy}${mm}${dd}`;
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export interface EventTimes {
  start: Date;
  end: Date;
  allDay: boolean;
}

/**
 * Build start/end Dates from an event's date + start/end times.
 * If a start time is missing, the event is treated as all-day.
 * If only a start time is present, the event defaults to 2 hours long.
 */
export function buildEventTimes(
  eventDate: string | Date | null | undefined,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): EventTimes | null {
  if (!eventDate) return null;
  const dayDate = new Date(eventDate);
  if (isNaN(dayDate.getTime())) return null;
  const day = new Date(Date.UTC(dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate()));
  const start = combineDateAndTime(day, startTime);
  const end = combineDateAndTime(day, endTime);
  if (start && end) return { start, end, allDay: false };
  if (start && !end) {
    const fallbackEnd = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    return { start, end: fallbackEnd, allDay: false };
  }
  const nextDay = new Date(day.getTime() + 24 * 60 * 60 * 1000);
  return { start: day, end: nextDay, allDay: true };
}

/** Build a Google Calendar "add event" deep link. */
export function googleCalendarUrl(
  title: string,
  times: EventTimes,
  location: string | null,
  details: string | null,
): string {
  const dates = `${formatICalDate(times.start, times.allDay)}/${formatICalDate(times.end, times.allDay)}`;
  const params = new URLSearchParams({ action: 'TEMPLATE', text: title, dates });
  if (location) params.set('location', location);
  if (details) params.set('details', details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Build .ics file contents (for Apple Calendar / Outlook). */
export function buildIcs(
  uid: string,
  title: string,
  times: EventTimes,
  location: string | null,
  details: string | null,
): string {
  const dtstart = times.allDay
    ? `DTSTART;VALUE=DATE:${formatICalDate(times.start, true)}`
    : `DTSTART:${formatICalDate(times.start, false)}`;
  const dtend = times.allDay
    ? `DTEND;VALUE=DATE:${formatICalDate(times.end, true)}`
    : `DTEND:${formatICalDate(times.end, false)}`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Sandwich Project//Volunteer Hub//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatICalDate(new Date(), false)}`,
    dtstart,
    dtend,
    `SUMMARY:${escapeICS(title)}`,
    location ? `LOCATION:${escapeICS(location)}` : '',
    details ? `DESCRIPTION:${escapeICS(details)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n');
}

/** Trigger a browser download of an .ics file. */
export function downloadIcs(filename: string, icsContent: string): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke on the next tick so the click has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
