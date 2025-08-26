#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';

console.log('🚀 Starting custom build process...');

// Clean previous build
if (existsSync('dist')) {
  console.log('🧹 Cleaning previous build...');
  rmSync('dist', { recursive: true, force: true });
}

try {
  // Build frontend with Vite
  console.log('🔨 Building frontend with Vite...');
  execSync('vite build', { stdio: 'inherit' });

  // Build backend with esbuild, properly handling Google Cloud dependencies
  console.log('🔧 Building backend with esbuild...');
  const esbuildCommand = [
    'esbuild server/index.ts',
    '--platform=node',
    '--external:./vite.js',
    '--external:vite',
    '--external:@google-cloud/storage',
    '--external:@google-cloud/local-auth',
    '--external:googleapis', 
    '--external:@sendgrid/mail',
    '--external:@slack/web-api',
    '--external:twilio',
    '--external:@neondatabase/serverless',
    '--external:drizzle-orm',
    '--external:express',
    '--external:socket.io',
    '--external:passport',
    '--external:express-session',
    '--external:connect-pg-simple',
    '--packages=external',
    '--bundle',
    '--format=esm',
    '--outdir=dist'
  ].join(' ');

  execSync(esbuildCommand, { stdio: 'inherit' });

  console.log('✅ Build completed successfully!');
  console.log('📁 Output directory: dist/');
  console.log('🎯 Ready for deployment');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}