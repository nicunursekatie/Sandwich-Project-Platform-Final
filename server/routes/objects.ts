import { Router } from 'express';
import { objectStorageService } from '../objectStorage';
import { logger } from '../utils/production-safe-logger';

const router = Router();

// POST /api/objects/upload - Get a signed upload URL for object storage
router.post('/upload', async (req, res) => {
  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  } catch (error) {
    logger.error('Failed to get upload URL:', error);
    res.status(500).json({
      error: 'Failed to get upload URL',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
