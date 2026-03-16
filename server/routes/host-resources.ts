import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { storage } from '../storage';
import { insertHostResourceSchema } from '@shared/schema';
import { logger } from '../utils/production-safe-logger';
import { hostResourceUpload } from '../middleware/uploads';

const router = Router();

// GET all active host resources
router.get('/', async (_req, res) => {
  try {
    const resources = await storage.getHostResources();
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
    const isPdf = ext === '.pdf';

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
