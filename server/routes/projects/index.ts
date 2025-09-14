import { Router, type Request, type Response } from 'express';
import {
  createProjectService,
  type ProjectService,
} from '../../services/projects';
import { createErrorHandler, projectFilesUpload } from '../../middleware';
import { logger } from '../../middleware/logger';
import type { IStorage } from '../../storage';

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

// Factory function to create project routes
export default function createProjectRoutes(options: {
  storage: IStorage;
  isAuthenticated: any;
  requirePermission: any;
}): Router {
  const projectsRouter = Router();
  const { storage, isAuthenticated, requirePermission } = options;

  // Create project service instance
  const projectService = createProjectService(storage);

  // Error handling for this module (standard middleware applied at mount level)
  const errorHandler = createErrorHandler('projects');

  // Helper function to get user from request
  const getUser = (req: AuthenticatedRequest) => {
    return req.user || req.session?.user;
  };

  // GET / - List all projects
  projectsRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const projects = await projectService.getAllProjects();
      res.json(projects);
    } catch (error) {
      logger.error('Failed to fetch projects', error);
      res.status(500).json({ message: 'Failed to fetch projects' });
    }
  });

  // GET /archived - Get archived projects
  projectsRouter.get(
    '/archived',
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const archivedProjects = await projectService.getArchivedProjects();
        res.json(archivedProjects);
      } catch (error) {
        logger.error('Failed to fetch archived projects', error);
        res.status(500).json({ message: 'Failed to fetch archived projects' });
      }
    }
  );

  // POST / - Create new project
  projectsRouter.post(
    '/',
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const user = getUser(req);
        if (!user) {
          return res.status(401).json({ message: 'Authentication required' });
        }

        console.log('Received project data:', req.body);

        const project = await projectService.createProject({
          data: req.body,
          user,
        });

        console.log('Created project:', project);
        res.status(201).json(project);
      } catch (error) {
        console.error('Project creation error details:', error);
        logger.error('Failed to create project', error);

        const message =
          error instanceof Error ? error.message : 'Unknown error';
        const status = message.includes('Permission denied') ? 403 : 400;

        res.status(status).json({
          message: status === 403 ? message : 'Invalid project data',
          error: message,
        });
      }
    }
  );

  // POST /:id/claim - Claim a project
  projectsRouter.post(
    '/:id/claim',
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const { assigneeName } = req.body;

        const updatedProject = await projectService.claimProject(
          id,
          assigneeName
        );

        if (!updatedProject) {
          return res.status(404).json({ message: 'Project not found' });
        }

        res.json(updatedProject);
      } catch (error) {
        logger.error('Failed to claim project', error);
        res.status(500).json({ message: 'Failed to claim project' });
      }
    }
  );

  // PUT /:id - Full project update (requires special permission)
  projectsRouter.put(
    '/:id',
    requirePermission('PROJECTS_EDIT_ALL'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const user = getUser(req);

        if (!user) {
          return res.status(401).json({ message: 'Authentication required' });
        }

        const updatedProject = await projectService.updateProject({
          id,
          updates: req.body,
          user,
        });

        if (!updatedProject) {
          return res.status(404).json({ message: 'Project not found' });
        }

        res.json(updatedProject);
      } catch (error) {
        logger.error('Failed to update project', error);

        const message =
          error instanceof Error ? error.message : 'Failed to update project';
        const status = message.includes('Permission denied') ? 403 : 500;

        res.status(status).json({ message });
      }
    }
  );

  // PATCH /:id - Partial project update
  projectsRouter.patch(
    '/:id',
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const updates = req.body;
        const user = getUser(req);

        if (!user) {
          return res.status(401).json({ message: 'Authentication required' });
        }

        console.log('=== PROJECT PATCH DEBUG ===');
        console.log('Project ID:', id);
        console.log('Updates received:', updates);
        console.log('Support People value:', updates.supportPeople);
        console.log('User:', user.email);

        const updatedProject = await projectService.updateProject({
          id,
          updates,
          user,
        });

        if (!updatedProject) {
          console.log('Failed to update project in storage');
          return res.status(404).json({ message: 'Project not found' });
        }

        console.log(
          'Project updated successfully:',
          updatedProject.supportPeople
        );
        res.json(updatedProject);
      } catch (error) {
        console.error('=== PROJECT PATCH ERROR ===');
        console.error('Error details:', error);
        logger.error('Failed to update project', error);

        const message =
          error instanceof Error ? error.message : 'Failed to update project';
        const status = message.includes('Permission denied') ? 403 : 500;

        res.status(status).json({ message });
      }
    }
  );

  // DELETE /:id - Delete project
  projectsRouter.delete(
    '/:id',
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const user = getUser(req);

        if (!user) {
          return res.status(401).json({ message: 'Authentication required' });
        }

        if (isNaN(id)) {
          return res.status(400).json({ message: 'Invalid project ID' });
        }

        const deleted = await projectService.deleteProject(id, user);
        if (!deleted) {
          return res.status(404).json({ message: 'Project not found' });
        }

        res.status(204).send();
      } catch (error) {
        logger.error('Failed to delete project', error);

        const message =
          error instanceof Error ? error.message : 'Failed to delete project';
        const status = message.includes('Permission denied') ? 403 : 500;

        res.status(status).json({ message });
      }
    }
  );

  // POST /:id/archive - Archive completed project
  projectsRouter.post(
    '/:id/archive',
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const user = getUser(req);

        if (!user) {
          return res.status(401).json({ message: 'Authentication required' });
        }

        if (isNaN(id)) {
          return res.status(400).json({ message: 'Invalid project ID' });
        }

        const archived = await projectService.archiveProject(id, user);
        if (!archived) {
          return res.status(500).json({ message: 'Failed to archive project' });
        }

        res.json({ message: 'Project archived successfully' });
      } catch (error) {
        logger.error('Failed to archive project', error);

        const message =
          error instanceof Error ? error.message : 'Failed to archive project';
        const status = message.includes('Permission denied')
          ? 403
          : message.includes('not found')
            ? 404
            : message.includes('Only completed')
              ? 400
              : 500;

        res.status(status).json({ message });
      }
    }
  );

  // GET /:id - Get single project by ID
  projectsRouter.get(
    '/:id',
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: 'Invalid project ID' });
        }

        const project = await projectService.getProjectById(id);
        if (!project) {
          return res.status(404).json({ message: 'Project not found' });
        }

        res.json(project);
      } catch (error) {
        logger.error('Failed to fetch project', error);
        res.status(500).json({ message: 'Failed to fetch project' });
      }
    }
  );

  // GET /:id/tasks - Get tasks for a project
  projectsRouter.get(
    '/:id/tasks',
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const projectId = parseInt(req.params.id);
        if (isNaN(projectId)) {
          return res.status(400).json({ message: 'Invalid project ID' });
        }

        const tasks = await projectService.getProjectTasks(projectId);
        res.json(tasks);
      } catch (error) {
        logger.error('Failed to fetch project tasks', error);
        res.status(500).json({ message: 'Failed to fetch tasks' });
      }
    }
  );

  // POST /:id/tasks - Create task for a project
  projectsRouter.post(
    '/:id/tasks',
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const projectId = parseInt(req.params.id);
        const user = getUser(req);

        if (!user) {
          return res.status(401).json({ message: 'Authentication required' });
        }

        if (isNaN(projectId)) {
          return res.status(400).json({ message: 'Invalid project ID' });
        }

        const task = await projectService.createProjectTask(
          projectId,
          req.body,
          user
        );
        res.status(201).json(task);
      } catch (error) {
        logger.error('Failed to create project task', error);

        const message =
          error instanceof Error ? error.message : 'Failed to create task';
        const status = message.includes('Permission denied') ? 403 : 400;

        res.status(status).json({ message });
      }
    }
  );

  // POST /:id/files - Upload files for a project
  projectsRouter.post(
    '/:id/files',
    isAuthenticated,
    projectFilesUpload.array('files'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const projectId = parseInt(req.params.id);
        const user = getUser(req);

        if (!user) {
          return res.status(401).json({ message: 'Authentication required' });
        }

        if (isNaN(projectId)) {
          return res.status(400).json({ message: 'Invalid project ID' });
        }

        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          return res.status(400).json({ message: 'No files uploaded' });
        }

        // Process uploaded files and return metadata
        const fileMetadata = files.map((file) => ({
          name: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          path: file.path,
          uploadedAt: new Date().toISOString(),
        }));

        res.status(201).json({
          message: 'Files uploaded successfully',
          files: fileMetadata,
        });
      } catch (error) {
        logger.error('Failed to upload project files', error);
        res.status(500).json({ message: 'Failed to upload files' });
      }
    }
  );

  // GET /:id/files - Get project files
  projectsRouter.get(
    '/:id/files',
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const projectId = parseInt(req.params.id);
        if (isNaN(projectId)) {
          return res.status(400).json({ message: 'Invalid project ID' });
        }

        // TODO: Implement actual file retrieval from storage
        // For now, return empty array as the original route does
        res.json([]);
      } catch (error) {
        logger.error('Failed to fetch project files', error);
        res.status(500).json({ message: 'Failed to fetch files' });
      }
    }
  );

  // Apply error handling middleware
  projectsRouter.use(errorHandler);

  return projectsRouter;
}

// Standalone router creation for direct use
export function createStandaloneProjectRoutes(
  storage: IStorage,
  middleware: {
    isAuthenticated: any;
    requirePermission: any;
  }
): Router {
  return createProjectRoutes({
    storage,
    isAuthenticated: middleware.isAuthenticated,
    requirePermission: middleware.requirePermission,
  });
}
