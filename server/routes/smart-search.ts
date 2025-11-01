/**
 * Smart Search API Routes
 * Intelligent app-wide navigation and feature discovery
 */

import { Router } from 'express';
import { SmartSearchService } from '../services/smart-search.service';
import type { SmartSearchQuery, SmartSearchResponse } from '../types/smart-search';
import type { SessionUser } from '../types/express';

interface ExtendedSmartSearchQuery extends SmartSearchQuery {
  userPermissions?: string[];
}

export function createSmartSearchRouter(searchService: SmartSearchService) {
  const router = Router();

  /**
   * POST /api/smart-search/query
   * Perform intelligent search
   */
  router.post('/query', async (req, res) => {
    try {
      const startTime = Date.now();
      const sessionUser = req.user as SessionUser | undefined;
      const query: ExtendedSmartSearchQuery = {
        query: req.body.query || '',
        limit: req.body.limit || 10,
        userRole: sessionUser?.role || 'user',
        userPermissions: sessionUser?.permissions || []
      };

      if (!query.query.trim()) {
        return res.json({
          results: [],
          queryTime: 0,
          usedAI: false
        });
      }

      // Check common questions first
      const commonAnswer = await searchService.checkCommonQuestions(query.query);
      if (commonAnswer) {
        const response: SmartSearchResponse = {
          results: [{
            feature: commonAnswer,
            score: 1.0,
            matchType: 'exact'
          }],
          queryTime: Date.now() - startTime,
          usedAI: false
        };
        return res.json(response);
      }

      // Use hybrid search for best results
      const results = await searchService.hybridSearch(query);

      const response: SmartSearchResponse = {
        results,
        queryTime: Date.now() - startTime,
        usedAI: results.some(r => r.matchType === 'semantic')
      };

      res.json(response);
    } catch (error) {
      console.error('Smart search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  /**
   * POST /api/smart-search/fuzzy
   * Perform fast fuzzy search (for real-time autocomplete)
   */
  router.post('/fuzzy', async (req, res) => {
    try {
      const startTime = Date.now();
      const sessionUser = req.user as SessionUser | undefined;
      const query: ExtendedSmartSearchQuery = {
        query: req.body.query || '',
        limit: req.body.limit || 5,
        userRole: sessionUser?.role || 'user',
        userPermissions: sessionUser?.permissions || []
      };

      const results = await searchService.fuzzySearch(query);

      const response: SmartSearchResponse = {
        results,
        queryTime: Date.now() - startTime,
        usedAI: false
      };

      res.json(response);
    } catch (error) {
      console.error('Fuzzy search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  /**
   * GET /api/smart-search/features
   * Get all searchable features
   */
  router.get('/features', async (req, res) => {
    try {
      const features = await searchService.getAllFeatures();
      res.json({ features });
    } catch (error) {
      console.error('Get features error:', error);
      res.status(500).json({ error: 'Failed to get features' });
    }
  });

  /**
   * POST /api/smart-search/regenerate-embeddings
   * Regenerate all embeddings (admin only)
   */
  router.post('/regenerate-embeddings', async (req, res) => {
    try {
      // Check if user is admin
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      await searchService.regenerateEmbeddings();
      res.json({ success: true, message: 'Embeddings regenerated successfully' });
    } catch (error) {
      console.error('Regenerate embeddings error:', error);
      res.status(500).json({ error: 'Failed to regenerate embeddings' });
    }
  });

  /**
   * POST /api/smart-search/analytics
   * Track search analytics
   */
  router.post('/analytics', async (req, res) => {
    try {
      // Log search analytics for learning
      const sessionUser = req.user as SessionUser | undefined;
      const analytics = {
        query: req.body.query,
        resultId: req.body.resultId,
        clicked: req.body.clicked,
        timestamp: new Date(),
        userId: sessionUser?.id
      };

      // TODO: Store analytics in database for future ML improvements
      console.log('Search analytics:', analytics);

      res.json({ success: true });
    } catch (error) {
      console.error('Analytics error:', error);
      res.status(500).json({ error: 'Failed to log analytics' });
    }
  });

  return router;
}
