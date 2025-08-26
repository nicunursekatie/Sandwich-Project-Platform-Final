#!/usr/bin/env node

import { createRequire } from 'module';
import { readFileSync } from 'fs';

const require = createRequire(import.meta.url);

// Deployment verification script to ensure all Google Cloud dependencies are available
console.log('🔍 Verifying deployment readiness...');

const requiredDeps = [
  '@google-cloud/storage',
  '@google-cloud/local-auth',
  'googleapis',
  '@sendgrid/mail',
  '@neondatabase/serverless',
  'drizzle-orm',
  'express',
  'socket.io'
];

let allPresent = true;

console.log('\n📦 Checking critical dependencies:');
for (const dep of requiredDeps) {
  try {
    require.resolve(dep);
    console.log(`✅ ${dep}`);
  } catch (error) {
    console.error(`❌ ${dep} - MISSING`);
    allPresent = false;
  }
}

console.log('\n🗂️  Checking package.json entries:');
const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

for (const dep of requiredDeps) {
  if (deps[dep]) {
    console.log(`✅ ${dep}: ${deps[dep]}`);
  } else {
    console.error(`❌ ${dep} - NOT IN package.json`);
    allPresent = false;
  }
}

if (allPresent) {
  console.log('\n🎉 All dependencies verified! Deployment should succeed.');
  process.exit(0);
} else {
  console.error('\n❌ Missing dependencies detected. Deployment may fail.');
  process.exit(1);
}