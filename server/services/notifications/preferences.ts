import { eq, and } from 'drizzle-orm';
import { db } from '../../db';
import { notificationPreferences } from '@shared/schema';
import {
  type AlertType,
  getAlertDefinition,
  getAlertCategory,
} from '@shared/alert-catalog';
import { logger } from '../../utils/production-safe-logger';

export type NotificationChannel = 'email' | 'sms' | 'in_app';

export interface EffectivePrefs {
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  /** True when the user has explicitly saved this pref; false = using catalog defaults. */
  hasSavedPreference: boolean;
}

/**
 * Resolve a user's effective preferences for a given alert type.
 *
 * If the user has a saved row, return those values. Otherwise return the
 * catalog defaults so every path has a sensible fallback — new users don't
 * silently miss critical alerts just because they never opened Preferences.
 */
export async function getEffectivePrefs(
  userId: string,
  type: AlertType
): Promise<EffectivePrefs> {
  const def = getAlertDefinition(type);
  const defaults = def?.defaults ?? {
    emailEnabled: true,
    smsEnabled: false,
    inAppEnabled: true,
  };

  try {
    const [row] = await db
      .select({
        emailEnabled: notificationPreferences.emailEnabled,
        smsEnabled: notificationPreferences.smsEnabled,
        inAppEnabled: notificationPreferences.inAppEnabled,
      })
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.type, type)
        )
      )
      .limit(1);

    if (!row) {
      return { ...defaults, hasSavedPreference: false };
    }

    return {
      emailEnabled: row.emailEnabled,
      smsEnabled: row.smsEnabled,
      inAppEnabled: row.inAppEnabled,
      hasSavedPreference: true,
    };
  } catch (err) {
    logger.warn('Failed to load notification preferences, using defaults', {
      userId,
      type,
      error: err,
    });
    return { ...defaults, hasSavedPreference: false };
  }
}

/**
 * Quick yes/no check — does the user want this alert type delivered over
 * this channel? Use this at the top of any sender to decide whether to
 * proceed.
 */
export async function shouldSendOverChannel(
  userId: string,
  type: AlertType,
  channel: NotificationChannel
): Promise<boolean> {
  const prefs = await getEffectivePrefs(userId, type);
  if (channel === 'email') return prefs.emailEnabled;
  if (channel === 'sms') return prefs.smsEnabled;
  return prefs.inAppEnabled;
}

/**
 * Upsert a user's preference row.
 */
export async function upsertPrefs(
  userId: string,
  type: AlertType,
  updates: {
    emailEnabled?: boolean;
    smsEnabled?: boolean;
    inAppEnabled?: boolean;
  }
): Promise<EffectivePrefs> {
  const def = getAlertDefinition(type);
  const defaults = def?.defaults ?? {
    emailEnabled: true,
    smsEnabled: false,
    inAppEnabled: true,
  };
  const merged = {
    emailEnabled: updates.emailEnabled ?? defaults.emailEnabled,
    smsEnabled: updates.smsEnabled ?? defaults.smsEnabled,
    inAppEnabled: updates.inAppEnabled ?? defaults.inAppEnabled,
  };

  await db
    .insert(notificationPreferences)
    .values({
      userId,
      type,
      category: getAlertCategory(type),
      emailEnabled: merged.emailEnabled,
      smsEnabled: merged.smsEnabled,
      inAppEnabled: merged.inAppEnabled,
    })
    .onConflictDoUpdate({
      target: [
        notificationPreferences.userId,
        notificationPreferences.category,
        notificationPreferences.type,
      ],
      set: {
        emailEnabled: merged.emailEnabled,
        smsEnabled: merged.smsEnabled,
        inAppEnabled: merged.inAppEnabled,
        updatedAt: new Date(),
      },
    });

  return { ...merged, hasSavedPreference: true };
}
