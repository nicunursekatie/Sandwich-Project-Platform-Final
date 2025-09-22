import { Router } from 'express';
import { z } from 'zod';
import { insertAgendaItemSchema } from '@shared/schema';

export default function createAgendaItemsRouter(isAuthenticated: any, storage: any) {
  const router = Router();
  
  console.log('🔧 Agenda Items Router - Initializing with authentication middleware');

  // Get agenda items (optionally filtered by meetingId)
  router.get('/', isAuthenticated, async (req, res) => {
    try {
      console.log('🟢 Agenda Items API - GET request received:', req.url, req.query);
      const { meetingId } = req.query;
      
      const items = await storage.getAllAgendaItems();
      
      // Filter by meetingId if provided
      const filteredItems = meetingId 
        ? items.filter((item: { meetingId: number }) => item.meetingId === parseInt(meetingId as string))
        : items;
      
      console.log('✅ Agenda Items API - Returning', filteredItems.length, 'items', 
        meetingId ? `for meeting ${meetingId}` : '(all meetings)');
      res.json(filteredItems);
    } catch (error) {
      console.error('❌ Agenda Items API - Error fetching items:', error);
      res.status(500).json({ message: 'Failed to fetch agenda items' });
    }
  });

  // Create new agenda item
  router.post('/', isAuthenticated, async (req: any, res) => {
    try {
      console.log('🟢 Agenda Items API - Creating agenda item:', req.body);
      
      // Get user information from the authenticated request
      const userId = req.user?.claims?.sub || req.user?.id;
      const userEmail = req.user?.email || req.body.submittedBy || 'unknown';
      
      if (!userId) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      // Parse and validate the request body
      const itemData = insertAgendaItemSchema.parse({
        ...req.body,
        submittedBy: userEmail, // Use the user's email as submittedBy
      });
      
      const item = await storage.createAgendaItem(itemData);
      console.log('✅ Agenda Items API - Created agenda item:', item);
      res.status(201).json(item);
    } catch (error) {
      console.error('❌ Agenda Items API - Error creating agenda item:', error);
      if (error instanceof z.ZodError) {
        res
          .status(400)
          .json({ message: 'Invalid agenda item data', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to create agenda item' });
      }
    }
  });

  // Update agenda item status
  router.patch('/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'User ID not found' });
      }
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Committee members cannot modify agenda item statuses
      if (user.role === 'committee_member') {
        return res.status(403).json({
          message: 'Committee members cannot modify agenda item statuses',
        });
      }

      const id = parseInt(req.params.id);
      const { status } = req.body;

      if (!['pending', 'approved', 'rejected', 'postponed'].includes(status)) {
        res.status(400).json({ message: 'Invalid status' });
        return;
      }

      const updatedItem = await storage.updateAgendaItemStatus(id, status);
      if (!updatedItem) {
        res.status(404).json({ message: 'Agenda item not found' });
        return;
      }

      res.json(updatedItem);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update agenda item' });
    }
  });

  // Update agenda item content
  router.put('/:id', isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { title, description } = req.body;

      const updatedItem = await storage.updateAgendaItem(id, {
        title,
        description,
      });

      if (!updatedItem) {
        res.status(404).json({ message: 'Agenda item not found' });
        return;
      }

      res.json(updatedItem);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update agenda item' });
    }
  });

  // Delete agenda item
  router.delete('/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: 'User ID not found' });
      }
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Committee members cannot delete agenda items
      if (user.role === 'committee_member') {
        return res
          .status(403)
          .json({ message: 'Committee members cannot delete agenda items' });
      }

      const id = parseInt(req.params.id);
      const success = await storage.deleteAgendaItem(id);

      if (!success) {
        res.status(404).json({ message: 'Agenda item not found' });
        return;
      }

      res.json({ message: 'Agenda item deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete agenda item' });
    }
  });

  return router;
}