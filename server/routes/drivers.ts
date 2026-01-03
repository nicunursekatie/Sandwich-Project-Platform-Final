import express, { Request, Response } from 'express';
import { eq, desc, inArray, or, sql } from 'drizzle-orm';
import type { RouterDependencies } from '../types';
import type { AuthenticatedRequest } from '../types/express';
import { drivers, insertDriverSchema, type Driver } from '@shared/schema';
import { logger } from '../utils/production-safe-logger';
import { AuditLogger } from '../audit-logger';
import { geocodeAddress } from '../utils/geocoding';
import { db } from '../db';

type DriverLocationSource = 'hostLocation' | 'homeAddress' | 'routeDescription' | 'zone' | 'area';

interface DriverLocationTarget {
  location: string;
  source: DriverLocationSource;
}

// Normalize the raw location text into something geocodable
function normalizeDriverLocation(
  value: string | null | undefined,
  source: DriverLocationSource
): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (source === 'routeDescription') {
    // Remove the word "route" and try to extract endpoints like "Sandy Springs to Dunwoody"
    const cleaned = trimmed.replace(/route/gi, '').trim();
    const parts = cleaned
      .split(/(?:\s+to\s+|->|—|–|-|\/|\|)/i)
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length >= 2) {
      // Use the endpoints as a comma-separated query for better geocoding results
      return `${parts[0]}, ${parts[parts.length - 1]}`;
    }

    return cleaned;
  }

  if (source === 'zone') {
    // Strip the word "zone" which can confuse geocoding
    return trimmed.replace(/zone\s*/i, '').trim() || trimmed;
  }

  return trimmed;
}

// Choose the best available field to geocode for a driver
function getDriverLocationForGeocoding(driver: Driver): DriverLocationTarget | null {
  const candidates: Array<{ value: string | null; source: DriverLocationSource }> = [
    { value: driver.hostLocation, source: 'hostLocation' },
    { value: driver.homeAddress, source: 'homeAddress' },
    { value: driver.routeDescription, source: 'routeDescription' },
    { value: driver.zone, source: 'zone' },
    { value: driver.area, source: 'area' },
  ];

  for (const candidate of candidates) {
    const normalized = normalizeDriverLocation(candidate.value, candidate.source);
    if (normalized) {
      return { location: normalized, source: candidate.source };
    }
  }

  return null;
}

// Convert a raw location into a geocodable query string
function buildGeocodeQuery(rawLocation: string): string {
  const trimmed = rawLocation.trim();

  // Split multi-area strings like "A/B/C" into a comma-separated query
  const parts = trimmed.split(/[\\/]/).map((p) => p.trim()).filter(Boolean);
  let query = parts.length > 1 ? parts.join(', ') : trimmed;

  // Add regional context if missing to improve accuracy
  if (!query.match(/,\s*(GA|Georgia)/i) && !query.match(/USA|United States/i)) {
    query = `${query}, Georgia, USA`;
  }

  return query;
}

const GEOCODE_DELAY_MS = 1100; // Respect Nominatim 1 req/sec guidance

