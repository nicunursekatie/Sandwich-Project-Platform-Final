/**
 * Firebase Configuration
 * Server-side Firebase initialization for the migration from Replit
 *
 * This replaces the Replit Object Storage sidecar integration.
 */

import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getStorage, Storage } from 'firebase-admin/storage';
import { logger } from './utils/production-safe-logger';

let firebaseApp: App | null = null;
let firebaseStorage: Storage | null = null;

/**
 * Initialize Firebase Admin SDK
 * Uses service account credentials from environment variable
 */
export function initializeFirebase(): App {
  if (firebaseApp) {
    return firebaseApp;
  }

  // Check if already initialized
  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseApp = existingApps[0];
    return firebaseApp;
  }

  try {
    // Get service account from environment (base64 encoded JSON)
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (serviceAccountBase64) {
      // Decode base64 service account JSON
      const serviceAccountJson = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
      const serviceAccount = JSON.parse(serviceAccountJson);

      firebaseApp = initializeApp({
        credential: cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${serviceAccount.project_id}.appspot.com`,
      });

      logger.log('✅ Firebase Admin SDK initialized with service account');
    } else {
      // Try using application default credentials (for Google Cloud environments)
      firebaseApp = initializeApp({
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      });

      logger.log('✅ Firebase Admin SDK initialized with application default credentials');
    }

    return firebaseApp;
  } catch (error) {
    logger.error('❌ Failed to initialize Firebase Admin SDK:', error);
    throw new Error(`Firebase initialization failed: ${(error as Error).message}`);
  }
}

/**
 * Get Firebase Storage instance
 */
export function getFirebaseStorage(): Storage {
  if (firebaseStorage) {
    return firebaseStorage;
  }

  initializeFirebase();
  firebaseStorage = getStorage();
  return firebaseStorage;
}

/**
 * Check if Firebase is configured
 */
export function isFirebaseConfigured(): boolean {
  return !!(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FIREBASE_STORAGE_BUCKET
  );
}

/**
 * Get Firebase project configuration from environment
 */
export function getFirebaseConfig() {
  return {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  };
}
