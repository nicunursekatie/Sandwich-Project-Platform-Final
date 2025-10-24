import express from 'express';
import type { RouterDependencies } from '../types';
import { insertDriverSchema } from '@shared/schema';
import { AuditLogger } from '../audit-logger';

export function createDriversRouter(deps: RouterDependencies) {
  const router = express.Router();
  const { storage, isAuthenticated } = deps;

  // Get all drivers
  router.get('/', isAuthenticated, async (req: any, res: any) => {
    try {
      const drivers = await storage.getAllDrivers();
      res.json(drivers);
    } catch (error) {
      console.error('Failed to get drivers', error);
      res.status(500).json({ message: 'Failed to get drivers' });
    }
  });

  // Export drivers as CSV - MUST come before /:id route
  router.get('/export', isAuthenticated, async (req: any, res: any) => {
    try {
      const drivers = await storage.getAllDrivers();

      // Query driver agreements directly from database
      const { db } = await import('../db');
      const { driverAgreements } = await import('@shared/schema');
      const agreements = await db.select().from(driverAgreements);

      // Create a map of driver agreements by email for quick lookup
      const agreementsByEmail = new Map();
      agreements.forEach(agreement => {
        agreementsByEmail.set(agreement.email.toLowerCase(), agreement);
      });

      // CSV headers - all the fields requested
      const headers = [
        'ID',
        'Name',
        'Email',
        'Phone',
        'Agreement Signed',
        'Agreement Signed Date',
        'Van Driver Approved',
        'Van Driver Willing',
        'Driver Location',
        'Is Active',
        'License Number',
        'Availability',
        'Zone',
        'Route Description',
        'Availability Notes',
        'Email Agreement Sent',
        'Notes',
        'Created At'
      ];

      // Convert drivers to CSV rows
      const rows = drivers.map(driver => {
        const driverEmail = (driver.email || '').toLowerCase();
        const agreement = agreementsByEmail.get(driverEmail);

        return [
          driver.id,
          driver.name || '',
          driver.email || '',
          driver.phone || '',
          agreement?.agreementAccepted ? 'Yes' : 'No',
          agreement?.submittedAt ? new Date(agreement.submittedAt).toISOString().split('T')[0] : '',
          driver.vanApproved ? 'Yes' : 'No',
          driver.vehicleType === 'van' ? 'Yes' : 'No',
          driver.hostLocation || driver.area || '',
          driver.isActive ? 'Active' : 'Inactive',
          driver.licenseNumber || '',
          driver.availability || '',
          driver.zone || '',
          driver.routeDescription || '',
          driver.availabilityNotes || '',
          driver.emailAgreementSent ? 'Yes' : 'No',
          driver.notes || '',
          driver.createdAt ? new Date(driver.createdAt).toISOString().split('T')[0] : ''
        ];
      });

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          // Escape quotes and wrap in quotes if contains comma or quote
          const cellStr = String(cell).replace(/"/g, '""');
          return cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')
            ? `"${cellStr}"`
            : cellStr;
        }).join(','))
      ].join('\n');

      // Set response headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="drivers-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvContent);
    } catch (error) {
      console.error('Failed to export drivers', error);
      res.status(500).json({ message: 'Failed to export drivers' });
    }
  });

  // Get driver by ID
  router.get('/:id', isAuthenticated, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);
      const driver = await storage.getDriver(id);
      if (!driver) {
        return res.status(404).json({ message: 'Driver not found' });
      }
      res.json(driver);
    } catch (error) {
      console.error('Failed to get driver', error);
      res.status(500).json({ message: 'Failed to get driver' });
    }
  });

  // Create new driver
  router.post('/', isAuthenticated, async (req: any, res: any) => {
    try {
      const validatedData = insertDriverSchema.parse(req.body);
      const driver = await storage.createDriver(validatedData);

      // Audit log
      await AuditLogger.logCreate(
        'drivers',
        String(driver.id),
        driver,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.status(201).json(driver);
    } catch (error) {
      console.error('Failed to create driver', error);
      res.status(500).json({ message: 'Failed to create driver' });
    }
  });

  // Update driver (PUT)
  router.put('/:id', isAuthenticated, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);

      // Get old data before update
      const oldDriver = await storage.getDriver(id);
      if (!oldDriver) {
        return res.status(404).json({ message: 'Driver not found' });
      }

      const driver = await storage.updateDriver(id, req.body);

      // Audit log
      await AuditLogger.logEntityChange(
        'drivers',
        String(id),
        oldDriver,
        driver,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.json(driver);
    } catch (error) {
      console.error('Failed to update driver', error);
      res.status(500).json({ message: 'Failed to update driver' });
    }
  });

  // Update driver (PATCH)
  router.patch('/:id', isAuthenticated, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);

      // Get old data before update
      const oldDriver = await storage.getDriver(id);
      if (!oldDriver) {
        return res.status(404).json({ message: 'Driver not found' });
      }

      const driver = await storage.updateDriver(id, req.body);

      // Audit log
      await AuditLogger.logEntityChange(
        'drivers',
        String(id),
        oldDriver,
        driver,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.json(driver);
    } catch (error) {
      console.error('Failed to update driver', error);
      res.status(500).json({ message: 'Failed to update driver' });
    }
  });

  // Delete driver
  router.delete('/:id', isAuthenticated, async (req: any, res: any) => {
    try {
      const id = parseInt(req.params.id);

      // Get old data before delete
      const oldDriver = await storage.getDriver(id);
      if (!oldDriver) {
        return res.status(404).json({ message: 'Driver not found' });
      }

      const deleted = await storage.deleteDriver(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Driver not found' });
      }

      // Audit log
      await AuditLogger.logDelete(
        'drivers',
        String(id),
        oldDriver,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.status(204).send();
    } catch (error) {
      console.error('Failed to delete driver', error);
      res.status(500).json({ message: 'Failed to delete driver' });
    }
  });

  return router;
}

// Backwards compatibility export
export default createDriversRouter;
