/**
 * Storage Adapter
 * Provides a unified interface for file storage that works with both
 * Replit Object Storage and Firebase Storage.
 *
 * This adapter automatically detects the environment and uses the appropriate
 * storage backend, allowing for a gradual migration.
 */

import { Response } from 'express';
import { logger } from './utils/production-safe-logger';

// Storage backend type
type StorageBackend = 'replit' | 'firebase' | 'none';

/**
 * Detect which storage backend is available
 */
function detectStorageBackend(): StorageBackend {
  // Check for Firebase configuration first (preferred for migration)
  const hasFirebase = !!(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FIREBASE_STORAGE_BUCKET
  );

  // Check for Replit Object Storage (legacy)
  const hasReplit = !!(
    process.env.PUBLIC_OBJECT_SEARCH_PATHS ||
    process.env.PRIVATE_OBJECT_DIR
  );

  // Also check if we're running in Replit environment
  const isReplitEnv = !!(
    process.env.REPL_ID ||
    process.env.REPLIT_DEPLOYMENT
  );

  if (hasFirebase) {
    logger.log('📦 Storage backend: Firebase Storage');
    return 'firebase';
  }

  if (hasReplit && isReplitEnv) {
    logger.log('📦 Storage backend: Replit Object Storage');
    return 'replit';
  }

  logger.warn('⚠️ No storage backend configured');
  return 'none';
}

// Cache the detected backend
let detectedBackend: StorageBackend | null = null;

function getStorageBackend(): StorageBackend {
  if (detectedBackend === null) {
    detectedBackend = detectStorageBackend();
  }
  return detectedBackend;
}

/**
 * Unified Storage Service Interface
 */
export interface IStorageService {
  getPublicObjectSearchPaths(): string[];
  getPrivateObjectDir(): string;
  searchPublicObject(filePath: string): Promise<any | null>;
  downloadObject(file: any, res: Response, cacheTtlSec?: number): Promise<void>;
  getObjectEntityUploadURL(): Promise<string>;
  uploadLocalFile(localFilePath: string, destKey: string): Promise<string>;
  getSignedViewUrl(storageUrl: string, ttlSeconds?: number): Promise<string>;
}

/**
 * Get the appropriate storage service based on environment
 */
export async function getStorageService(): Promise<IStorageService> {
  const backend = getStorageBackend();

  switch (backend) {
    case 'firebase': {
      const { firebaseStorageService } = await import('./firebase-storage');
      return firebaseStorageService;
    }

    case 'replit': {
      const { objectStorageService } = await import('./objectStorage');
      return objectStorageService;
    }

    default:
      throw new Error(
        'No storage backend configured. Set either FIREBASE_SERVICE_ACCOUNT_KEY for Firebase ' +
        'or PUBLIC_OBJECT_SEARCH_PATHS for Replit Object Storage.'
      );
  }
}

/**
 * Check if any storage backend is configured
 */
export function isStorageConfigured(): boolean {
  return getStorageBackend() !== 'none';
}

/**
 * Get the name of the current storage backend
 */
export function getStorageBackendName(): string {
  return getStorageBackend();
}

/**
 * Reset the cached backend detection (useful for testing)
 */
export function resetStorageDetection(): void {
  detectedBackend = null;
}

/**
 * Convenience class that wraps the async service for synchronous access patterns
 * This maintains backward compatibility with existing code
 */
export class StorageServiceWrapper {
  private static instance: StorageServiceWrapper;
  private service: IStorageService | null = null;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): StorageServiceWrapper {
    if (!StorageServiceWrapper.instance) {
      StorageServiceWrapper.instance = new StorageServiceWrapper();
    }
    return StorageServiceWrapper.instance;
  }

  /**
   * Initialize the storage service
   * Call this during server startup
   */
  async initialize(): Promise<void> {
    if (this.service) return;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          this.service = await getStorageService();
          logger.log('✅ Storage service initialized');
        } catch (error) {
          logger.warn('⚠️ Storage service not available:', (error as Error).message);
          this.service = null;
        }
      })();
    }

    await this.initPromise;
  }

  /**
   * Get the underlying storage service
   * Throws if not initialized
   */
  getService(): IStorageService {
    if (!this.service) {
      throw new Error('Storage service not initialized. Call initialize() first.');
    }
    return this.service;
  }

  /**
   * Check if the service is available
   */
  isAvailable(): boolean {
    return this.service !== null;
  }
}

// Export singleton wrapper
export const storageWrapper = StorageServiceWrapper.getInstance();
