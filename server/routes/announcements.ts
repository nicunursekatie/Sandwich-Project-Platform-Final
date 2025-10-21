import { Request, Response, Router } from 'express';
import type { RouterDependencies } from '../types';

// Get announcements
const getAnnouncements = async (req: Request, res: Response) => {
  try {
    // Return empty array for now - can be implemented later
    res.json([]);
  } catch (error) {
    console.error('Error getting announcements:', error);
    res.status(500).json({ error: 'Failed to get announcements' });
  }
};

export function createAnnouncementsRouter(deps: RouterDependencies) {
  const router = Router();
  const { isAuthenticated } = deps;

  router.get('/', isAuthenticated, getAnnouncements);

  return router;
}

// Backwards compatibility export
export function registerAnnouncementRoutes(app: any) {
  const router = createAnnouncementsRouter({
    storage: require('../storage-wrapper').storage,
    isAuthenticated: require('../temp-auth').isAuthenticated,
    requirePermission: require('../middleware/auth').requirePermission,
    sessionStore: null as any,
  });
  app.use('/api/announcements', router);
}

export default {
  getAnnouncements,
};