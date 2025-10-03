import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import type { IStorage } from '../storage';
import {
  isAuthenticated,
  getUser,
  type AuthenticatedRequest,
} from '../temp-auth';
import { logger } from '../middleware/logger';
import { createStandardMiddleware, createErrorHandler } from '../middleware';
import { storage } from '../storage-wrapper';

// Type definitions for authentication
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    permissions?: string[];
  };
  session?: {
    user?: {
      id: string;
      email: string;
      firstName?: string;
      lastName?: string;
      role?: string;
      permissions?: string[];
    };
  };
}

// Custom multer configuration for documents
const documentsUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = 'server/uploads/documents';
      // Ensure the directory exists
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename while preserving extension
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const baseName = path.basename(file.originalname, ext);
      const uniqueFilename = `${baseName}-${uniqueSuffix}${ext}`;
      cb(null, uniqueFilename);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/csv',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'File type not supported. Supported types: PDF, Word, Excel, PowerPoint, images, text, and CSV files.'
        )
      );
    }
  },
});

// Create documents router
const documentsRouter = Router();

// Apply standard middleware (authentication, logging, sanitization)
documentsRouter.use(createStandardMiddleware());

// Error handling for this module
const errorHandler = createErrorHandler('documents');

// Helper function to get user from request
const getUser = (req: AuthenticatedRequest) => {
  return req.user || req.session?.user;
};

// POST /api/documents - Upload new document
documentsRouter.post(
  '/',
  documentsUpload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = getUser(req);

      if (!user || !user.email) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { title, description, category } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      logger.info(
        `Document upload by ${user.email}: "${title}" (${req.file.originalname})`
      );

      const documentData = {
        title,
        description: description || null,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        category: category || 'general',
        isActive: true,
        uploadedBy: user.id,
        uploadedByName:
          user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.email,
      };

      const document = await storage.createDocument(documentData);

      logger.info(
        `Document created successfully: ID ${document.id} - "${document.title}"`
      );

      res.status(201).json({ document });
    } catch (error: any) {
      logger.error('Error creating document:', error);

      // Clean up uploaded file if document creation failed
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
          logger.info(`Cleaned up uploaded file: ${req.file.path}`);
        } catch (cleanupError) {
          logger.error('Error cleaning up uploaded file:', cleanupError);
        }
      }

      res.status(500).json({ error: 'Failed to create document' });
    }
  }
);

// GET /api/documents/:id/download - Download specific document
documentsRouter.get(
  '/:id/download',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = getUser(req);

      if (!user || !user.email) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const documentId = parseInt(req.params.id);

      if (isNaN(documentId)) {
        return res.status(400).json({ error: 'Invalid document ID' });
      }

      logger.info(
        `Document download attempt by ${user.email}: document ID ${documentId}`
      );

      // Get all documents and find the requested one
      const documents = await storage.getAllDocuments();
      const document = documents.find((doc) => doc.id === documentId);

      if (!document) {
        logger.warn(
          `Document not found: ID ${documentId} requested by ${user.email}`
        );
        return res.status(404).json({ error: 'Document not found' });
      }

      // Check if document is active
      if (!document.isActive) {
        logger.warn(
          `Inactive document access attempt: ID ${documentId} by ${user.email}`
        );
        return res.status(403).json({ error: 'Document is not active' });
      }

      // Check if file exists on disk
      if (!fs.existsSync(document.filePath)) {
        logger.error(`File not found on disk: ${document.filePath}`);
        return res.status(404).json({ error: 'File not found on server' });
      }

      // Log the download access
      logger.info(
        `Document download success: ${user.email} downloaded document ID ${documentId} - "${document.originalName}"`
      );

      // Set appropriate headers for file download
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${document.originalName}"`
      );
      res.setHeader(
        'Content-Type',
        document.mimeType || 'application/octet-stream'
      );
      res.setHeader('Content-Length', document.fileSize);

      // Stream the file to the client
      const fileStream = fs.createReadStream(document.filePath);
      fileStream.pipe(res);
    } catch (error: any) {
      logger.error('Error downloading document:', error);
      res.status(500).json({ error: 'Failed to download document' });
    }
  }
);

