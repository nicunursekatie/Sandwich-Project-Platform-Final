/**
 * Smart Search API Routes
 * Intelligent app-wide navigation and feature discovery
 */

import { Router } from 'express';
import { SmartSearchService } from '../services/smart-search.service';
import type { SmartSearchQuery, SmartSearchResponse } from '../types/smart-search';
import type { SessionUser } from '../types/express';
import { storage } from '../storage';

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
      const searchData = await searchService.hybridSearch(query);

      const response: SmartSearchResponse = {
        results: searchData.results,
        queryTime: Date.now() - startTime,
        usedAI: searchData.usedAI
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
   * Regenerate all embeddings (admin only) - legacy endpoint
   */
  router.post('/regenerate-embeddings', async (req, res) => {
    try {
      // Check if user is admin or super_admin
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
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
   * POST /api/smart-search/regenerate-embeddings-advanced
   * Regenerate embeddings with options (admin only)
   */
  router.post('/regenerate-embeddings-advanced', async (req, res) => {
    try {
      // Check if user is admin or super_admin
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const options = req.body;

      // Start regeneration in background
      searchService.regenerateEmbeddingsWithOptions(options)
        .catch(err => console.error('Background regeneration error:', err));

      res.json({ success: true, message: 'Regeneration started' });
    } catch (error) {
      console.error('Regenerate embeddings error:', error);
      res.status(500).json({ error: 'Failed to start regeneration' });
    }
  });

  /**
   * GET /api/smart-search/regeneration-progress
   * Get regeneration progress (admin only)
   */
  router.get('/regeneration-progress', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const progress = searchService.getRegenerationProgress();
      res.json(progress);
    } catch (error) {
      console.error('Get progress error:', error);
      res.status(500).json({ error: 'Failed to get progress' });
    }
  });

  /**
   * POST /api/smart-search/pause-regeneration
   * Pause ongoing regeneration (admin only)
   */
  router.post('/pause-regeneration', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      searchService.pauseRegeneration();
      res.json({ success: true });
    } catch (error) {
      console.error('Pause error:', error);
      res.status(500).json({ error: 'Failed to pause' });
    }
  });

  /**
   * POST /api/smart-search/resume-regeneration
   * Resume paused regeneration (admin only)
   */
  router.post('/resume-regeneration', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      searchService.resumeRegeneration();
      res.json({ success: true });
    } catch (error) {
      console.error('Resume error:', error);
      res.status(500).json({ error: 'Failed to resume' });
    }
  });

  /**
   * POST /api/smart-search/stop-regeneration
   * Stop ongoing regeneration (admin only)
   */
  router.post('/stop-regeneration', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      searchService.stopRegeneration();
      res.json({ success: true });
    } catch (error) {
      console.error('Stop error:', error);
      res.status(500).json({ error: 'Failed to stop' });
    }
  });

  /**
   * POST /api/smart-search/cost-estimate
   * Get cost estimate for regeneration (admin only)
   */
  router.post('/cost-estimate', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const options = req.body;
      const estimate = await searchService.getCostEstimate(options);
      res.json(estimate);
    } catch (error) {
      console.error('Cost estimate error:', error);
      res.status(500).json({ error: 'Failed to estimate cost' });
    }
  });

  /**
   * GET /api/smart-search/analytics-summary
   * Get analytics summary (admin only)
   */
  router.get('/analytics-summary', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const summary = await searchService.getAnalyticsSummary();
      res.json(summary);
    } catch (error) {
      console.error('Analytics summary error:', error);
      res.status(500).json({ error: 'Failed to get analytics' });
    }
  });

  /**
   * GET /api/smart-search/quality-metrics
   * Get embedding quality metrics (admin only)
   */
  router.get('/quality-metrics', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const metrics = await searchService.getEmbeddingQualityMetrics();
      res.json(metrics);
    } catch (error) {
      console.error('Quality metrics error:', error);
      res.status(500).json({ error: 'Failed to get quality metrics' });
    }
  });

  /**
   * POST /api/smart-search/test-search
   * Test search functionality (admin only)
   */
  router.post('/test-search', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { query, userRole } = req.body;
      const result = await searchService.testSearch(query, userRole);
      res.json(result);
    } catch (error) {
      console.error('Test search error:', error);
      res.status(500).json({ error: 'Failed to test search' });
    }
  });

  /**
   * POST /api/smart-search/feature
   * Add a new feature (admin only)
   */
  router.post('/feature', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const feature = await searchService.addFeature(req.body);
      res.json(feature);
    } catch (error) {
      console.error('Add feature error:', error);
      res.status(500).json({ error: 'Failed to add feature' });
    }
  });

  /**
   * PUT /api/smart-search/feature/:id
   * Update a feature (admin only)
   */
  router.put('/feature/:id', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const feature = await searchService.updateFeature(req.params.id, req.body);
      if (!feature) {
        return res.status(404).json({ error: 'Feature not found' });
      }
      res.json(feature);
    } catch (error) {
      console.error('Update feature error:', error);
      res.status(500).json({ error: 'Failed to update feature' });
    }
  });

  /**
   * DELETE /api/smart-search/feature/:id
   * Delete a feature (admin only)
   */
  router.delete('/feature/:id', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const success = await searchService.deleteFeature(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Feature not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Delete feature error:', error);
      res.status(500).json({ error: 'Failed to delete feature' });
    }
  });

  /**
   * GET /api/smart-search/export
   * Export features (admin only)
   */
  router.get('/export', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const features = await searchService.exportFeatures();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=smart-search-features.json');
      res.json(features);
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ error: 'Failed to export features' });
    }
  });

  /**
   * POST /api/smart-search/import
   * Import features (admin only)
   */
  router.post('/import', async (req, res) => {
    try {
      const sessionUser = req.user as SessionUser | undefined;
      if (sessionUser?.role !== 'admin' && sessionUser?.role !== 'super_admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { features, mode } = req.body;
      await searchService.importFeatures(features, mode || 'merge');
      res.json({ success: true, message: `Imported ${features.length} features` });
    } catch (error) {
      console.error('Import error:', error);
      res.status(500).json({ error: 'Failed to import features' });
    }
  });

  /**
   * POST /api/smart-search/analytics
   * Track search analytics
   */
  router.post('/analytics', async (req, res) => {
    try {
      // Log search analytics for learning and ML improvements
      const sessionUser = req.user as SessionUser | undefined;

      await storage.logSearchAnalytics({
        query: req.body.query || '',
        resultId: req.body.resultId || null,
        clicked: req.body.clicked || false,
        userId: sessionUser?.id || null,
        userRole: sessionUser?.role || null,
        usedAI: req.body.usedAI || false,
        resultsCount: req.body.resultsCount || 0,
        queryTime: req.body.queryTime || 0,
      });

      // Also record in service for internal analytics
      await searchService.recordAnalytics({
        query: req.body.query || '',
        resultId: req.body.resultId || null,
        clicked: req.body.clicked || false,
        timestamp: new Date(),
        userId: sessionUser?.id
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Analytics error:', error);
      res.status(500).json({ error: 'Failed to log analytics' });
    }
  });

  return router;
}
