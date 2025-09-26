import express, { type RequestHandler } from 'express';
import request from 'supertest';

import createProjectRoutes from '../../server/routes/projects';
import type { IStorage } from '../../server/storage';
import { PERMISSIONS } from '../../shared/auth-utils';

interface TestProject {
  id: number;
  status: string;
  createdBy: string;
  assigneeId?: string | null;
  assigneeIds?: string[] | null;
  assigneeName?: string | null;
  title?: string;
  description?: string | null;
}

class MockStorage {
  private currentProject: TestProject;

  constructor(project: TestProject) {
    this.currentProject = { ...project };
  }

  async getProject(id: number): Promise<any> {
    if (id !== this.currentProject.id) {
      return null;
    }

    return { ...this.currentProject };
  }

  async updateProject(
    id: number,
    updates: any
  ): Promise<any> {
    if (id !== this.currentProject.id) {
      return null;
    }

    this.currentProject = {
      ...this.currentProject,
      ...updates,
    };

    return { ...this.currentProject };
  }
}

function createProjectTestContext(overrides: Partial<TestProject> = {}) {
  const baseProject: TestProject = {
    id: 1,
    title: 'Mock Project',
    description: 'Initial description',
    status: 'waiting',
    createdBy: 'creator-1',
    assigneeId: 'assigned-owner',
    assigneeIds: ['assigned-owner', 'own-editor'],
    assigneeName: null,
    ...overrides,
  };

  const storage = new MockStorage(baseProject);

  const users = {
    'assigned-owner': {
      id: 'assigned-owner',
      email: 'assigned@example.com',
      role: 'volunteer',
      permissions: [PERMISSIONS.PROJECTS_ADD],
    },
    'own-editor': {
      id: 'own-editor',
      email: 'editor@example.com',
      role: 'volunteer',
      permissions: [PERMISSIONS.PROJECTS_EDIT_OWN],
    },
    'non-assignee': {
      id: 'non-assignee',
      email: 'viewer@example.com',
      role: 'volunteer',
      permissions: [PERMISSIONS.PROJECTS_ADD],
    },
  } as const;

  const isAuthenticated: RequestHandler = (req, res, next) => {
    const userKey = req.header('x-test-user') as keyof typeof users | undefined;
    if (!userKey) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = users[userKey];
    if (!user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    (req as any).user = user;
    return next();
  };

  const requirePermissionStub = () => ((_req, _res, next) => next()) as RequestHandler;

  const app = express();
  app.use(express.json());
  app.use(
    '/api/projects',
    createProjectRoutes({
      storage: storage as unknown as IStorage,
      isAuthenticated,
      requirePermission: requirePermissionStub,
    })
  );

  return { app, storage, users };
}

describe('PATCH /api/projects/:id permissions', () => {
  test('allows assigned user with project creation rights to update project', async () => {
    const { app } = createProjectTestContext();

    const response = await request(app)
      .patch('/api/projects/1')
      .set('x-test-user', 'assigned-owner')
      .send({ status: 'in_progress' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('in_progress');
  });

  test('denies non-assigned user editing without full permissions', async () => {
    const { app, storage } = createProjectTestContext();

    const response = await request(app)
      .patch('/api/projects/1')
      .set('x-test-user', 'non-assignee')
      .send({ status: 'in_progress' });

    expect(response.status).toBe(403);

    const latest = await storage.getProject(1);
    expect(latest?.status).toBe('waiting');
  });

  test('allows assigned user with edit-own permission to update project', async () => {
    const { app } = createProjectTestContext();

    const response = await request(app)
      .patch('/api/projects/1')
      .set('x-test-user', 'own-editor')
      .send({ description: 'Updated via edit-own assignment' });

    expect(response.status).toBe(200);
    expect(response.body.description).toBe('Updated via edit-own assignment');
  });
});
