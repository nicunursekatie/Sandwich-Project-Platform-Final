module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  verbose: true,
  collectCoverage: false,
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  testTimeout: 30000
};