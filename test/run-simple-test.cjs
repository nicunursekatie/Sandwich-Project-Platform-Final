#!/usr/bin/env node

const { execSync } = require('child_process');

// Simple test runner for CommonJS
console.log('🧪 Running permission tests...');

try {
  // Run Jest with the test file we created
  execSync('npx jest test/unit/permission-logic.test.js --testTimeout=30000 --verbose', {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  console.log('✅ Backend permission tests completed!');
} catch (error) {
  console.error('❌ Backend tests failed:', error.message);
  process.exit(1);
}