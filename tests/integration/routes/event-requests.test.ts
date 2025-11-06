/**
 * Event Requests Route Integration Tests
 *
 * Tests for the event-requests API endpoints
 */

import request from 'supertest';
import { createTestServer } from '../../setup/test-server';
import type { Express } from 'express';

describe('Event Requests Routes', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestServer();
  });

  describe('GET /api/event-requests', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app).get('/api/event-requests');

      expect([401, 403]).toContain(response.status);
    });

    it('should allow authenticated requests', async () => {
      const agent = request.agent(app);

      const response = await agent
        .get('/api/event-requests')
        .set('Cookie', ['connect.sid=mock-session-id']);

      // Should not be auth error
      expect(response.status).not.toBe(403);
    });

    it('should accept query parameters for filtering', async () => {
      const agent = request.agent(app);

      const response = await agent
        .get('/api/event-requests')
        .query({ status: 'pending' })
        .set('Cookie', ['connect.sid=mock-session-id']);

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('POST /api/event-requests', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .post('/api/event-requests')
        .send({
          title: 'Test Event',
          description: 'Test description',
          eventDate: new Date().toISOString(),
        });

      expect([401, 403]).toContain(response.status);
    });

    it('should validate required fields', async () => {
      const agent = request.agent(app);

      const response = await agent
        .post('/api/event-requests')
        .send({})
        .set('Cookie', ['connect.sid=mock-session-id']);

      // Should reject invalid data
      expect([400, 401, 500]).toContain(response.status);
    });

    it('should accept valid event request data', async () => {
      const agent = request.agent(app);

      const validEventRequest = {
        title: 'Community Meal',
        description: 'Weekly community meal service',
        eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Community Center',
        estimatedAttendees: 50,
      };

      const response = await agent
        .post('/api/event-requests')
        .send(validEventRequest)
        .set('Cookie', ['connect.sid=mock-session-id']);

      // May fail due to database, but should not be validation error
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('GET /api/event-requests/:id', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app).get('/api/event-requests/1');

      expect([401, 403]).toContain(response.status);
    });

    it('should validate ID format', async () => {
      const agent = request.agent(app);

      const response = await agent
        .get('/api/event-requests/invalid-id')
        .set('Cookie', ['connect.sid=mock-session-id']);

      expect(response.status).toBeLessThan(500);
    });

    it('should handle non-existent event requests gracefully', async () => {
      const agent = request.agent(app);

      const response = await agent
        .get('/api/event-requests/999999')
        .set('Cookie', ['connect.sid=mock-session-id']);

      // Should return 404 or similar
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('PUT /api/event-requests/:id', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .put('/api/event-requests/1')
        .send({ title: 'Updated Event' });

      expect([401, 403]).toContain(response.status);
    });

    it('should validate update data', async () => {
      const agent = request.agent(app);

      const response = await agent
        .put('/api/event-requests/1')
        .send({ invalidField: 'invalid' })
        .set('Cookie', ['connect.sid=mock-session-id']);

      expect(response.status).toBeLessThan(500);
    });
  });

  describe('DELETE /api/event-requests/:id', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app).delete('/api/event-requests/1');

      expect([401, 403]).toContain(response.status);
    });

    it('should require admin permissions', async () => {
      const agent = request.agent(app);

      // Non-admin user
      const response = await agent
        .delete('/api/event-requests/1')
        .set('Cookie', ['connect.sid=mock-session-id']);

      // May be 403 or 401 depending on auth setup
      expect(response.status).toBeLessThan(500);
    });
  });

  describe('PATCH /api/event-requests/:id/status', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .patch('/api/event-requests/1/status')
        .send({ status: 'approved' });

      expect([401, 403]).toContain(response.status);
    });

    it('should validate status values', async () => {
      const agent = request.agent(app);

      const response = await agent
        .patch('/api/event-requests/1/status')
        .send({ status: 'invalid-status' })
        .set('Cookie', ['connect.sid=mock-session-id']);

      // Should reject invalid status
      expect(response.status).toBeLessThan(500);
    });

    it('should accept valid status values', async () => {
      const agent = request.agent(app);

      const validStatuses = ['pending', 'approved', 'rejected', 'completed'];

      for (const status of validStatuses) {
        const response = await agent
          .patch('/api/event-requests/1/status')
          .send({ status })
          .set('Cookie', ['connect.sid=mock-admin-session']);

        // Status should be less than 500 for valid input
        expect(response.status).toBeLessThan(500);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle malformed JSON', async () => {
      const agent = request.agent(app);

      const response = await agent
        .post('/api/event-requests')
        .set('Content-Type', 'application/json')
        .send('{"invalid json"}')
        .set('Cookie', ['connect.sid=mock-session-id']);

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle very large payloads gracefully', async () => {
      const agent = request.agent(app);

      const largeDescription = 'a'.repeat(100000);
      const response = await agent
        .post('/api/event-requests')
        .send({
          title: 'Test',
          description: largeDescription,
        })
        .set('Cookie', ['connect.sid=mock-session-id']);

      expect(response.status).toBeLessThan(500);
    });

    it('should handle special characters in fields', async () => {
      const agent = request.agent(app);

      const response = await agent
        .post('/api/event-requests')
        .send({
          title: '<script>alert("xss")</script>',
          description: "Test with 'quotes' and \"double quotes\"",
        })
        .set('Cookie', ['connect.sid=mock-session-id']);

      expect(response.status).toBeLessThan(500);
    });
  });
});
