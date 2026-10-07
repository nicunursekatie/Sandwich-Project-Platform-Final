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
