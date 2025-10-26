import { Router } from 'express';
import { requirePermission } from '../middleware/auth';
import { isAuthenticated } from '../auth';
import { logger } from '../utils/production-safe-logger';

const router = Router();

// Store for feature flags (in-memory for now, could be moved to database)
const featureFlags: Record<string, boolean> = {
  tollFreeVerification: true,
  smsNotifications: true,
  emailNotifications: true,
  advancedReporting: false,
  betaFeatures: false,
};

/**
 * Get all feature flags
 */
router.get('/', requirePermission('ADMIN_ACCESS'), async (req, res) => {
  try {
    logger.log('Fetching all feature flags');

    res.json({
      success: true,
      flags: featureFlags,
    });
  } catch (error) {
    logger.error('Error fetching feature flags:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feature flags',
      error: (error as Error).message,
    });
  }
});

/**
 * Update a feature flag
 */
router.put('/:flagName', isAuthenticated, requirePermission('ADMIN_ACCESS'), async (req, res) => {
  try {
    const { flagName } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'enabled must be a boolean value',
      });
    }

    if (!(flagName in featureFlags)) {
      return res.status(404).json({
        success: false,
        message: `Feature flag '${flagName}' not found`,
      });
    }

    featureFlags[flagName] = enabled;
    logger.log(`Feature flag '${flagName}' updated to: ${enabled}`);

    res.json({
      success: true,
      message: `Feature flag '${flagName}' updated successfully`,
      flag: {
        name: flagName,
        enabled,
      },
    });
  } catch (error) {
    logger.error('Error updating feature flag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update feature flag',
      error: (error as Error).message,
    });
  }
});

/**
 * Get a specific feature flag
 */
router.get('/:flagName', async (req, res) => {
  try {
    const { flagName } = req.params;

    if (!(flagName in featureFlags)) {
      return res.status(404).json({
        success: false,
        message: `Feature flag '${flagName}' not found`,
      });
    }

    res.json({
      success: true,
      flag: {
        name: flagName,
        enabled: featureFlags[flagName],
      },
    });
  } catch (error) {
    logger.error('Error fetching feature flag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feature flag',
      error: (error as Error).message,
    });
  }
});

export default router;
