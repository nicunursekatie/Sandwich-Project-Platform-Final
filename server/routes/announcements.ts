import { Request, Response, Express } from 'express';
import { isAuthenticated } from '../temp-auth';

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

// Register routes
export function registerAnnouncementRoutes(app: Express) {
  app.get('/api/announcements', isAuthenticated, getAnnouncements);
}

export default {
  getAnnouncements,
};