/**
 * Shared utility for calculating reminder scheduling dates.
 * Used by both the reminder API routes and the cron processing service.
 */

export type ReminderFrequency = 'daily' | 'every_3_days' | 'weekly' | 'biweekly';

const FREQUENCY_DAYS: Record<ReminderFrequency, number> = {
  daily: 1,
  every_3_days: 3,
  weekly: 7,
  biweekly: 14,
};

/**
 * Calculate the next due date for a reminder based on its frequency.
 * Always normalizes to 9:00 AM to avoid off-hours notifications.
 */
export function calculateNextDue(frequency: string, fromDate: Date = new Date()): Date {
  const days = FREQUENCY_DAYS[frequency as ReminderFrequency] ?? 7;
  const next = new Date(fromDate);
  next.setDate(next.getDate() + days);
  next.setHours(9, 0, 0, 0);
  return next;
}

/** Cooldown period (in days) after a condition-based reminder fires, to avoid spamming. */
export const CONDITION_COOLDOWN_FREQUENCY: ReminderFrequency = 'every_3_days';

/** Condition-based rules re-evaluate daily until their condition is met. */
export const CONDITION_CHECK_FREQUENCY: ReminderFrequency = 'daily';
