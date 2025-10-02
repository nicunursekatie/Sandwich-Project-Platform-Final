import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import type { IStorage } from '../storage';
import { isAuthenticated, getUser, type AuthenticatedRequest } from '../auth';
import { logger } from '../logger';

const documentsRouter = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'documents');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'image/jpeg',
      'image/png',
      'image/gif',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  },
});

export function createDocumentsRouter(storage: IStorage): Router {
  // GET all documents (filtered by user permissions)
  documentsRouter.get(
    '/',
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const user = getUser(req);
        if (!user) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const documents = await storage.getDocumentsForUser(user.id);
        res.json(documents);
      } catch (error) {
        logger.error('Failed to fetch documents', error);
        res.status(500).json({ message: 'Failed to fetch documents' });
      }
    }
  );

  // GET single document
  documentsRouter.get(
    '/:id',
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const user = getUser(req);
        if (!user) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: 'Invalid document ID' });
        }

        // Check if user has access
        const hasAccess = await storage.checkUserDocumentAccess(
          id,
          user.id,
          'view'
        );
        if (!hasAccess) {
          return res.status(403).json({ message: 'Access denied' });
        }

        const document = await storage.getDocument(id);
        if (!document) {
          return res.status(404).json({ message: 'Document not found' });
        }

        // Log the access
        await storage.logDocumentAccess({
          documentId: id,
          userId: user.id,
          userName: user.fullName || user.id,
          action: 'view',
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });

        res.json(document);
      } catch (error) {
        logger.error('Failed to fetch document', error);
        res.status(500).json({ message: 'Failed to fetch document' });
      }
    }
  );

  // POST upload new document
  documentsRouter.post(
    '/',
    isAuthenticated,
    upload.single('file'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const user = getUser(req);
        if (!user) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!req.file) {
          return res.status(400).json({ message: 'No file uploaded' });
        }

        const { title, description, category } = req.body;

        if (!title) {
          return res.status(400).json({ message: 'Title is required' });
        }

        const document = await storage.createDocument({
          title,
          description: description || null,
          fileName: req.file.filename,
          originalName: req.file.originalname,
          filePath: req.file.path,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          category: category || 'general',
          uploadedBy: user.id,
          uploadedByName: user.fullName || user.id,
          isActive: true,
        });

        // Grant uploader full permissions
        await storage.grantDocumentPermission({
          documentId: document.id,
          userId: user.id,
          permissionType: 'manage',
          grantedBy: user.id,
          grantedByName: user.fullName || user.id,
          isActive: true,
        });

        // Log the upload
        await storage.logDocumentAccess({
          documentId: document.id,
          userId: user.id,
          userName: user.fullName || user.id,
          action: 'upload',
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
        });

        res.status(201).json(document);
      } catch (error) {
        logger.error('Failed to upload document', error);
        res.status(500).json({ message: 'Failed to upload document' });
      }
    }
  );

  // PUT update document
  documentsRouter.put(
    '/:id',
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const user = getUser(req);
        if (!user) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: 'Invalid document ID' });
        }

        // Check if user has manage permission
        const hasAccess = await storage.checkUserDocumentAccess(
          id,
          user.id,
          'manage'
        );
        if (!hasAccess) {
          return res.status(403).json({ message: 'Access denied' });
        }

        const { title, description, category, isActive } = req.body;

        const updated = await storage.updateDocument(id, {
          title,
          description,
          category,
          isActive,
        });

        if (!updated) {
          return res.status(404).json({ message: 'Document not found' });
        }

        res.json(updated);
      } catch (error) {
        logger.error('Failed to update document', error);
        res.status(500).json({ message: 'Failed to update document' });
      }
    }
  );

  // DELETE document
  documentsRouter.delete(
    '/:id',
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const user = getUser(req);
        if (!user) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: 'Invalid document ID' });
        }

        // Check if user has manage permission
        const hasAccess = await storage.checkUserDocumentAccess(
          id,
          user.id,
          'manage'
        );
        if (!hasAccess) {
          return res.status(403).json({ message: 'Access denied' });
        }

        const deleted = await storage.deleteDocument(id);
        if (!deleted) {
          return res.status(404).json({ message: 'Document not found' });
        }

        res.status(204).send();
      } catch (error) {
        logger.error('Failed to delete document', error);
        res.status(500).json({ message: 'Failed to delete document' });
      }
    }
  );

  // GET document permissions
  documentsRouter.get(
    '/:id/permissions',
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const user = getUser(req);
        if (!user) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: 'Invalid document ID' });
        }

        // Check if user has manage permission
        const hasAccess = await storage.checkUserDocumentAccess(
          id,
          user.id,
          'manage'
        );
        if (!hasAccess) {
          return res.status(403).json({ message: 'Access denied' });
        }

        const permissions = await storage.getDocumentPermissions(id);
        res.json(permissions);
      } catch (error) {
        logger.error('Failed to fetch document permissions', error);
        res
          .status(500)
          .json({ message: 'Failed to fetch document permissions' });
      }
    }
  );

  // POST grant permission
  documentsRouter.post(
    '/:id/permissions',
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const user = getUser(req);
        if (!user) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: 'Invalid document ID' });
        }

        // Check if user has manage permission
        const hasAccess = await storage.checkUserDocumentAccess(
          id,
          user.id,
          'manage'
        );
        if (!hasAccess) {
          return res.status(403).json({ message: 'Access denied' });
        }

        const { userId, permissionType, expiresAt, notes } = req.body;

        if (!userId || !permissionType) {
          return res
            .status(400)
            .json({ message: 'userId and permissionType are required' });
        }

        const permission = await storage.grantDocumentPermission({
          documentId: id,
          userId,
          permissionType,
          grantedBy: user.id,
          grantedByName: user.fullName || user.id,
          expiresAt: expiresAt || null,
          notes: notes || null,
          isActive: true,
        });

        res.status(201).json(permission);
      } catch (error) {
        logger.error('Failed to grant document permission', error);
        res.status(500).json({ message: 'Failed to grant permission' });
      }
    }
  );

  // DELETE revoke permission
  documentsRouter.delete(
    '/:id/permissions/:permissionId',
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const user = getUser(req);
        if (!user) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const id = parseInt(req.params.id);
        const permissionId = parseInt(req.params.permissionId);

        if (isNaN(id) || isNaN(permissionId)) {
          return res.status(400).json({ message: 'Invalid ID' });
        }

        // Check if user has manage permission
        const hasAccess = await storage.checkUserDocumentAccess(
          id,
          user.id,
          'manage'
        );
        if (!hasAccess) {
          return res.status(403).json({ message: 'Access denied' });
        }

        const revoked = await storage.revokeDocumentPermission(
          permissionId,
          user.id
        );
        if (!revoked) {
          return res.status(404).json({ message: 'Permission not found' });
        }

        res.status(204).send();
      } catch (error) {
        logger.error('Failed to revoke document permission', error);
        res.status(500).json({ message: 'Failed to revoke permission' });
      }
    }
  );

  // GET access logs
  documentsRouter.get(
    '/:id/access-logs',
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const user = getUser(req);
        if (!user) {
          return res.status(401).json({ message: 'Unauthorized' });
        }

        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: 'Invalid document ID' });
        }

        // Check if user has manage permission
        const hasAccess = await storage.checkUserDocumentAccess(
          id,
          user.id,
          'manage'
        );
        if (!hasAccess) {
          return res.status(403).json({ message: 'Access denied' });
        }

        const logs = await storage.getDocumentAccessLogs(id);
        res.json(logs);
      } catch (error) {
        logger.error('Failed to fetch access logs', error);
        res.status(500).json({ message: 'Failed to fetch access logs' });
      }
    }
  );

  return documentsRouter;
}

export default documentsRouter;
