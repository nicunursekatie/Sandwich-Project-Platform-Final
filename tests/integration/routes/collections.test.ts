/**
 * Integration tests for the sandwich collections routes.
 *
 * These assert the REAL contract of the collections router as mounted at
 * `/api/sandwich-collections` (server/routes/index.ts) — not the historical
 * legacy api/collections paths, which were never registered.
 *
 * Contract notes (verified against server/routes/collections/index.ts):
 * - Auth is enforced at the mount via `isAuthenticated` (401 when unauthenticated).
 * - Reads (GET `/`, `/:id`, `/stats`) are NOT permission-gated — any
 *   authenticated user may read.
 * - `GET /` returns `{ collections, pagination }`; `GET /?eventRequestId=N`
 *   returns a bare array of that event's collections.
 * - `POST /` requires `COLLECTIONS_ADD`, returns 201 + the created row, and
 *   stamps `createdBy`. The real schema uses `hostName` + `individualSandwiches`
 *   (there is no `hostId` / `sandwichesCollected`).
 * - `PATCH /:id` and `DELETE /:id` use ownership permissions
 *   (`*_EDIT_OWN`/`*_EDIT_ALL`, `*_DELETE_OWN`/`*_DELETE_ALL`). DELETE returns 204.
 *
 * NOTE: these require a real Postgres (TEST_DATABASE_URL) and do not run in the
 * current CI (only the undefined-refs gate runs). They are written to pass when
 * the integration suite is executed against a database.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';
import type { Express } from 'express';
import { PERMISSIONS } from '../../../shared/auth-utils';
import { createTestServer, createAuthenticatedAgent } from '../../setup/test-server';

let app: Express;
let viewerAgent: request.SuperAgentTest; // authenticated, no collection permissions
let editorAgent: request.SuperAgentTest; // ADD + EDIT_OWN + DELETE_OWN
let otherEditorAgent: request.SuperAgentTest; // same perms, different user (non-owner)
let adminAgent: request.SuperAgentTest; // ADD + EDIT_ALL + DELETE_ALL

const EDITOR_PERMISSIONS = [
  PERMISSIONS.COLLECTIONS_ADD,
  PERMISSIONS.COLLECTIONS_EDIT_OWN,
  PERMISSIONS.COLLECTIONS_DELETE_OWN,
];
const ADMIN_PERMISSIONS = [
  PERMISSIONS.COLLECTIONS_ADD,
  PERMISSIONS.COLLECTIONS_EDIT_ALL,
  PERMISSIONS.COLLECTIONS_DELETE_ALL,
];

const BASE = '/api/sandwich-collections';

/** A minimal valid collection body for the real insert schema. */
function validCollection(overrides: Record<string, unknown> = {}) {
  return {
    hostName: 'Integration Test Host',
    collectionDate: '2025-10-25',
    individualSandwiches: 100,
    ...overrides,
  };
}

async function createCollection(
  agent: request.SuperAgentTest,
  overrides: Record<string, unknown> = {}
): Promise<Record<string, any>> {
  const response = await agent.post(BASE).send(validCollection(overrides));
  expect(response.status).toBe(201);
  return response.body;
}

