#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import request from 'supertest';

// Global test helpers
global.loginUser = async (email, password) => {
  const API_BASE = 'http://localhost:5000';
  
  const response = await request(API_BASE)
    .post('/api/auth/login')
    .send({ email, password });
    
  if (response.status !== 200) {
    throw new Error(`Login failed for ${email}: ${response.status}`);
  }
  
  // Extract cookies from response
  const cookies = response.headers['set-cookie'];
  if (!cookies) {
    throw new Error('No cookies returned from login');
  }
  
  return cookies.join('; ');
};

// Set up Jest environment
process.env.NODE_ENV = 'test';

try {
  console.log('🧪 Starting comprehensive test suite...');
  
  // Run all tests
  execSync('npx jest --testTimeout=30000 --verbose', {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  console.log('✅ All tests completed successfully!');
} catch (error) {
  console.error('❌ Test suite failed:', error.message);
  process.exit(1);
}