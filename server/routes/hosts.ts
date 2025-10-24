import { Router } from 'express';
import type { RouterDependencies } from '../types';
import { sanitizeMiddleware } from '../middleware/sanitizer';
import { insertHostSchema, insertHostContactSchema } from '@shared/schema';
import { PERMISSIONS } from '@shared/auth-utils';
import { scrapeHostAvailability } from '../services/host-availability-scraper';
import {
  hostsErrorHandler,
  asyncHandler,
  createHostsError,
  validateId,
  validateRequired,
  HostsError,
} from './hosts/error-handler';
import { z } from 'zod';
import { AuditLogger } from '../audit-logger';

export function createHostsRouter(deps: RouterDependencies) {
  const router = Router();
  const { storage, requirePermission } = deps;

  // Validation schema for coordinate updates
  const coordinatesSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  });

  // Host management routes
  router.get('/hosts', 
  requirePermission(PERMISSIONS.HOSTS_VIEW), 
  asyncHandler(async (req, res) => {
    const hosts = await storage.getAllHosts();
    res.json(hosts);
  })
);

  router.get(
  '/hosts-with-contacts',
  requirePermission(PERMISSIONS.HOSTS_VIEW),
  asyncHandler(async (req, res) => {
    const hostsWithContacts = await storage.getAllHostsWithContacts();
    res.json(hostsWithContacts);
  })
);

// Map endpoint - get host contacts with valid coordinates for map display
  router.get(
  '/hosts/map',
  requirePermission(PERMISSIONS.HOSTS_VIEW),
  asyncHandler(async (req, res) => {
    const hostsWithContacts = await storage.getAllHostsWithContacts();
    
    // Flatten contacts and add host location info, filter for valid coordinates
    const contactsWithCoordinates = hostsWithContacts
      .filter(host => host.status === 'active') // Only active host locations
      .flatMap(host => 
        host.contacts
          .filter(contact => 
            contact.latitude !== null && 
            contact.longitude !== null
          )
          .map(contact => ({
            id: contact.id,
            contactName: contact.name,
            role: contact.role,
            hostLocationName: host.name, // Host location area name
            address: contact.address,
            latitude: contact.latitude,
            longitude: contact.longitude,
            email: contact.email,
            phone: contact.phone,
          }))
      );
    
    res.json(contactsWithCoordinates);
  })
);

  router.get(
  '/hosts/:id',
  requirePermission(PERMISSIONS.HOSTS_VIEW),
  asyncHandler(async (req, res) => {
    const id = validateId(req.params.id, 'host');
    const host = await storage.getHost(id);
    if (!host) {
      throw createHostsError('Host not found', 404, 'HOST_NOT_FOUND', { hostId: id });
    }
    res.json(host);
  })
);

  router.post(
  '/hosts',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  sanitizeMiddleware,
  asyncHandler(async (req: any, res) => {
    validateRequired(req.body, ['name'], 'host creation');

    const result = insertHostSchema.safeParse(req.body);
    if (!result.success) {
      throw createHostsError(
        'Invalid host data provided',
        400,
        'VALIDATION_ERROR',
        { validationErrors: result.error.errors }
      );
    }

    const host = await storage.createHost(result.data);

    // Audit log
    await AuditLogger.logCreate(
      'hosts',
      String(host.id),
      host,
      {
        userId: req.user?.id || req.session?.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        sessionId: req.sessionID
      }
    );

    res.status(201).json(host);
  })
);

  router.patch(
  '/hosts/:id',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  sanitizeMiddleware,
  asyncHandler(async (req: any, res) => {
    const id = validateId(req.params.id, 'host');
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0) {
      throw createHostsError('No update data provided', 400, 'NO_UPDATE_DATA');
    }

    // Get old data before update
    const oldHost = await storage.getHost(id);
    if (!oldHost) {
      throw createHostsError('Host not found', 404, 'HOST_NOT_FOUND', { hostId: id });
    }

    const host = await storage.updateHost(id, updates);
    if (!host) {
      throw createHostsError('Host not found', 404, 'HOST_NOT_FOUND', { hostId: id });
    }

    // Audit log
    await AuditLogger.logEntityChange(
      'hosts',
      String(id),
      oldHost,
      host,
      {
        userId: req.user?.id || req.session?.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        sessionId: req.sessionID
      }
    );

    res.json(host);
  })
);