// DELETE /api/documents/:id - Delete document
documentsRouter.delete(
  '/:id',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = getUser(req);

      if (!user || !user.email) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const documentId = parseInt(req.params.id);

      if (isNaN(documentId)) {
        return res.status(400).json({ error: 'Invalid document ID' });
      }

      logger.info(
        `Document delete attempt by ${user.email}: document ID ${documentId}`
      );

      // Get the document first to verify access and get file path
      const documents = await storage.getAllDocuments();
      const document = documents.find((doc) => doc.id === documentId);

      if (!document) {
        logger.warn(
          `Document not found for deletion: ID ${documentId} by ${user.email}`
        );
        return res.status(404).json({ error: 'Document not found' });
      }

      // Check if user has permission to delete (uploader or admin)
      if (document.uploadedBy !== user.id && user.role !== 'admin') {
        logger.warn(
          `Unauthorized delete attempt: ${user.email} tried to delete document ID ${documentId}`
        );
        return res
          .status(403)
          .json({
            error: 'Only the uploader or admin can delete this document',
          });
      }

      // Mark document as inactive in database
      // Since there's no deleteDocument method, we'll just mark as inactive by updating it
      // For now, we'll just delete the file and return success
      // TODO: Add proper soft delete in storage layer

      // Clean up the file from disk
      if (fs.existsSync(document.filePath)) {
        try {
          fs.unlinkSync(document.filePath);
          logger.info(`Deleted file: ${document.filePath}`);
        } catch (fileError) {
          logger.error('Error deleting file:', fileError);
          return res
            .status(500)
            .json({ error: 'Failed to delete document file' });
        }
      }

      logger.info(
        `Document deleted: ${user.email} deleted document ID ${documentId} - "${document.title}"`
      );

      res.json({ success: true, message: 'Document deleted successfully' });
    } catch (error: any) {
      logger.error('Error deleting document:', error);
      res.status(500).json({ error: 'Failed to delete document' });
    }
  }
);

// GET /api/documents/:id/permissions - Get document permissions (stub for future implementation)
documentsRouter.get(
  '/:id/permissions',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = getUser(req);

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // For now, return empty array - permissions system not yet implemented
      res.json([]);
    } catch (error: any) {
      logger.error('Error fetching permissions:', error);
      res.status(500).json({ error: 'Failed to fetch permissions' });
    }
  }
);

// POST /api/documents/:id/permissions - Grant document permission (stub for future implementation)
documentsRouter.post(
  '/:id/permissions',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = getUser(req);

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // For now, return success - permissions system not yet implemented
      res.json({ success: true, message: 'Permissions feature coming soon' });
    } catch (error: any) {
      logger.error('Error granting permission:', error);
      res.status(500).json({ error: 'Failed to grant permission' });
    }
  }
);

// DELETE /api/documents/:id/permissions/:userId/:permissionType - Revoke permission (stub)
documentsRouter.delete(
  '/:id/permissions/:userId/:permissionType',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = getUser(req);

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // For now, return success - permissions system not yet implemented
      res.json({ success: true, message: 'Permissions feature coming soon' });
    } catch (error: any) {
      logger.error('Error revoking permission:', error);
      res.status(500).json({ error: 'Failed to revoke permission' });
    }
  }
);

// GET /api/documents/:id/access-logs - Get document access logs (stub for future implementation)
documentsRouter.get(
  '/:id/access-logs',
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = getUser(req);

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // For now, return empty array - access logs not yet implemented
      res.json([]);
    } catch (error: any) {
      logger.error('Error fetching access logs:', error);
      res.status(500).json({ error: 'Failed to fetch access logs' });
    }
  }
);

// Apply error handling middleware
documentsRouter.use(errorHandler);

export default documentsRouter;