describe('Sandwich Collections Routes', () => {
  beforeAll(async () => {
    app = await createTestServer();

    // createAuthenticatedAgent creates the user AND logs it in, so each agent
    // gets a distinct user. Permissions are granted explicitly rather than
    // relying on role defaults.
    viewerAgent = await createAuthenticatedAgent(app, {
      email: 'collections_viewer@example.com',
      permissions: [],
    });
    editorAgent = await createAuthenticatedAgent(app, {
      email: 'collections_editor@example.com',
      permissions: EDITOR_PERMISSIONS,
    });
    otherEditorAgent = await createAuthenticatedAgent(app, {
      email: 'collections_other_editor@example.com',
      permissions: EDITOR_PERMISSIONS,
    });
    adminAgent = await createAuthenticatedAgent(app, {
      email: 'collections_admin@example.com',
      permissions: ADMIN_PERMISSIONS,
    });
  });

  describe('GET /api/sandwich-collections', () => {
    it('should require authentication', async () => {
      const response = await request(app).get(BASE);
      expect(response.status).toBe(401);
    });

    it('should return a paginated object for an authenticated user', async () => {
      const response = await viewerAgent.get(BASE);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.collections)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it('should support pagination params', async () => {
      const response = await viewerAgent.get(BASE).query({ page: 1, limit: 10 });
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.collections)).toBe(true);
      expect(response.body.pagination.limit).toBe(10);
    });
  });

  describe('GET /api/sandwich-collections?eventRequestId=:id', () => {
    it('should return a bare array of collections for the event', async () => {
      const eventRequestId = 987654; // arbitrary; just needs to be linked
      const created = await createCollection(editorAgent, { eventRequestId });

      const response = await editorAgent.get(BASE).query({ eventRequestId });
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.some((c: any) => c.id === created.id)).toBe(true);
      expect(
        response.body.every((c: any) => c.eventRequestId === eventRequestId)
      ).toBe(true);
    });

    it('should reject a non-numeric eventRequestId', async () => {
      const response = await editorAgent
        .get(BASE)
        .query({ eventRequestId: 'not-a-number' });
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/sandwich-collections/stats', () => {
    it('should return aggregate statistics', async () => {
      const response = await viewerAgent.get(`${BASE}/stats`);
      expect(response.status).toBe(200);
      expect(typeof response.body.totalEntries).toBe('number');
      expect(typeof response.body.completeTotalSandwiches).toBe('number');
    });
  });

  describe('GET /api/sandwich-collections/:id', () => {
    it('should return a single collection', async () => {
      const created = await createCollection(editorAgent);
      const response = await editorAgent.get(`${BASE}/${created.id}`);
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(created.id);
      expect(response.body.hostName).toBe('Integration Test Host');
    });

    it('should return 400 for a non-numeric id', async () => {
      const response = await editorAgent.get(`${BASE}/not-a-number`);
      expect(response.status).toBe(400);
    });

    it('should return 404 for a non-existent collection', async () => {
      const response = await editorAgent.get(`${BASE}/999999`);
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/sandwich-collections', () => {
    it('should require authentication', async () => {
      const response = await request(app).post(BASE).send(validCollection());
      expect(response.status).toBe(401);
    });

    it('should deny a user without COLLECTIONS_ADD', async () => {
      const response = await viewerAgent.post(BASE).send(validCollection());
      expect(response.status).toBe(403);
    });

    it('should create a collection and stamp createdBy', async () => {
      const response = await editorAgent
        .post(BASE)
        .send(validCollection({ individualSandwiches: 100 }));
      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.hostName).toBe('Integration Test Host');
      expect(response.body.individualSandwiches).toBe(100);
      expect(response.body.createdBy).toBeTruthy();
    });

    it('should reject a body missing required fields', async () => {
      const response = await editorAgent
        .post(BASE)
        .send({ individualSandwiches: 10 }); // no hostName / collectionDate
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid collection data');
    });
  });

  describe('PATCH /api/sandwich-collections/:id', () => {
    it('should require authentication', async () => {
      const created = await createCollection(editorAgent);
      const response = await request(app)
        .patch(`${BASE}/${created.id}`)
        .send({ individualSandwiches: 150 });
      expect(response.status).toBe(401);
    });

    it('should let the owner edit their own collection (EDIT_OWN)', async () => {
      const created = await createCollection(editorAgent);
      const response = await editorAgent
        .patch(`${BASE}/${created.id}`)
        .send({ individualSandwiches: 150 });
      expect(response.status).toBe(200);
      expect(response.body.individualSandwiches).toBe(150);
    });

    it('should let an admin edit any collection (EDIT_ALL)', async () => {
      const created = await createCollection(editorAgent);
      const response = await adminAgent
        .patch(`${BASE}/${created.id}`)
        .send({ individualSandwiches: 200 });
      expect(response.status).toBe(200);
      expect(response.body.individualSandwiches).toBe(200);
    });

    it('should deny a non-owner who only has EDIT_OWN', async () => {
      const created = await createCollection(editorAgent);
      const response = await otherEditorAgent
        .patch(`${BASE}/${created.id}`)
        .send({ individualSandwiches: 175 });
      expect(response.status).toBe(403);
    });

    it('should return 404 for a non-existent collection (admin bypasses ownership)', async () => {
      const response = await adminAgent
        .patch(`${BASE}/999999`)
        .send({ individualSandwiches: 150 });
      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/sandwich-collections/:id', () => {
    it('should require authentication', async () => {
      const created = await createCollection(editorAgent);
      const response = await request(app).delete(`${BASE}/${created.id}`);
      expect(response.status).toBe(401);
    });

    it('should deny a non-owner who only has DELETE_OWN', async () => {
      const created = await createCollection(editorAgent);
      const response = await otherEditorAgent.delete(`${BASE}/${created.id}`);
      expect(response.status).toBe(403);
    });

    it('should let the owner delete their own collection (204)', async () => {
      const created = await createCollection(editorAgent);
      const response = await editorAgent.delete(`${BASE}/${created.id}`);
      expect(response.status).toBe(204);
    });

    it('should let an admin delete any collection (DELETE_ALL)', async () => {
      const created = await createCollection(editorAgent);
      const response = await adminAgent.delete(`${BASE}/${created.id}`);
      expect(response.status).toBe(204);
    });

    it('should return 404 for a non-existent collection (admin bypasses ownership)', async () => {
      const response = await adminAgent.delete(`${BASE}/999999`);
      expect(response.status).toBe(404);
    });
  });
});
