/**
 * App URL Utility
 * Provides consistent URL generation across different deployment environments
 *
 * Replaces Replit-specific domain detection with a more generic approach.
 */

import { logger } from './production-safe-logger';

/**
 * Detect the current deployment environment
 */
export function detectDeploymentEnvironment(): 'replit' | 'firebase' | 'cloudrun' | 'local' | 'production' {
  // Check for Replit environment
  if (process.env.REPL_ID || process.env.REPLIT_DEPLOYMENT) {
    return 'replit';
  }

  // Check for Firebase/Google Cloud
  if (process.env.FIREBASE_CONFIG || process.env.GCLOUD_PROJECT) {
    return process.env.K_SERVICE ? 'cloudrun' : 'firebase';
  }

  // Check for local development
  if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
    return 'local';
  }

  return 'production';
}

/**
 * Get the public-facing URL of the application
 * This is used for generating links in emails, SMS messages, etc.
 *
 * Priority order:
 * 1. PUBLIC_APP_URL environment variable (explicit override)
 * 2. APP_URL environment variable
 * 3. Auto-detection based on environment
 */
export function getAppUrl(): string {
  // Priority 1: Explicit PUBLIC_APP_URL
  if (process.env.PUBLIC_APP_URL) {
    return process.env.PUBLIC_APP_URL.replace(/\/$/, ''); // Remove trailing slash
  }

  // Priority 2: General APP_URL
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '');
  }

  // Priority 3: Auto-detect based on environment
  const env = detectDeploymentEnvironment();

  switch (env) {
    case 'replit':
      // Try various Replit domain variables
      const replitDomain =
        process.env.REPLIT_DOMAIN ||
        process.env.REPLIT_DOMAINS?.split(',')[0] ||
        process.env.REPL_SLUG;

      if (replitDomain) {
        // Ensure it's a full URL
        if (replitDomain.startsWith('http')) {
          return replitDomain.replace(/\/$/, '');
        }
        return `https://${replitDomain}`;
      }
      break;

    case 'firebase':
      // Firebase Hosting typically uses projectId.web.app
      const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
      if (projectId) {
        return `https://${projectId}.web.app`;
      }
      break;

    case 'cloudrun':
      // Cloud Run service URL
      const cloudRunUrl = process.env.CLOUD_RUN_URL || process.env.K_SERVICE;
      if (cloudRunUrl) {
        if (cloudRunUrl.startsWith('http')) {
          return cloudRunUrl.replace(/\/$/, '');
        }
        // K_SERVICE is just the service name, need to construct the URL
        const region = process.env.CLOUD_RUN_REGION || 'us-central1';
        const projectId2 = process.env.GCLOUD_PROJECT;
        if (projectId2) {
          return `https://${cloudRunUrl}-${projectId2}.${region}.run.app`;
        }
      }
      break;

    case 'local':
      // Local development
      const port = process.env.PORT || '5000';
      return `http://localhost:${port}`;
  }

  // Final fallback - try to construct from request headers in runtime
  // This will be handled by getAppUrlFromRequest()
  logger.warn('Unable to determine app URL from environment. Set PUBLIC_APP_URL or APP_URL environment variable.');
  return 'http://localhost:5000';
}

/**
 * Get app URL from an Express request object
 * Useful when you need the URL based on the actual incoming request
 */
export function getAppUrlFromRequest(req: { protocol: string; get: (header: string) => string | undefined }): string {
  // Check for explicit override first
  if (process.env.PUBLIC_APP_URL) {
    return process.env.PUBLIC_APP_URL.replace(/\/$/, '');
  }

  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, '');
  }

  // Construct from request
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('x-forwarded-host') || req.get('host') || 'localhost';

  return `${protocol}://${host}`;
}

/**
 * Generate a full URL for a given path
 */
export function getFullUrl(path: string): string {
  const baseUrl = getAppUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Check if we're running in a production environment
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if we're running in Replit
 */
export function isReplit(): boolean {
  return detectDeploymentEnvironment() === 'replit';
}
