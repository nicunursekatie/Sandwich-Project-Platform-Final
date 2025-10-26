import { Router } from 'express';
import { featureFlagService } from '../services/feature-flags';
import { isAuthenticated } from '../auth';
import { logger } from '../utils/production-safe-logger';

const router = Router();

/**
 * Check if a specific feature flag is enabled for the current user
 * GET /api/feature-flags/check/:flagName
 */
router.get('/check/:flagName', isAuthenticated, async (req, res) => {
  try {
    const { flagName } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const result = await featureFlagService.checkFlag(
      flagName,
      userId,
      userRole
    );

    res.json(result);
  } catch (error) {
    logger.error('Error checking feature flag:', error);
    res.status(500).json({
      enabled: false,
      reason: 'Error checking flag',
    });
  }
});

/**
 * Check multiple feature flags at once
 * POST /api/feature-flags/check-multiple
 * Body: { flags: string[] }
 */
router.post('/check-multiple', isAuthenticated, async (req, res) => {
  try {
    const { flags } = req.body;

    if (!Array.isArray(flags)) {
      return res.status(400).json({
        error: 'flags must be an array',
      });
    }

    const userId = req.user?.id;
    const userRole = req.user?.role;

    const results: Record<string, boolean> = {};

    for (const flagName of flags) {
      const enabled = await featureFlagService.isEnabled(
        flagName,
        userId,
        userRole
      );
      results[flagName] = enabled;
    }

    res.json(results);
  } catch (error) {
    logger.error('Error checking multiple feature flags:', error);
    res.status(500).json({
      error: 'Error checking flags',
    });
  }
});

/**
 * Get all feature flags (Admin only)
 * GET /api/feature-flags
 */
router.get('/', requirePermission('ADMIN_ACCESS'), async (req, res) => {
  try {
    const flags = await featureFlagService.getAllFlags();
    res.json(flags);
  } catch (error) {
    logger.error('Error getting feature flags:', error);
    res.status(500).json({ error: 'Failed to get feature flags' });
  }
});

/**
 * Get a specific feature flag details (Admin only)
 * GET /api/feature-flags/:flagName
 */
router.get('/:flagName', requirePermission('ADMIN_ACCESS'), async (req, res) => {
  try {
    const { flagName } = req.params;
    const flag = await featureFlagService.getFlag(flagName);

    if (!flag) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    res.json(flag);
  } catch (error) {
    logger.error('Error getting feature flag:', error);
    res.status(500).json({ error: 'Failed to get feature flag' });
  }
});

/**
 * Create or update a feature flag (Admin only)
 * POST /api/feature-flags
 * Body: { flagName, description?, enabled?, enabledForUsers?, enabledForRoles?, enabledPercentage?, metadata? }
 */
router.post('/', requirePermission('ADMIN_ACCESS'), async (req, res) => {
  try {
    const {
      flagName,
      description,
      enabled,
      enabledForUsers,
      enabledForRoles,
      enabledPercentage,
      metadata,
    } = req.body;

    if (!flagName) {
      return res.status(400).json({ error: 'flagName is required' });
    }

    await featureFlagService.setFlag(flagName, {
      description,
      enabled,
      enabledForUsers,
      enabledForRoles,
      enabledPercentage,
      metadata,
      createdBy: req.user?.id,
    });

    res.json({ success: true, message: 'Feature flag updated' });
  } catch (error) {
    logger.error('Error setting feature flag:', error);
    res.status(500).json({ error: 'Failed to set feature flag' });
  }
});

/**
 * Enable a flag globally (Admin only)
 * POST /api/feature-flags/:flagName/enable
 */
router.post(
  '/:flagName/enable',
  requirePermission('ADMIN_ACCESS'),
  async (req, res) => {
    try {
      const { flagName } = req.params;
      await featureFlagService.enableFlag(flagName);
      res.json({ success: true, message: `${flagName} enabled globally` });
    } catch (error) {
      logger.error('Error enabling feature flag:', error);
      res.status(500).json({ error: 'Failed to enable feature flag' });
    }
  }
);

/**
 * Disable a flag globally (Admin only)
 * POST /api/feature-flags/:flagName/disable
 */
