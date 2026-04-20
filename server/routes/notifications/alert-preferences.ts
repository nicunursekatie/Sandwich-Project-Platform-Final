import { Router } from 'express';
import { z } from 'zod';
import { ALERT_CATALOG, isAlertType, type AlertType } from '@shared/alert-catalog';
import { getEffectivePrefs, upsertPrefs } from '../../services/notifications/preferences';
import { logger } from '../../utils/production-safe-logger';

/**
 * Alert Preferences API
 *
 * Powers the Alert Preferences screen. One GET that returns the full catalog
 * with the user's current settings, one PUT that saves a single alert.
 *
 * Keyed by `type` (from shared/alert-catalog.ts). The UI renders one row per
 * catalog entry; the backend senders read the same rows via
 * `shouldSendOverChannel()`.
 */
export const alertPreferencesRouter = Router();

alertPreferencesRouter.get('/', async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const userId = req.user.id;
    const rows = await Promise.all(
      ALERT_CATALOG.map(async (def) => {
        const prefs = await getEffectivePrefs(userId, def.type);
        return {
          type: def.type,
          name: def.name,
          description: def.description,
          category: def.category,
          availableChannels: def.availableChannels,
          implemented: def.implemented,
          emailEnabled: prefs.emailEnabled,
          smsEnabled: prefs.smsEnabled,
          inAppEnabled: prefs.inAppEnabled,
          hasSavedPreference: prefs.hasSavedPreference,
        };
      })
    );
    res.json({ alerts: rows });
  } catch (err) {
    logger.error('Failed to fetch alert preferences', { error: err });
    res.status(500).json({ error: 'Failed to fetch alert preferences' });
  }
});

const updateSchema = z.object({
  type: z.string().refine(isAlertType, { message: 'Unknown alert type' }),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
});

alertPreferencesRouter.put('/', async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payload', details: parsed.error.errors });
  }

  try {
    const { type, ...updates } = parsed.data;
    // Zod refine with isAlertType narrows at runtime; cast for the type system.
    const result = await upsertPrefs(req.user.id, type as AlertType, updates);
    res.json({ success: true, prefs: result });
  } catch (err) {
    logger.error('Failed to update alert preference', { error: err, userId: req.user.id });
    res.status(500).json({ error: 'Failed to update alert preference' });
  }
});
