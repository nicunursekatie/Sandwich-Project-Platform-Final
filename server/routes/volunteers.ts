import express from 'express';
import type { RouterDependencies } from '../types';
import { insertVolunteerSchema } from '@shared/schema';
import { logger } from '../utils/production-safe-logger';
import { AuditLogger } from '../audit-logger';
import { geocodeAddress } from '../utils/geocoding';

/** Roles that may view and edit internal volunteer directory notes */
const VOLUNTEER_NOTES_ADMIN_ROLES = new Set([
  'super_admin',
  'admin',
  'admin_coordinator',
  'admin_viewer',
]);

function getRequestUser(req: any) {
  return req.user ?? req.session?.user;
}

function canViewVolunteerNotes(req: any): boolean {
  const role = getRequestUser(req)?.role;
  return !!role && VOLUNTEER_NOTES_ADMIN_ROLES.has(role);
}

function redactVolunteerNotes(req: any, volunteer: any) {
  if (!volunteer || canViewVolunteerNotes(req)) return volunteer;
  return { ...volunteer, notes: null };
}

async function geocodeVolunteerIfNeeded(volunteerData: any, existing?: any) {
  const address = volunteerData.address || volunteerData.homeAddress;
  const shouldGeocode =
    volunteerData.isDriver &&
    address &&
    (!existing ||
      !existing.latitude ||
      !existing.longitude ||
      address !== existing.address);

  if (!shouldGeocode) {
    return volunteerData;
  }

  const result = await geocodeAddress(address);
  if (result) {
    return {
      ...volunteerData,
      latitude: result.latitude,
      longitude: result.longitude,
      geocodedAt: new Date(),
    };
  }

  return volunteerData;
}

