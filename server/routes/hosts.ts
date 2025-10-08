import { Router } from 'express';
import { storage } from '../storage-wrapper';
import { sanitizeMiddleware } from '../middleware/sanitizer';
import { insertHostSchema, insertHostContactSchema } from '@shared/schema';
import { PERMISSIONS } from '@shared/auth-utils';
import { requirePermission } from '../middleware/auth';
import { scrapeHostAvailability } from '../services/host-availability-scraper';
import {
  hostsErrorHandler,
  asyncHandler,
  createHostsError,
  validateId,
  validateRequired,
  HostsError,
} from './hosts/error-handler';

const router = Router();

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
  asyncHandler(async (req, res) => {
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
    res.status(201).json(host);
  })
);

router.patch(
  '/hosts/:id',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  sanitizeMiddleware,
  asyncHandler(async (req, res) => {
    const id = validateId(req.params.id, 'host');
    const updates = req.body;
    
    if (!updates || Object.keys(updates).length === 0) {
      throw createHostsError('No update data provided', 400, 'NO_UPDATE_DATA');
    }
    
    const host = await storage.updateHost(id, updates);
    if (!host) {
      throw createHostsError('Host not found', 404, 'HOST_NOT_FOUND', { hostId: id });
    }
    res.json(host);
  })
);

router.delete(
  '/hosts/:id',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  asyncHandler(async (req, res) => {
    const id = validateId(req.params.id, 'host');
    
    try {
      const success = await storage.deleteHost(id);
      if (!success) {
        throw createHostsError('Host not found', 404, 'HOST_NOT_FOUND', { hostId: id });
      }
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
      // Return all host contacts
      const hosts = await storage.getAllHostsWithContacts();
      const allContacts = hosts.flatMap((host) => host.contacts);
      res.json(allContacts);
    }
  })
);

router.post(
  '/host-contacts',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  sanitizeMiddleware,
  asyncHandler(async (req, res) => {
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
    res.status(201).json(contact);
  })
);

router.patch(
  '/host-contacts/:id',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  sanitizeMiddleware,
  asyncHandler(async (req, res) => {
    const id = validateId(req.params.id, 'host contact');
    const updates = req.body;

    if (!updates || Object.keys(updates).length === 0) {
      throw createHostsError('No update data provided', 400, 'NO_UPDATE_DATA');
    }

    const contact = await storage.updateHostContact(id, updates);
    if (!contact) {
      throw createHostsError('Host contact not found', 404, 'HOST_CONTACT_NOT_FOUND', { contactId: id });
    }
    res.json(contact);
  })
);

router.delete(
  '/host-contacts/:id',
  requirePermission(PERMISSIONS.HOSTS_EDIT),
  asyncHandler(async (req, res) => {
    const id = validateId(req.params.id, 'host contact');
    const success = await storage.deleteHostContact(id);
    if (!success) {
      throw createHostsError('Host contact not found', 404, 'HOST_CONTACT_NOT_FOUND', { contactId: id });
    }
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

export { router as hostsRoutes };
