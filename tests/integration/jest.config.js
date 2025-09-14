export default {
  rootDir: '../../',
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/tests/integration/setup.js'],
  testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
  collectCoverageFrom: [
    'server/routes/**/*.{js,ts}',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
};
