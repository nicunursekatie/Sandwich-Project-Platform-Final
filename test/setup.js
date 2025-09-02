// Test setup - runs before all tests

// Global test configuration
global.API_BASE = 'http://localhost:5000';

// Helper function available to all tests
global.loginUser = async (email, password) => {
  const request = require('supertest');
  const response = await request(global.API_BASE)
    .post('/api/auth/login')
    .send({ email, password });
  
  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${response.body?.message || response.status}`);
  }
  
  return response.headers['set-cookie'][0];
};

// Add a small delay to prevent overwhelming the server
beforeEach(async () => {
  await new Promise(resolve => setTimeout(resolve, 100));
});