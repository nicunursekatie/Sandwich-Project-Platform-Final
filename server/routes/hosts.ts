import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../storage-wrapper';
import { sanitizeMiddleware } from '../middleware/sanitizer';
import { insertHostSchema, insertHostContactSchema } from '@shared/schema';
import { hasPermission, PERMISSIONS } from '@shared/auth-utils';

const router = Router();

// Authentication middleware
const isAuthenticated = (req: any, res: any, next: any) => {
  const user = req.user || req.session?.user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  req.user = user; // Ensure req.user is set
  next();
};

// Permission check functions
function canManageHosts(req: any) {
  const user = req.user;
  return hasPermission(user, PERMISSIONS.HOSTS_EDIT);
}

function canViewHosts(req: any) {
  const user = req.user;
  return hasPermission(user, PERMISSIONS.HOSTS_VIEW);
}

// Host management routes
router.get('/hosts', isAuthenticated, async (req, res) => {
  // Check if user has permission to view hosts
  if (!canViewHosts(req)) {
    return res
      .status(403)
      .json({ error: 'Insufficient permissions to view hosts' });
  }
  try {
    const hosts = await storage.getAllHosts();
    res.json(hosts);
  } catch (error) {
    console.error('Error fetching hosts:', error);
    res.status(500).json({ error: 'Failed to fetch hosts' });
  }
});

router.get('/hosts-with-contacts', isAuthenticated, async (req, res) => {
  // Check if user has permission to view hosts
  if (!canViewHosts(req)) {
    return res
      .status(403)
      .json({ error: 'Insufficient permissions to view hosts' });
  }
  try {
    const hostsWithContacts = await storage.getAllHostsWithContacts();
    res.json(hostsWithContacts);
  } catch (error) {
    console.error('Error fetching hosts with contacts:', error);
    res.status(500).json({ error: 'Failed to fetch hosts with contacts' });
  }
});

router.get('/hosts/:id', isAuthenticated, async (req, res) => {
  // Check if user has permission to view hosts
  if (!canViewHosts(req)) {
    return res
      .status(403)
      .json({ error: 'Insufficient permissions to view hosts' });
  }
  try {
    const id = parseInt(req.params.id);
    const host = await storage.getHost(id);
    if (!host) {
      return res.status(404).json({ error: 'Host not found' });
    }
    res.json(host);
  } catch (error) {
    console.error('Error fetching host:', error);
    res.status(500).json({ error: 'Failed to fetch host' });
  }
});

router.post('/hosts', isAuthenticated, sanitizeMiddleware, async (req, res) => {
  // Check if user has permission to manage hosts
  if (!canManageHosts(req)) {
    return res
      .status(403)
      .json({ error: 'Insufficient permissions to create hosts' });
  }
  try {
    const result = insertHostSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.message });
    }
    const host = await storage.createHost(result.data);
    res.status(201).json(host);
  } catch (error) {
    console.error('Error creating host:', error);
    res.status(500).json({ error: 'Failed to create host' });
  }
});

router.patch(
  '/hosts/:id',
  isAuthenticated,
  sanitizeMiddleware,
  async (req, res) => {
    // Check if user has permission to manage hosts
    if (!canManageHosts(req)) {
      return res
        .status(403)
        .json({ error: 'Insufficient permissions to update hosts' });
    }
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const host = await storage.updateHost(id, updates);
      if (!host) {
        return res.status(404).json({ error: 'Host not found' });
      }
      res.json(host);
    } catch (error) {
      console.error('Error updating host:', error);
      res.status(500).json({ error: 'Failed to update host' });
    }
  }
);

router.delete('/hosts/:id', isAuthenticated, async (req, res) => {
  // Check if user has permission to manage hosts
  if (!canManageHosts(req)) {
    return res
      .status(403)
      .json({ error: 'Insufficient permissions to delete hosts' });
  }
  try {
    const id = parseInt(req.params.id);
    const success = await storage.deleteHost(id);
    if (!success) {
      return res.status(404).json({ error: 'Host not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting host:', error);
    // Check if it's a constraint error (has associated records)
    if (error.message && error.message.includes('associated collection')) {
      return res.status(409).json({
        error: error.message,
        code: 'CONSTRAINT_VIOLATION',
      });
    }
    res.status(500).json({ error: 'Failed to delete host' });
  }
});

// Host contact routes
router.get('/host-contacts', async (req, res) => {
  try {
    const hostId = req.query.hostId
      ? parseInt(req.query.hostId as string)
      : undefined;
    if (hostId) {
      const contacts = await storage.getHostContacts(hostId);
      res.json(contacts);
    } else {
      // Return all host contacts
      const hosts = await storage.getAllHostsWithContacts();
      const allContacts = hosts.flatMap((host) => host.contacts);
      res.json(allContacts);
    }
  } catch (error) {
    console.error('Error fetching host contacts:', error);
    res.status(500).json({ error: 'Failed to fetch host contacts' });
  }
});

router.post(
  '/host-contacts',
  isAuthenticated,
  sanitizeMiddleware,
  async (req, res) => {
    // Check if user has permission to manage hosts
    if (!canManageHosts(req)) {
      return res
        .status(403)
        .json({ error: 'Insufficient permissions to create host contacts' });
    }
    try {
      const result = insertHostContactSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.message });
      }
      const contact = await storage.createHostContact(result.data);
      res.status(201).json(contact);
    } catch (error) {
      console.error('Error creating host contact:', error);
      res.status(500).json({ error: 'Failed to create host contact' });
    }
  }
);

router.patch(
  '/host-contacts/:id',
  isAuthenticated,
  sanitizeMiddleware,
  async (req, res) => {
    // Check if user has permission to manage hosts
    if (!canManageHosts(req)) {
      return res
        .status(403)
        .json({ error: 'Insufficient permissions to update host contacts' });
    }
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const contact = await storage.updateHostContact(id, updates);
      if (!contact) {
        return res.status(404).json({ error: 'Host contact not found' });
      }
      res.json(contact);
    } catch (error) {
      console.error('Error updating host contact:', error);
      res.status(500).json({ error: 'Failed to update host contact' });
    }
  }
);

router.delete('/host-contacts/:id', isAuthenticated, async (req, res) => {
  // Check if user has permission to manage hosts
  if (!canManageHosts(req)) {
    return res
      .status(403)
      .json({ error: 'Insufficient permissions to delete host contacts' });
  }
  try {
    const id = parseInt(req.params.id);
    const success = await storage.deleteHostContact(id);
    if (!success) {
      return res.status(404).json({ error: 'Host contact not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting host contact:', error);
    res.status(500).json({ error: 'Failed to delete host contact' });
  }
});

export { router as hostsRoutes };
