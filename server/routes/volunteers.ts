import express from 'express';
import type { RouterDependencies } from '../types';
import { insertVolunteerSchema } from '@shared/schema';
import { logger } from '../utils/production-safe-logger';

export function createVolunteersRouter(deps: RouterDependencies) {
  const router = express.Router();
  const { storage, isAuthenticated } = deps;

  // Get all volunteers
  router.get('/', isAuthenticated, async (req: any, res: any) => {
    try {
      const volunteers = await storage.getAllVolunteers();
      res.json(volunteers);
    } catch (error) {
      logger.error('Failed to get volunteers', error);
      res.status(500).json({ message: 'Failed to get volunteers' });
    }
  });

  // Get volunteer by ID
  router.get('/:id', isAuthenticated, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const volunteer = await storage.getVolunteer(id);
      if (!volunteer) {
        return res.status(404).json({ message: 'Volunteer not found' });
      }
      res.json(volunteer);
    } catch (error) {
      logger.error('Failed to get volunteer', error);
      res.status(500).json({ message: 'Failed to get volunteer' });
    }
  });

  // Create new volunteer
  router.post('/', isAuthenticated, async (req: any, res: any) => {
    try {
      const validatedData = insertVolunteerSchema.parse(req.body);
      const volunteer = await storage.createVolunteer(validatedData);
      res.status(201).json(volunteer);
    } catch (error) {
      logger.error('Failed to create volunteer', error);
      res.status(500).json({ message: 'Failed to create volunteer' });
    }
  });

  // Update volunteer (PATCH)
  router.patch('/:id', isAuthenticated, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const volunteer = await storage.updateVolunteer(id, req.body);
      if (!volunteer) {
        return res.status(404).json({ message: 'Volunteer not found' });
      }
      res.json(volunteer);
    } catch (error) {
      logger.error('Failed to update volunteer', error);
      res.status(500).json({ message: 'Failed to update volunteer' });
    }
  });

  // Update volunteer (PUT)
  router.put('/:id', isAuthenticated, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const volunteer = await storage.updateVolunteer(id, req.body);
      if (!volunteer) {
        return res.status(404).json({ message: 'Volunteer not found' });
      }
      res.json(volunteer);
    } catch (error) {
      logger.error('Failed to update volunteer', error);
      res.status(500).json({ message: 'Failed to update volunteer' });
    }
  });

  // Delete volunteer
  router.delete('/:id', isAuthenticated, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteVolunteer(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Volunteer not found' });
      }
      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete volunteer', error);
      res.status(500).json({ message: 'Failed to delete volunteer' });
    }
  });

  // Export volunteers (CSV/Excel)
  router.get('/export', isAuthenticated, async (req: any, res: any) => {
    try {
      const volunteers = await storage.getAllVolunteers();
      // Set CSV headers
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="volunteers.csv"'
      );

      // Create CSV content
      const headers = [
        'ID',
        'Name',
        'Email',
        'Phone',
        'Host',
        'Notes',
        'Created',
      ];
      const csvContent = [headers.join(',')];

      for (const volunteer of volunteers) {
        const row = [
          volunteer.id || '',
          `"${volunteer.name || ''}"`,
          volunteer.email || '',
          volunteer.phone || '',
          volunteer.hostId ? `Host ${volunteer.hostId}` : '',
          `"${(volunteer.notes || '').replace(/"/g, '""')}"`,
          volunteer.createdAt
            ? new Date(volunteer.createdAt).toLocaleDateString()
            : '',
        ];
        csvContent.push(row.join(','));
      }

      res.send(csvContent.join('\n'));
    } catch (error) {
      logger.error('Failed to export volunteers', error);
      res.status(500).json({ message: 'Failed to export volunteers' });
    }
  });

  return router;
}

// Backwards compatibility export
export default createVolunteersRouter;
