/**
 * Jest Setup for Integration Tests
 *
 * Runs before all tests to set up the test environment
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'test-secret';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test';

// Increase timeout for integration tests
jest.setTimeout(10000);

// Mock external services if needed
beforeAll(() => {
  // Mock SendGrid email service
  jest.mock('@sendgrid/mail', () => ({
    setApiKey: jest.fn(),
    send: jest.fn().mockResolvedValue([{ statusCode: 202 }]),
  }));

  // Mock Google services if needed
  jest.mock('googleapis', () => ({
    google: {
      auth: {
        GoogleAuth: jest.fn(),
      },
    },
  }));
});

// Clean up after all tests
afterAll(async () => {
  // Close database connections
  // await db.end();
});