// Update host coordinates endpoint
  router.patch(
  '/hosts/:id/coordinates',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  sanitizeMiddleware,
  asyncHandler(async (req: any, res) => {
    const id = validateId(req.params.id, 'host');

    // Validate coordinates using Zod schema
    const result = coordinatesSchema.safeParse(req.body);
    if (!result.success) {
      throw createHostsError(
        'Invalid coordinates provided',
        400,
        'VALIDATION_ERROR',
        { validationErrors: result.error.errors }
      );
    }

    const { latitude, longitude } = result.data;

    // Get old data before update
    const oldHost = await storage.getHost(id);
    if (!oldHost) {
      throw createHostsError('Host not found', 404, 'HOST_NOT_FOUND', { hostId: id });
    }

    // Update host with new coordinates and set geocodedAt timestamp
    const host = await storage.updateHost(id, {
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      geocodedAt: new Date(),
    });

    if (!host) {
      throw createHostsError('Host not found', 404, 'HOST_NOT_FOUND', { hostId: id });
    }

    // Audit log
    await AuditLogger.logEntityChange(
      'hosts',
      String(id),
      oldHost,
      host,
      {
        userId: req.user?.id || req.session?.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        sessionId: req.sessionID
      }
    );

    res.json(host);
  })
);

  router.delete(
  '/hosts/:id',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  asyncHandler(async (req: any, res) => {
    const id = validateId(req.params.id, 'host');

    // Get old data before delete
    const oldHost = await storage.getHost(id);
    if (!oldHost) {
      throw createHostsError('Host not found', 404, 'HOST_NOT_FOUND', { hostId: id });
    }

    try {
      const success = await storage.deleteHost(id);
      if (!success) {
        throw createHostsError('Host not found', 404, 'HOST_NOT_FOUND', { hostId: id });
      }

      // Audit log
      await AuditLogger.logDelete(
        'hosts',
        String(id),
        oldHost,
        {
          userId: req.user?.id || req.session?.user?.id,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          sessionId: req.sessionID
        }
      );

      res.status(204).send();
    } catch (error: unknown) {
      // Check if it's a constraint error (has associated records)
      if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as any).message === 'string' &&
        (error as any).message.includes('associated collection')
      ) {
        throw createHostsError(
          (error as any).message,
          409,
          'CONSTRAINT_VIOLATION',
          { hostId: id, constraintType: 'associated_records' }
        );
      }
      throw error; // Re-throw to be handled by error handler
    }
  })
);

// Host contact routes
  router.get(
  '/host-contacts',
  requirePermission(PERMISSIONS.HOSTS_VIEW),
  asyncHandler(async (req, res) => {
    const hostId = req.query.hostId
      ? parseInt(req.query.hostId as string)
      : undefined;
      
    if (hostId && isNaN(hostId)) {
      throw createHostsError('Invalid host ID in query', 400, 'INVALID_HOST_ID', { providedHostId: req.query.hostId });
    }
    
    if (hostId) {
      const contacts = await storage.getHostContacts(hostId);
      res.json(contacts);
    } else {
      // Return all host contacts with their host location name
      const hosts = await storage.getAllHostsWithContacts();
      const allContacts = hosts.flatMap((host) => 
        host.contacts.map(contact => ({
          id: contact.id,
          name: contact.name,
          hostLocationName: host.name,
          displayName: `${contact.name} (${host.name})`,
          role: contact.role,
          email: contact.email,
          phone: contact.phone,
          hostId: contact.hostId,
        }))
      );
      res.json(allContacts);
    }
  })
);

  router.post(
  '/host-contacts',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  sanitizeMiddleware,
  asyncHandler(async (req: any, res) => {
    validateRequired(req.body, ['name', 'role', 'phone', 'hostId'], 'host contact creation');

    const result = insertHostContactSchema.safeParse(req.body);
    if (!result.success) {
      throw createHostsError(
        'Invalid host contact data provided',
        400,
        'VALIDATION_ERROR',
        { validationErrors: result.error.errors }
      );
    }

    const contact = await storage.createHostContact(result.data);

    // Audit log
    await AuditLogger.logCreate(
      'host_contacts',
      String(contact.id),
      contact,
      {
        userId: req.user?.id || req.session?.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        sessionId: req.sessionID
      }
    );

    res.status(201).json(contact);
  })
);

  router.patch(
  '/host-contacts/:id',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  sanitizeMiddleware,
  asyncHandler(async (req: any, res) => {
    const id = validateId(req.params.id, 'host contact');
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0) {
      throw createHostsError('No update data provided', 400, 'NO_UPDATE_DATA');
    }

    // Get old data before update
    const oldContact = await storage.getHostContact(id);
    if (!oldContact) {
      throw createHostsError('Host contact not found', 404, 'HOST_CONTACT_NOT_FOUND', { contactId: id });
    }

    const contact = await storage.updateHostContact(id, updates);
    if (!contact) {
      throw createHostsError('Host contact not found', 404, 'HOST_CONTACT_NOT_FOUND', { contactId: id });
    }

    // Audit log
    await AuditLogger.logEntityChange(
      'host_contacts',
      String(id),
      oldContact,
      contact,
      {
        userId: req.user?.id || req.session?.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        sessionId: req.sessionID
      }
    );

    res.json(contact);
  })
);

  router.delete(
  '/host-contacts/:id',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  asyncHandler(async (req: any, res) => {
    const id = validateId(req.params.id, 'host contact');

    // Get old data before delete
    const oldContact = await storage.getHostContact(id);
    if (!oldContact) {
      throw createHostsError('Host contact not found', 404, 'HOST_CONTACT_NOT_FOUND', { contactId: id });
    }

    const success = await storage.deleteHostContact(id);

    if (!success) {
      throw createHostsError('Host contact not found', 404, 'HOST_CONTACT_NOT_FOUND', { contactId: id });
    }

    // Audit log
    await AuditLogger.logDelete(
      'host_contacts',
      String(id),
      oldContact,
      {
        userId: req.user?.id || req.session?.user?.id,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        sessionId: req.sessionID
      }
    );

    res.status(204).send();
  })
);

// Weekly availability scraper endpoint
  router.post(
  '/scrape-availability',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  asyncHandler(async (req, res) => {
    const result = await scrapeHostAvailability();

    if (result.success) {
      res.json({
        message: 'Host availability updated successfully',
        ...result,
      });
    } else {
      throw createHostsError(
        'Host availability scrape failed',
        500,
        'SCRAPE_FAILED',
        { scrapeResult: result }
      );
    }
  })
);

  // Add error handling middleware for all routes
  router.use(hostsErrorHandler());

  return router;
}