export function createDriversRouter(deps: RouterDependencies) {
  const router = express.Router();
  const { storage, isAuthenticated } = deps;

  // Get all drivers
  router.get('/', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const drivers = await storage.getAllDrivers();
      res.json(drivers);
    } catch (error) {
      logger.error('Failed to get drivers', error);
      res.status(500).json({ message: 'Failed to get drivers' });
    }
  });

  // Unified driver candidates: drivers + host contacts + volunteers flagged as drivers
  router.get('/driver-candidates', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const [allDrivers, hostsWithContacts, volunteers] = await Promise.all([
        storage.getAllDrivers(),
        storage.getAllHostsWithContacts(),
        storage.getAllVolunteers?.(),
      ]);

      const driverCandidates = (allDrivers || [])
        .filter((d: any) => d.isActive && d.latitude && d.longitude)
        .map((d: any) => ({
          id: `driver-${d.id}`,
          driverId: d.id,
          source: 'driver' as const,
          name: d.name,
          email: d.email,
          phone: d.phone,
          latitude: String(d.latitude),
          longitude: String(d.longitude),
          availability: d.availability,
          vehicleType: d.vehicleType,
          vanApproved: d.vanApproved,
          hostLocation: d.hostLocation || d.area || d.zone || d.routeDescription,
        }));

      const hostCandidates = (hostsWithContacts || [])
        .filter((host: any) => host.status === 'active')
        .flatMap((host: any) =>
          (host.contacts || [])
            .filter((contact: any) => contact.latitude && contact.longitude)
            .map((contact: any) => ({
              id: `host-${contact.id}`,
              source: 'host' as const,
              name: contact.name || contact.contactName,
              email: contact.email,
              phone: contact.phone,
              latitude: String(contact.latitude),
              longitude: String(contact.longitude),
              availability: contact.weeklyActive ? 'available' : 'unknown',
              hostLocation: host.name || contact.hostLocationName,
            }))
        );

      const volunteerCandidates = (volunteers || [])
        .filter((v: any) => v.isActive && v.isDriver && v.latitude && v.longitude)
        .map((v: any) => ({
          id: `volunteer-${v.id}`,
          source: 'volunteer' as const,
          name: v.name,
          email: v.email,
          phone: v.phone,
          latitude: String(v.latitude),
          longitude: String(v.longitude),
          availability: v.availability,
          vehicleType: v.vehicleType,
          vanApproved: v.vanApproved,
          hostLocation: v.hostLocation || v.routeDescription || v.zone,
        }));

      res.json([...driverCandidates, ...hostCandidates, ...volunteerCandidates]);
    } catch (error) {
      logger.error('Failed to get driver candidates', error);
      res.status(500).json({ message: 'Failed to get driver candidates' });
    }
  });

  // Export drivers as CSV - MUST come before /:id route
  router.get('/export', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const drivers = await storage.getAllDrivers();

      // Query driver agreements directly from database
      // Strategy: Get agreements for exported drivers only to ensure completeness
      const { db } = await import('../db');
      const { driverAgreements } = await import('@shared/schema');
      
      // Get emails of all drivers (keep original casing)
      const driverEmails = drivers
        .map(d => d.email)
        .filter((email): email is string => !!email && email.trim() !== '');
      
      // Query agreements filtered to exported drivers using case-insensitive matching
      // Handle large lists by chunking if needed (PostgreSQL limit ~32767 parameters)
      let agreements: any[] = [];
      
      if (driverEmails.length > 0) {
        const CHUNK_SIZE = 1000; // Safe chunk size for inArray queries
        
        if (driverEmails.length <= CHUNK_SIZE) {
          // Single query for smaller lists
          agreements = await db.select()
            .from(driverAgreements)
            .where(sql`LOWER(${driverAgreements.email}) IN (${sql.join(driverEmails.map(e => sql`LOWER(${e})`), sql`, `)})`)
            .orderBy(desc(driverAgreements.submittedAt));
        } else {
          // Chunk for larger lists
          for (let i = 0; i < driverEmails.length; i += CHUNK_SIZE) {
            const chunk = driverEmails.slice(i, i + CHUNK_SIZE);
            const chunkResults = await db.select()
              .from(driverAgreements)
              .where(sql`LOWER(${driverAgreements.email}) IN (${sql.join(chunk.map(e => sql`LOWER(${e})`), sql`, `)})`)
              .orderBy(desc(driverAgreements.submittedAt));
            agreements.push(...chunkResults);
          }
        }
      }
      
      // Log if we're processing a large number of agreements
      if (agreements.length > 0) {
        logger.info(`Exporting ${drivers.length} drivers with ${agreements.length} agreements`);
      }

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
          driver.emailAgreementSent ? 'Yes' : 'No',
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
      logger.error('Failed to export drivers', error);
      res.status(500).json({ message: 'Failed to export drivers' });
    }
  });

  // Get driver by ID
  router.get('/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const driver = await storage.getDriver(id);
      if (!driver) {
        return res.status(404).json({ message: 'Driver not found' });
      }
      res.json(driver);
    } catch (error) {
      logger.error('Failed to get driver', error);
      res.status(500).json({ message: 'Failed to get driver' });
    }
  });

  // Create new driver
  router.post('/', isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Convert date strings to Date objects for timestamp fields
      const createData = { ...req.body };
      if (createData.unavailableUntil && typeof createData.unavailableUntil === 'string') {
        createData.unavailableUntil = new Date(createData.unavailableUntil);
      }
      if (createData.unavailableUntil === '') {
        createData.unavailableUntil = null;
      }

      const validatedData = insertDriverSchema.parse(createData);
      const driver = await storage.createDriver(validatedData);

      // Audit log
      const authReq = req as AuthenticatedRequest;
      await AuditLogger.logCreate(
        'drivers',
        String(driver.id),
        driver,
        {
          userId: authReq.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.status(201).json(driver);
    } catch (error) {
      logger.error('Failed to create driver', error);
      res.status(500).json({ message: 'Failed to create driver' });
    }
  });

  // Update driver (PUT)
  router.put('/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      // Get old data before update
      const oldDriver = await storage.getDriver(id);
      if (!oldDriver) {
        return res.status(404).json({ message: 'Driver not found' });
      }

      // Convert date strings to Date objects for timestamp fields
      const updateData = { ...req.body };

      // Remove read-only fields that shouldn't be updated
      delete updateData.id;
      delete updateData.createdAt;
      delete updateData.updatedAt;
      delete updateData.geocodedAt;

      // Handle timestamp fields that can be updated
      const timestampFields = ['unavailableUntil'];
      timestampFields.forEach(field => {
        if (updateData[field] && typeof updateData[field] === 'string') {
          updateData[field] = new Date(updateData[field]);
        }
        if (updateData[field] === '') {
          updateData[field] = null;
        }
      });

      const driver = await storage.updateDriver(id, updateData);
      if (!driver) {
        return res.status(404).json({ message: 'Driver not found' });
      }

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
      logger.error('Failed to update driver', error);
      res.status(500).json({ message: 'Failed to update driver' });
    }
  });

  // Update driver (PATCH)
  router.patch('/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      // Get old data before update
      const oldDriver = await storage.getDriver(id);
      if (!oldDriver) {
        return res.status(404).json({ message: 'Driver not found' });
      }

      // Convert date strings to Date objects for timestamp fields
      const updateData = { ...req.body };

      // Remove read-only fields that shouldn't be updated
      delete updateData.id;
      delete updateData.createdAt;
      delete updateData.updatedAt;
      delete updateData.geocodedAt;

      // Handle timestamp fields that can be updated
      const timestampFields = ['unavailableUntil'];
      timestampFields.forEach(field => {
        if (updateData[field] && typeof updateData[field] === 'string') {
          updateData[field] = new Date(updateData[field]);
        }
        if (updateData[field] === '') {
          updateData[field] = null;
        }
      });

      const driver = await storage.updateDriver(id, updateData);
      if (!driver) {
        return res.status(404).json({ message: 'Driver not found' });
      }

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
      logger.error('Failed to update driver', error);
      res.status(500).json({ message: 'Failed to update driver' });
    }
  });

  // Delete driver
  router.delete('/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
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
      logger.error('Failed to delete driver', error);
      res.status(500).json({ message: 'Failed to delete driver' });
    }
  });

  // Batch geocode all drivers that have location data but no coordinates
  router.post('/batch-geocode', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const allDrivers = await storage.getAllDrivers();

      // Build the list of drivers with a geocodable location and missing coordinates
      const driversToGeocode = allDrivers
        .map((driver) => ({
          driver,
          location: getDriverLocationForGeocoding(driver),
        }))
        .filter(
          (item): item is { driver: Driver; location: DriverLocationTarget } =>
            Boolean(item.location) && (!item.driver.latitude || !item.driver.longitude)
        );

      if (driversToGeocode.length === 0) {
        return res.json({
          message: 'No drivers need geocoding',
          total: allDrivers.length,
          alreadyGeocoded: allDrivers.filter(d => d.latitude && d.longitude).length,
        });
      }

      logger.info('Starting batch geocoding', {
        count: driversToGeocode.length
      });

      const results = {
        success: 0,
        failed: 0,
        total: driversToGeocode.length,
        failures: [] as Array<{
          driverId: number;
          name: string;
          location: string;
          source: DriverLocationSource;
        }>,
      };

      // Geocode each driver with rate limiting
      for (const { driver, location } of driversToGeocode) {
        // Respect Nominatim rate limits
        await new Promise((resolve) => setTimeout(resolve, GEOCODE_DELAY_MS));

        const query = buildGeocodeQuery(location.location);
        const geocodeResult = await geocodeAddress(query);

        if (geocodeResult) {
          // Update driver with coordinates
          await db.update(drivers)
            .set({
              latitude: geocodeResult.latitude,
              longitude: geocodeResult.longitude,
              geocodedAt: new Date(),
            })
            .where(eq(drivers.id, driver.id));

          results.success++;
          logger.info('Geocoded driver', {
            driverId: driver.id,
            name: driver.name,
            location: location.location,
            source: location.source,
          });
        } else {
          results.failed++;
          results.failures.push({
            driverId: driver.id,
            name: driver.name,
            location: location.location,
            source: location.source,
          });
          logger.warn('Failed to geocode driver', {
            driverId: driver.id,
            name: driver.name,
            location: location.location,
            source: location.source,
          });
        }
      }

      res.json(results);
    } catch (error) {
      logger.error('Batch geocoding failed', error);
      res.status(500).json({ message: 'Batch geocoding failed' });
    }
  });

  // === Driver Vehicles Routes ===

  // Get all vehicles for a driver
  router.get('/:driverId/vehicles', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const driverId = parseInt(req.params.driverId);
      const vehicles = await storage.getDriverVehicles(driverId);
      res.json(vehicles);
    } catch (error) {
      logger.error('Failed to get driver vehicles', error);
      res.status(500).json({ message: 'Failed to get driver vehicles' });
    }
  });

  // Create a new vehicle for a driver
  router.post('/:driverId/vehicles', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const driverId = parseInt(req.params.driverId);
      const vehicleData = { ...req.body, driverId };
      const vehicle = await storage.createDriverVehicle(vehicleData);

      // Audit log
      await AuditLogger.logCreate(
        'driver_vehicles',
        String(vehicle.id),
        vehicle,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.status(201).json(vehicle);
    } catch (error) {
      logger.error('Failed to create driver vehicle', error);
      res.status(500).json({ message: 'Failed to create driver vehicle' });
    }
  });

  // Update a vehicle
  router.put('/vehicles/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      const oldVehicle = await storage.getDriverVehicle(id);
      if (!oldVehicle) {
        return res.status(404).json({ message: 'Vehicle not found' });
      }

      const vehicle = await storage.updateDriverVehicle(id, req.body);
      if (!vehicle) {
        return res.status(404).json({ message: 'Vehicle not found' });
      }

      // Audit log
      await AuditLogger.logEntityChange(
        'driver_vehicles',
        String(id),
        oldVehicle,
        vehicle,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.json(vehicle);
    } catch (error) {
      logger.error('Failed to update driver vehicle', error);
      res.status(500).json({ message: 'Failed to update driver vehicle' });
    }
  });

  // Delete a vehicle
  router.delete('/vehicles/:id', isAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      const oldVehicle = await storage.getDriverVehicle(id);
      if (!oldVehicle) {
        return res.status(404).json({ message: 'Vehicle not found' });
      }

      const deleted = await storage.deleteDriverVehicle(id);
      if (!deleted) {
        return res.status(404).json({ message: 'Vehicle not found' });
      }

      // Audit log
      await AuditLogger.logDelete(
        'driver_vehicles',
        String(id),
        oldVehicle,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete driver vehicle', error);
      res.status(500).json({ message: 'Failed to delete driver vehicle' });
    }
  });

  return router;
}

// Backwards compatibility export
export default createDriversRouter;
