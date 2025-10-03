/**
 * Integration Tests for Modularized Routes
 * Tests all CRUD operations for event reminders, drivers, and volunteers
 */

const request = require('supertest');
const { app } = require('../../server/index.ts');

describe('Route Integration Tests', () => {
  let authCookie;

  beforeAll(async () => {
    // Set up test authentication
    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'admin@sandwich.project',
      password: 'admin123',
    });

    authCookie = loginResponse.headers['set-cookie'];
  });

  describe('Event Reminders API', () => {
    let reminderId;

    test('GET /api/event-reminders/count - should return count', async () => {
      const response = await request(app)
        .get('/api/event-reminders/count')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('count');
      expect(typeof response.body.count).toBe('number');
    });

    test('GET /api/event-reminders - should return reminders array', async () => {
      const response = await request(app)
        .get('/api/event-reminders')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /api/event-reminders - should create new reminder', async () => {
      const reminderData = {
        eventRequestId: 1,
        title: 'Test Reminder',
        description: 'Test reminder for integration test',
        reminderType: 'follow_up',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        assignedToUserId: 'admin_1756853839752',
        assignedToName: 'Admin User',
        priority: 'high',
        createdBy: 'admin_1756853839752',
      };

      const response = await request(app)
        .post('/api/event-reminders')
        .set('Cookie', authCookie)
        .send(reminderData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(reminderData.title);
      expect(response.body.status).toBe('pending');

      reminderId = response.body.id;
    });

    test('PUT /api/event-reminders/:id - should update reminder', async () => {
      const updates = {
        status: 'completed',
        completionNotes: 'Test completion notes',
      };

      const response = await request(app)
        .put(`/api/event-reminders/${reminderId}`)
        .set('Cookie', authCookie)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');
      expect(response.body.completionNotes).toBe(updates.completionNotes);
      expect(response.body.completedAt).toBeTruthy();
    });

    test('DELETE /api/event-reminders/:id - should delete reminder', async () => {
      const response = await request(app)
        .delete(`/api/event-reminders/${reminderId}`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(204);
    });

    test('GET /api/event-reminders/:id - should return 404 for deleted reminder', async () => {
      const response = await request(app)
        .get(`/api/event-reminders/${reminderId}`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(404);
    });
  });

  describe('Drivers API', () => {
    let driverId;

    test('GET /api/drivers - should return drivers array', async () => {
      const response = await request(app)
        .get('/api/drivers')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /api/drivers - should create new driver', async () => {
      const driverData = {
        name: 'Test Driver',
        email: 'testdriver@example.com',
        phone: '555-0123',
        vehicleType: 'sedan',
        agreementSigned: true,
        notes: 'Integration test driver',
      };

      const response = await request(app)
        .post('/api/drivers')
        .set('Cookie', authCookie)
        .send(driverData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(driverData.name);
      expect(response.body.email).toBe(driverData.email);

      driverId = response.body.id;
    });

    test('GET /api/drivers/:id - should return specific driver', async () => {
      const response = await request(app)
        .get(`/api/drivers/${driverId}`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(driverId);
      expect(response.body.name).toBe('Test Driver');
    });

    test('PUT /api/drivers/:id - should update driver', async () => {
      const updates = {
        phone: '555-9999',
        vehicleType: 'suv',
        notes: 'Updated notes',
      };

      const response = await request(app)
        .put(`/api/drivers/${driverId}`)
        .set('Cookie', authCookie)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.phone).toBe(updates.phone);
      expect(response.body.vehicleType).toBe(updates.vehicleType);
    });

    test('PATCH /api/drivers/:id - should partially update driver', async () => {
      const updates = { notes: 'Patch update notes' };

      const response = await request(app)
        .patch(`/api/drivers/${driverId}`)
        .set('Cookie', authCookie)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.notes).toBe(updates.notes);
    });

    test('DELETE /api/drivers/:id - should delete driver', async () => {
      const response = await request(app)
        .delete(`/api/drivers/${driverId}`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(204);
    });
  });

  describe('Volunteers API', () => {
    let volunteerId;

    test('GET /api/volunteers - should return volunteers array', async () => {
      const response = await request(app)
        .get('/api/volunteers')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /api/volunteers - should create new volunteer', async () => {
      const volunteerData = {
        name: 'Test Volunteer',
        email: 'testvolunteer@example.com',
        phone: '555-0456',
        hostId: 1,
        notes: 'Integration test volunteer',
      };

      const response = await request(app)
        .post('/api/volunteers')
        .set('Cookie', authCookie)
        .send(volunteerData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(volunteerData.name);
      expect(response.body.email).toBe(volunteerData.email);

      volunteerId = response.body.id;
    });

    test('GET /api/volunteers/:id - should return specific volunteer', async () => {
      const response = await request(app)
        .get(`/api/volunteers/${volunteerId}`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(volunteerId);
      expect(response.body.name).toBe('Test Volunteer');
    });

    test('PATCH /api/volunteers/:id - should update volunteer', async () => {
      const updates = {
        phone: '555-7777',
        notes: 'Updated volunteer notes',
      };

      const response = await request(app)
        .patch(`/api/volunteers/${volunteerId}`)
        .set('Cookie', authCookie)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.phone).toBe(updates.phone);
      expect(response.body.notes).toBe(updates.notes);
    });

    test('GET /api/volunteers/export - should export CSV', async () => {
      const response = await request(app)
        .get('/api/volunteers/export')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.text).toContain('ID,Name,Email,Phone');
    });

    test('DELETE /api/volunteers/:id - should delete volunteer', async () => {
      const response = await request(app)
        .delete(`/api/volunteers/${volunteerId}`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(204);
    });
  });

  describe('Hosts API', () => {
    let hostId;

    test('GET /api/hosts - should return hosts array', async () => {
      const response = await request(app)
        .get('/api/hosts')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('GET /api/hosts-with-contacts - should return hosts with contacts', async () => {
      const response = await request(app)
        .get('/api/hosts-with-contacts')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /api/hosts - should create new host', async () => {
      const hostData = {
        name: 'Test Host Organization',
        address: '123 Test Street',
        city: 'Test City',
        state: 'TX',
        zipCode: '12345',
        isActive: true,
        notes: 'Integration test host',
      };

      const response = await request(app)
        .post('/api/hosts')
        .set('Cookie', authCookie)
        .send(hostData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(hostData.name);

      hostId = response.body.id;
    });

    test('GET /api/hosts/:id - should return specific host', async () => {
      const response = await request(app)
        .get(`/api/hosts/${hostId}`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(hostId);
      expect(response.body.name).toBe('Test Host Organization');
    });

    test('PATCH /api/hosts/:id - should update host', async () => {
      const updates = {
        city: 'Updated City',
        notes: 'Updated host notes',
      };

      const response = await request(app)
        .patch(`/api/hosts/${hostId}`)
        .set('Cookie', authCookie)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.city).toBe(updates.city);
    });

    test('DELETE /api/hosts/:id - should delete host', async () => {
      const response = await request(app)
        .delete(`/api/hosts/${hostId}`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(204);
    });
  });

  describe('Wishlist Suggestions API', () => {
    let suggestionId;

    test('GET /api/wishlist-suggestions - should return suggestions array', async () => {
      const response = await request(app)
        .get('/api/wishlist-suggestions')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('POST /api/wishlist-suggestions - should create new suggestion', async () => {
      const suggestionData = {
        item: 'Integration Test Item',
        reason: 'Ensuring wishlist suggestions route works',
        priority: 'high',
      };

      const response = await request(app)
        .post('/api/wishlist-suggestions')
        .set('Cookie', authCookie)
        .send(suggestionData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.item).toBe(suggestionData.item);
      expect(response.body.priority).toBe(suggestionData.priority);
      expect(response.body.status).toBe('pending');

      suggestionId = response.body.id;
    });

    test('PATCH /api/wishlist-suggestions/:id - should update suggestion status', async () => {
      const updates = {
        status: 'approved',
        adminNotes: 'Approved during integration test',
      };

      const response = await request(app)
        .patch(`/api/wishlist-suggestions/${suggestionId}`)
        .set('Cookie', authCookie)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe(updates.status);
      expect(response.body.adminNotes).toBe(updates.adminNotes);
      expect(response.body.reviewedAt).toBeTruthy();
    });

    test('GET /api/wishlist-activity - should return wishlist activity', async () => {
      const response = await request(app)
        .get('/api/wishlist-activity')
        .set('Cookie', authCookie);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('DELETE /api/wishlist-suggestions/:id - should delete suggestion', async () => {
      const response = await request(app)
        .delete(`/api/wishlist-suggestions/${suggestionId}`)
        .set('Cookie', authCookie);

      expect(response.status).toBe(204);
    });
  });

  describe('Authentication Protection', () => {
    test('Endpoints should require authentication', async () => {
      const endpoints = [
        'GET /api/event-reminders',
        'POST /api/event-reminders',
        'GET /api/drivers',
        'POST /api/drivers',
        'GET /api/volunteers',
        'POST /api/volunteers',
        'GET /api/hosts',
        'POST /api/hosts',
        'GET /api/wishlist-suggestions',
        'POST /api/wishlist-suggestions',
        'PATCH /api/wishlist-suggestions/1',
        'GET /api/wishlist-activity',
        'DELETE /api/wishlist-suggestions/1',
      ];

      for (const endpoint of endpoints) {
        const [method, path] = endpoint.split(' ');
        const response = await request(app)[method.toLowerCase()](path);

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty(
          'message',
          'Authentication required'
        );
      }
    });
  });
});
