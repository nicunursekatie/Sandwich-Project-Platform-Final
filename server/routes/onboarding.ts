import { Router } from 'express';
import type { RouterDependencies } from '../types';
import { onboardingService } from '../services/onboarding-service';

export function createOnboardingRouter(deps: RouterDependencies) {
  const router = Router();
  const { isAuthenticated } = deps;

  // Get challenges for current user
  router.get('/challenges', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const challenges = await onboardingService.getChallengesForUser(userId);
    res.json(challenges);
  } catch (error) {
    console.error('Error fetching challenges:', error);
    res.status(500).json({ message: 'Failed to fetch challenges' });
  }
});

// Track challenge completion
  router.post('/track/:actionKey', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { actionKey } = req.params;
    const metadata = req.body.metadata || {};

    const result = await onboardingService.trackChallengeCompletion(
      userId,
      actionKey,
      metadata
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error tracking challenge:', error);
    res.status(500).json({ message: 'Failed to track challenge' });
  }
});

// Get user stats
  router.get('/stats', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const stats = await onboardingService.getUserStats(userId);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
});

// Get leaderboard
  router.get('/leaderboard', isAuthenticated, async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const leaderboard = await onboardingService.getLeaderboard(limit);
    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Failed to fetch leaderboard' });
  }
});

// Admin: Initialize default challenges
  router.post('/admin/initialize', isAuthenticated, async (req: any, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    await onboardingService.initializeDefaultChallenges();
    res.json({ message: 'Challenges initialized successfully' });
  } catch (error) {
    console.error('Error initializing challenges:', error);
    res.status(500).json({ message: 'Failed to initialize challenges' });
  }
});

  return router;
}

