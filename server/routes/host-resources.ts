import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { storage } from '../storage';
import { insertHostResourceSchema } from '@shared/schema';
import { logger } from '../utils/production-safe-logger';
import { hostResourceUpload } from '../middleware/uploads';

const router = Router();

// Default resources to seed into the database on first fetch
const DEFAULT_RESOURCES = [
  { title: 'TSP Host Handbook', description: 'Complete guide for host collection sites — everything you need to know about hosting a sandwich collection', category: 'document', fileType: 'PDF', fileUrl: '/documents/tsp-host-handbook.pdf', fileName: 'tsp-host-handbook.pdf', sortOrder: 1, isActive: true },
  { title: 'Deli Sandwich Labels', description: 'Pre-formatted labels for deli meat sandwiches with ingredient info', category: 'document', fileType: 'PDF', fileUrl: '/documents/deli-labels.pdf', fileName: 'deli-labels.pdf', sortOrder: 2, isActive: true },
  { title: 'PB&J Sandwich Labels', description: 'Pre-formatted labels for peanut butter & jelly sandwiches', category: 'document', fileType: 'PDF', fileUrl: '/documents/pbj-labels.pdf', fileName: 'pbj-labels.pdf', sortOrder: 3, isActive: true },
  { title: 'Volunteer Sign-In Sheet', description: 'Sign-in sheet for tracking volunteer attendance at your site', category: 'document', fileType: 'PDF', fileUrl: '/documents/volunteer-sign-in-sheet.pdf', fileName: 'volunteer-sign-in-sheet.pdf', sortOrder: 4, isActive: true },
  { title: 'Food Safety for Hosts', description: 'Food safety guidelines and best practices for host collection sites', category: 'document', fileType: 'PDF', fileUrl: '/documents/food-safety-hosts.pdf', fileName: 'food-safety-hosts.pdf', sortOrder: 5, isActive: true },
  { title: 'Deli Sandwich Making 101', description: 'Step-by-step guide for making deli sandwiches', category: 'document', fileType: 'PDF', fileUrl: '/documents/deli-sandwich-making-101.pdf', fileName: 'deli-sandwich-making-101.pdf', sortOrder: 6, isActive: true },
  { title: 'PB&J Sandwich Making 101', description: 'Step-by-step guide for making peanut butter & jelly sandwiches', category: 'document', fileType: 'PDF', fileUrl: '/documents/pbj-sandwich-making-101.pdf', fileName: 'pbj-sandwich-making-101.pdf', sortOrder: 7, isActive: true },
  { title: 'Deli Sandwich Assembly', description: 'Deli sandwich assembly guide with portion sizes in ounces', category: 'image', fileType: 'JPEG', fileUrl: '/images/sandwich-assembly.jpeg', fileName: 'deli-sandwich-assembly-ounces.jpeg', sortOrder: 1, isActive: true },
  { title: 'White Bread Sandwich', description: 'Complete sandwich with white bread - bread, cheese, meat, cheese, bread', category: 'image', fileType: 'PNG', fileUrl: '/images/sandwich-white-bread.png', fileName: 'sandwich-white-bread.png', sortOrder: 2, isActive: true },
  { title: 'Why Cheese on the Bottom', description: 'Cheese acts as a moisture barrier to keep bread from getting soggy', category: 'image', fileType: 'PNG', fileUrl: '/images/why-cheese-bottom.png', fileName: 'why-cheese-bottom.png', sortOrder: 3, isActive: true },
  { title: 'PB&J Assembly', description: 'Peanut butter on both slices, jelly on one - 3 easy steps', category: 'image', fileType: 'PNG', fileUrl: '/images/pbj-assembly.png', fileName: 'pbj-assembly.png', sortOrder: 4, isActive: true },
];

let seeded = false;

// GET all active host resources (seeds default data on first empty fetch)
router.get('/', async (_req, res) => {
  try {
    let resources = await storage.getHostResources();

    // Auto-seed default resources if DB is empty (first load)
    if (resources.length === 0 && !seeded) {
      seeded = true;
      logger.info('Seeding default host resources into database');
      for (const item of DEFAULT_RESOURCES) {
        try {
          await storage.createHostResource(item);
        } catch (err) {
          logger.error(`Failed to seed resource: ${item.title}`, err);
        }
      }
      resources = await storage.getHostResources();
    }

    res.json(resources);
  } catch (error) {
    logger.error('Failed to get host resources', error);
    res.status(500).json({ message: 'Failed to get host resources' });
  }
});

// POST upload a file and create a new host resource
router.post('/upload', hostResourceUpload.single('file'), async (req: any, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { title, description, category } = req.body;
    if (!title || !description || !category) {
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      return res.status(400).json({ message: 'Title, description, and category are required' });
    }

    // Determine destination directory based on category
    const ext = path.extname(file.originalname).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);


    // Sanitize filename: lowercase, replace spaces with hyphens, remove special chars
    const sanitizedName = file.originalname
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-_.]/g, '');

    // Determine the target directory
    const subDir = isImage ? 'images' : 'documents';
    const publicDir = path.resolve('client/public', subDir);

    // Ensure target directory exists
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    const destPath = path.join(publicDir, sanitizedName);

    // Move file from temp upload to public directory
    fs.copyFileSync(file.path, destPath);
    fs.unlinkSync(file.path);

    // Determine file type label
    let fileType = ext.replace('.', '').toUpperCase();
    if (fileType === 'JPG') fileType = 'JPEG';

    const fileUrl = `/${subDir}/${sanitizedName}`;

    // Get next sort order
    const existing = await storage.getHostResources();
    const maxOrder = existing
      .filter(r => r.category === category)
      .reduce((max, r) => Math.max(max, r.sortOrder), 0);

    // Create database record
    const resource = await storage.createHostResource({
      title,
      description,
      category,
      fileType,
      fileUrl,
      fileName: sanitizedName,
      sortOrder: maxOrder + 1,
      isActive: true,
    });

    res.status(201).json(resource);
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    logger.error('Failed to upload host resource', error);
    res.status(500).json({ message: 'Failed to upload host resource' });
  }
});

// POST create a new host resource (without file upload - for links)
router.post('/', async (req: any, res) => {
  try {
    const data = insertHostResourceSchema.parse(req.body);
    const resource = await storage.createHostResource(data);
    res.status(201).json(resource);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ message: 'Invalid data', errors: error.errors });
    } else {
      logger.error('Failed to create host resource', error);
      res.status(500).json({ message: 'Failed to create host resource' });
    }
  }
});

// PATCH update a host resource
router.patch('/:id', async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const resource = await storage.updateHostResource(id, req.body);
    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }
    res.json(resource);
  } catch (error) {
    logger.error('Failed to update host resource', error);
    res.status(500).json({ message: 'Failed to update host resource' });
  }
});

// DELETE a host resource
router.delete('/:id', async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const resource = await storage.getHostResource(id);
    if (!resource) {
      return res.status(404).json({ message: 'Resource not found' });
    }
    const success = await storage.deleteHostResource(id);
    if (!success) {
      return res.status(500).json({ message: 'Failed to delete resource' });
    }
    res.json({ message: 'Resource deleted' });
  } catch (error) {
    logger.error('Failed to delete host resource', error);
    res.status(500).json({ message: 'Failed to delete host resource' });
  }
});

export default router;
