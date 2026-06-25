/**
 * Client-side calendar link helpers for the Volunteer Hub.
 *
 * These mirror the server-side helpers in server/routes/volunteer-event-hub.ts
 * (used in approval emails) so the "Add to calendar" buttons shown right after
 * signup behave identically to the links a volunteer later receives by email.
 *
 * Times are treated as UTC wall-clock (e.g. "10:00 AM" -> 10:00 UTC), matching
 * the existing email behavior. This keeps the two code paths consistent.
 */

/**
 * Parse "HH:MM" or "H:MM AM/PM" into a Date on the given day (UTC).
 * Returns null if the time can't be parsed so callers can fall back to all-day.
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
  const out = new Date(dateOnly);
  out.setUTCHours(hours, minutes, 0, 0);
  return out;
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
