import { Router, type Request, type Response } from 'express';
import { isAuthenticated } from '../auth';
import { logger } from '../middleware/logger';
import { createStandardMiddleware, createErrorHandler } from '../middleware';
import multer from 'multer';
import path from 'path';

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

// Create auto-form-filler router
const autoFormFillerRouter = Router();

// Apply standard middleware (authentication, logging, sanitization)
autoFormFillerRouter.use(createStandardMiddleware());

// Error handling for this module
const errorHandler = createErrorHandler('auto-form-filler');

// Helper function to get user from request
const getUser = (req: AuthenticatedRequest) => {
  return req.user || req.session?.user;
};

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and Word documents are allowed.'));
    }
  },
});

// POST /api/auto-form-filler/process - Process form filling
autoFormFillerRouter.post(
  '/process',
  isAuthenticated,
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = getUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { formType } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      if (!formType) {
        return res.status(400).json({ error: 'Form type is required' });
      }

      logger.info('Processing auto form filler request', {
        userId: user.id,
        formType,
        fileName: file.originalname,
        fileSize: file.size,
      });

      // TODO: Implement actual form filling logic
      // This is a placeholder response for now
      const result = {
        success: true,
        formType,
        fileName: file.originalname,
        extractedData: {
          // Mock data for demonstration
          organizationName: 'The Sandwich Project',
          contactName: `${user.firstName} ${user.lastName}`,
          email: user.email,
          date: new Date().toISOString().split('T')[0],
        },
        filledFormUrl: null, // Will be populated when actual implementation is added
        message: 'Form processing is not yet implemented. This is a placeholder response.',
      };

      return res.json(result);
    } catch (error) {
      logger.error('Error processing form:', error);
      return errorHandler(error, req, res);
    }
  }
);

// GET /api/auto-form-filler/supported-types - Get list of supported form types
autoFormFillerRouter.get(
  '/supported-types',
  isAuthenticated,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = getUser(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const supportedTypes = [
        {
          id: 'service_hours',
          name: 'Service Hours Form',
          description: 'Track volunteer service hours',
        },
        {
          id: 'event_request',
          name: 'Event Request Form',
          description: 'Request new events or presentations',
        },
        {
          id: 'volunteer_application',
          name: 'Volunteer Application',
          description: 'New volunteer registration',
        },
        {
          id: 'host_agreement',
          name: 'Host Agreement',
          description: 'Host location partnership forms',
        },
        {
          id: 'grant_application',
          name: 'Grant Application',
          description: 'Grant and funding applications',
        },
        {
          id: 'custom',
          name: 'Custom Form',
          description: 'Any other custom form template',
        },
      ];

      return res.json(supportedTypes);
    } catch (error) {
      logger.error('Error fetching supported types:', error);
      return errorHandler(error, req, res);
    }
  }
);

export default autoFormFillerRouter;