router.post(
  '/:flagName/disable',
  requirePermission('ADMIN_ACCESS'),
  async (req, res) => {
    try {
      const { flagName } = req.params;
      await featureFlagService.disableFlag(flagName);
      res.json({ success: true, message: `${flagName} disabled globally` });
    } catch (error) {
      logger.error('Error disabling feature flag:', error);
      res.status(500).json({ error: 'Failed to disable feature flag' });
    }
  }
);

/**
 * Enable for specific users (Admin only)
 * POST /api/feature-flags/:flagName/enable-users
 * Body: { userIds: string[] }
 */
router.post(
  '/:flagName/enable-users',
  requirePermission('ADMIN_ACCESS'),
  async (req, res) => {
    try {
      const { flagName } = req.params;
      const { userIds } = req.body;

      if (!Array.isArray(userIds)) {
        return res.status(400).json({ error: 'userIds must be an array' });
      }

      await featureFlagService.enableForUsers(flagName, userIds);
      res.json({
        success: true,
        message: `${flagName} enabled for ${userIds.length} users`,
      });
    } catch (error) {
      logger.error('Error enabling feature flag for users:', error);
      res.status(500).json({ error: error.message || 'Failed to enable for users' });
    }
  }
);

/**
 * Disable for specific users (Admin only)
 * POST /api/feature-flags/:flagName/disable-users
 * Body: { userIds: string[] }
 */
router.post(
  '/:flagName/disable-users',
  requirePermission('ADMIN_ACCESS'),
  async (req, res) => {
    try {
      const { flagName } = req.params;
      const { userIds } = req.body;

      if (!Array.isArray(userIds)) {
        return res.status(400).json({ error: 'userIds must be an array' });
      }

      await featureFlagService.disableForUsers(flagName, userIds);
      res.json({
        success: true,
        message: `${flagName} disabled for ${userIds.length} users`,
      });
    } catch (error) {
      logger.error('Error disabling feature flag for users:', error);
      res.status(500).json({ error: 'Failed to disable for users' });
    }
  }
);

/**
 * Enable for specific roles (Admin only)
 * POST /api/feature-flags/:flagName/enable-roles
 * Body: { roles: string[] }
 */
router.post(
  '/:flagName/enable-roles',
  requirePermission('ADMIN_ACCESS'),
  async (req, res) => {
    try {
      const { flagName } = req.params;
      const { roles } = req.body;

      if (!Array.isArray(roles)) {
        return res.status(400).json({ error: 'roles must be an array' });
      }

      await featureFlagService.enableForRoles(flagName, roles);
      res.json({
        success: true,
        message: `${flagName} enabled for roles: ${roles.join(', ')}`,
      });
    } catch (error) {
      logger.error('Error enabling feature flag for roles:', error);
      res.status(500).json({ error: 'Failed to enable for roles' });
    }
  }
);

/**
 * Set percentage rollout (Admin only)
 * POST /api/feature-flags/:flagName/percentage
 * Body: { percentage: number } (0-100)
 */
router.post(
  '/:flagName/percentage',
  requirePermission('ADMIN_ACCESS'),
  async (req, res) => {
    try {
      const { flagName } = req.params;
      const { percentage } = req.body;

      if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
        return res.status(400).json({
          error: 'percentage must be a number between 0 and 100',
        });
      }

      await featureFlagService.setPercentageRollout(flagName, percentage);
      res.json({
        success: true,
        message: `${flagName} set to ${percentage}% rollout`,
      });
    } catch (error) {
      logger.error('Error setting percentage rollout:', error);
      res.status(500).json({ error: 'Failed to set percentage rollout' });
    }
  }
);

/**
 * Initialize unified activity feature flags (Admin only)
 * POST /api/feature-flags/initialize-unified-activities
 */
router.post(
  '/initialize-unified-activities',
  requirePermission('ADMIN_ACCESS'),
  async (req, res) => {
    try {
      await featureFlagService.initializeUnifiedActivityFlags();
      res.json({
        success: true,
        message: 'Unified activity feature flags initialized',
      });
    } catch (error) {
      logger.error('Error initializing unified activity flags:', error);
      res.status(500).json({ error: 'Failed to initialize flags' });
    }
  }
);

export default router;
