import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'node:util';

if (typeof (global as any).TextEncoder === 'undefined') {
  (global as any).TextEncoder = NodeTextEncoder;
}

if (typeof (global as any).TextDecoder === 'undefined') {
  (global as any).TextDecoder = NodeTextDecoder;
}

(global as any).IS_REACT_ACT_ENVIRONMENT = true;

import { seedTestData } from '../__tests__/setup';

const skipDbSetup = process.env.SKIP_DB_SETUP === 'true';

beforeAll(async () => {
  if (skipDbSetup) return;
  await seedTestData();
});

// Global test configuration
(global as any).API_BASE = 'http://localhost:5000';

// Helper function available to all tests
(global as any).loginUser = async (email: string, password: string) => {
  if (skipDbSetup) {
    throw new Error('loginUser is unavailable when SKIP_DB_SETUP=true');
  }

  const request = require('supertest');
  const response = await request((global as any).API_BASE)
    .post('/api/auth/login')
    .send({ email, password });

  if (response.status !== 200) {
    throw new Error(
      `Login failed for ${email}: ${response.body?.message || response.status}`
    );
  }

  return response.headers['set-cookie'][0];
};

// Add a small delay to prevent overwhelming the server
beforeEach(async () => {
  if (skipDbSetup) return;
  await new Promise((resolve) => setTimeout(resolve, 100));
});
