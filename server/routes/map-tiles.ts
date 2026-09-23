import { Router } from 'express';
import { logger } from '../utils/production-safe-logger';
import {
  fetchMapTile,
  getMapConfig,
  getViewportCopyright,
  isValidTileCoord,
  isValidViewport,
  redactMapSecrets,
  type Viewport,
} from '../services/google-map-tiles';

const router = Router();

router.get('/config', async (_req, res) => {
  const config = await getMapConfig();
  res.json(config);
});

router.get('/copyright', async (req, res) => {
  const view: Viewport = {
    north: Number(req.query.north),
    south: Number(req.query.south),
    east: Number(req.query.east),
    west: Number(req.query.west),
    zoom: Number(req.query.zoom),
  };

  if (!isValidViewport(view)) {
    return res.status(400).json({ error: 'Invalid viewport' });
  }

  try {
    const copyright = await getViewportCopyright(view);
    res.json({ copyright });
  } catch (error) {
    logger.error(
      `Map copyright lookup failed: ${
        error instanceof Error ? redactMapSecrets(error.message) : 'unknown error'
      }`
    );
    res.status(502).json({ error: 'Copyright lookup failed' });
  }
});

router.get('/tiles/:z/:x/:y', async (req, res) => {
  const z = Number(req.params.z);
  const x = Number(req.params.x);
  const y = Number(req.params.y);

  if (!isValidTileCoord(z, x, y)) {
    return res.status(400).end();
  }

  try {
    const tile = await fetchMapTile(z, x, y);
    res.setHeader('Content-Type', tile.contentType);
    res.setHeader('Cache-Control', tile.cacheControl);
    if (tile.etag) res.setHeader('ETag', tile.etag);
    res.removeHeader('Pragma');
    res.removeHeader('Expires');
    res.send(tile.body);
  } catch (error) {
    logger.error(
      `Map tile fetch failed: ${
        error instanceof Error ? redactMapSecrets(error.message) : 'unknown error'
      }`
    );
    res.status(502).end();
  }
});

export default router;
