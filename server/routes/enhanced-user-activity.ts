import { Router } from 'express';

const router = Router();

/**
 * Track user activity endpoint (stub for now)
 * This prevents 404 errors in the frontend
 */
router.post('/track', async (req, res) => {
  // Simply acknowledge the tracking request
  // You can implement actual tracking logic later if needed
  res.json({
    success: true,
    message: 'Activity tracked',
    timestamp: new Date().toISOString()
  });
});

export default router;