export function createVolunteersRouter(deps: RouterDependencies) {
  const router = express.Router();
  const { storage, isAuthenticated } = deps;

  // Get all volunteers
  router.get('/', isAuthenticated, async (req: any, res: any) => {
    try {
      const volunteers = await storage.getAllVolunteers();
      res.json(volunteers.map((v: any) => redactVolunteerNotes(req, v)));
    } catch (error) {
      logger.error('Failed to get volunteers', error);
      res.status(500).json({ message: 'Failed to get volunteers' });
    }
  });

  // Export volunteers (CSV) - MUST come before /:id route
  router.get('/export', isAuthenticated, async (req: any, res: any) => {
    try {
      const volunteers = await storage.getAllVolunteers();
      // Set CSV headers
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="volunteers_export_${new Date().toISOString().split('T')[0]}.csv"`
      );

      // Create CSV content with comprehensive contact information
      const headers = [
        'ID',
        'Name',
        'Email',
        'Phone',
        'Home Address',
        'Status',
        'Vehicle Type',
        'License Number',
        'Availability',
        'Van Approved',
        'Is Weekly Driver',
        'Host Location',
        'Route Description',
        'Availability Notes',
        'Notes',
        'Email Agreement Sent',
        'Voicemail Left',
        'Inactive Reason',
        'Experience Level',
        'Training Completed',
        'Created Date',
      ];
      const csvContent = [headers.join(',')];

      const showNotes = canViewVolunteerNotes(req);

      for (const volunteer of volunteers) {
        const escapeCSV = (str: string | null | undefined) => {
          if (!str) return '';
          return `"${String(str).replace(/"/g, '""')}"`;
        };

        const row = [
          volunteer.id || '',
          escapeCSV(volunteer.name),
          volunteer.email || '',
          volunteer.phone || '',
          escapeCSV(volunteer.homeAddress || volunteer.address),
          volunteer.isActive ? 'Active' : 'Inactive',
          escapeCSV(volunteer.vehicleType),
          escapeCSV(volunteer.licenseNumber),
          escapeCSV(volunteer.availability),
          volunteer.vanApproved ? 'Yes' : 'No',
          volunteer.isWeeklyDriver ? 'Yes' : 'No',
          escapeCSV(volunteer.hostLocation),
          escapeCSV(volunteer.routeDescription),
          escapeCSV(volunteer.availabilityNotes),
          showNotes ? escapeCSV(volunteer.notes) : '',
          volunteer.emailAgreementSent ? 'Yes' : 'No',
          volunteer.voicemailLeft ? 'Yes' : 'No',
          escapeCSV(volunteer.inactiveReason),
          volunteer.experienceLevel || 'new',
          volunteer.trainingCompleted ? 'Yes' : 'No',
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

  // Get volunteer by ID
  router.get('/:id', isAuthenticated, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const volunteer = await storage.getVolunteer(id);
      if (!volunteer) {
        return res.status(404).json({ message: 'Volunteer not found' });
      }
      res.json(redactVolunteerNotes(req, volunteer));
    } catch (error) {
      logger.error('Failed to get volunteer', error);
      res.status(500).json({ message: 'Failed to get volunteer' });
    }
  });

  // Create new volunteer
  router.post('/', isAuthenticated, async (req: any, res: any) => {
    try {
      const validatedData = insertVolunteerSchema.parse(req.body);
      if (!canViewVolunteerNotes(req)) {
        delete validatedData.notes;
      }
      const dataWithGeo = await geocodeVolunteerIfNeeded(validatedData);
      const volunteer = await storage.createVolunteer(dataWithGeo);

      // Audit log
      await AuditLogger.logCreate(
        'volunteers',
        String(volunteer.id),
        volunteer,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.status(201).json(redactVolunteerNotes(req, volunteer));
    } catch (error) {
      logger.error('Failed to create volunteer', error);
      res.status(500).json({ message: 'Failed to create volunteer' });
    }
  });

  // Update volunteer (PATCH)
  router.patch('/:id', isAuthenticated, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);

      // Get old data before update
      const oldVolunteer = await storage.getVolunteer(id);
      if (!oldVolunteer) {
        return res.status(404).json({ message: 'Volunteer not found' });
      }

      const body = { ...req.body };
      if (!canViewVolunteerNotes(req)) {
        delete body.notes;
      }
      const updatePayload = await geocodeVolunteerIfNeeded(body, oldVolunteer);
      const volunteer = await storage.updateVolunteer(id, updatePayload);
      if (!volunteer) {
        return res.status(404).json({ message: 'Volunteer not found' });
      }

      // Audit log
      await AuditLogger.logEntityChange(
        'volunteers',
        String(id),
        oldVolunteer,
        volunteer,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.json(redactVolunteerNotes(req, volunteer));
    } catch (error) {
      logger.error('Failed to update volunteer', error);
      res.status(500).json({ message: 'Failed to update volunteer' });
    }
  });

  // Update volunteer (PUT)
  router.put('/:id', isAuthenticated, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);

      // Get old data before update
      const oldVolunteer = await storage.getVolunteer(id);
      if (!oldVolunteer) {
        return res.status(404).json({ message: 'Volunteer not found' });
      }

      const body = { ...req.body };
      if (!canViewVolunteerNotes(req)) {
        delete body.notes;
      }
      const volunteer = await storage.updateVolunteer(id, body);
      if (!volunteer) {
        return res.status(404).json({ message: 'Volunteer not found' });
      }

      // Audit log
      await AuditLogger.logEntityChange(
        'volunteers',
        String(id),
        oldVolunteer,
        volunteer,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.json(redactVolunteerNotes(req, volunteer));
    } catch (error) {
      logger.error('Failed to update volunteer', error);
      res.status(500).json({ message: 'Failed to update volunteer' });
    }
  });

  // Delete volunteer
  router.delete('/:id', isAuthenticated, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);

      // Get old data before delete
      const oldVolunteer = await storage.getVolunteer(id);
      if (!oldVolunteer) {
        return res.status(404).json({ message: 'Volunteer not found' });
      }

      const deleted = await storage.deleteVolunteer(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Volunteer not found' });
      }

      // Audit log
      await AuditLogger.logDelete(
        'volunteers',
        String(id),
        oldVolunteer,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete volunteer', error);
      res.status(500).json({ message: 'Failed to delete volunteer' });
    }
  });

  return router;
}

// Backwards compatibility export
export default createVolunteersRouter;
