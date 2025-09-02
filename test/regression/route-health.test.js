const request = require('supertest');

const API_BASE = 'http://localhost:5000';

describe('Route Health Regression Tests', () => {
  let adminCookie;

  beforeAll(async () => {
    // Get admin session for authenticated routes
    const loginResponse = await request(API_BASE)
      .post('/api/auth/login')
      .send({ email: 'admin@sandwich.project', password: 'password123' });
    
    adminCookie = loginResponse.headers['set-cookie'][0];
  });

  // Test that all critical routes are still working
  const CRITICAL_ROUTES = [
    { path: '/api/projects', method: 'GET', name: 'Projects List' },
    { path: '/api/meetings', method: 'GET', name: 'Meetings List' },
    { path: '/api/users', method: 'GET', name: 'Users List' },
    { path: '/api/auth/user', method: 'GET', name: 'Current User' },
    { path: '/api/projects/for-review', method: 'GET', name: 'Projects for Review' },
    { path: '/api/hosts', method: 'GET', name: 'Hosts List' },
    { path: '/api/recipients', method: 'GET', name: 'Recipients List' },
    { path: '/api/drivers', method: 'GET', name: 'Drivers List' }
  ];

  CRITICAL_ROUTES.forEach(route => {
    test(`${route.method} ${route.path} - ${route.name} should not return 500`, async () => {
      let req = request(API_BASE);
      
      if (route.method === 'GET') req = req.get(route.path);
      else if (route.method === 'POST') req = req.post(route.path);
      
      const response = await req.set('Cookie', adminCookie);
      
      // Should not be a server error (500)
      expect(response.status).not.toBe(500);
      
      // Should be either success (200-299) or permission denied (403) or not found (404)
      expect([200, 201, 204, 304, 401, 403, 404]).toContain(response.status);
    });
  });

  test('Server responds to basic health check', async () => {
    const response = await request(API_BASE).get('/');
    expect(response.status).not.toBe(500);
  });

  test('Authentication middleware is working', async () => {
    // Test unauthenticated request
    const noAuthResponse = await request(API_BASE).get('/api/projects');
    expect(noAuthResponse.status).toBe(401);

    // Test authenticated request
    const authResponse = await request(API_BASE)
      .get('/api/projects')
      .set('Cookie', adminCookie);
    expect(authResponse.status).toBe(200);
  });

  test('CORS headers are present', async () => {
    const response = await request(API_BASE).get('/api/projects');
    expect(response.headers['access-control-allow-origin']).toBeDefined();
  });
});