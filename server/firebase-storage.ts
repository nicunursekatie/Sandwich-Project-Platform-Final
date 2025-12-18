/**
 * Firebase Storage Service
 * Replaces Replit Object Storage for file uploads/downloads
 *
 * This is a drop-in replacement that maintains the same API as objectStorage.ts
 * but uses Firebase Storage instead of Replit's GCS sidecar.
 */

import { Response } from 'express';
import { randomUUID } from 'crypto';
import { getFirebaseStorage, isFirebaseConfigured } from './firebase-config';
import { logger } from './utils/production-safe-logger';

export class ObjectNotFoundError extends Error {
  constructor() {
    super('Object not found');
    this.name = 'ObjectNotFoundError';
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

/**
 * Firebase Storage Service
 * Provides the same interface as the Replit ObjectStorageService
 */
export class FirebaseStorageService {
  private static instance: FirebaseStorageService;

  private constructor() {}

  static getInstance(): FirebaseStorageService {
    if (!FirebaseStorageService.instance) {
      FirebaseStorageService.instance = new FirebaseStorageService();
    }
    return FirebaseStorageService.instance;
  }

  /**
   * Gets the public storage paths (for backward compatibility)
   */
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_STORAGE_PATHS || process.env.PUBLIC_OBJECT_SEARCH_PATHS || 'public';
    return pathsStr
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  /**
   * Gets the private storage directory
   */
  getPrivateObjectDir(): string {
    return process.env.PRIVATE_STORAGE_DIR || process.env.PRIVATE_OBJECT_DIR || 'private';
  }

  /**
   * Search for a public file in storage
   */
  async searchPublicObject(filePath: string): Promise<any | null> {
    if (!isFirebaseConfigured()) {
      logger.warn('Firebase Storage not configured');
      return null;
    }

    try {
      const storage = getFirebaseStorage();
      const bucket = storage.bucket();

      for (const searchPath of this.getPublicObjectSearchPaths()) {
        const fullPath = `${searchPath}/${filePath}`.replace(/^\/+/, '');
        const file = bucket.file(fullPath);
        const [exists] = await file.exists();

        if (exists) {
          return file;
        }
      }

      return null;
    } catch (error) {
      logger.error('Error searching for public object:', error);
      return null;
    }
  }

  /**
   * Downloads a file to the response
   */
  async downloadObject(file: any, res: Response, cacheTtlSec: number = 3600) {
    try {
      const [metadata] = await file.getMetadata();

      res.set({
        'Content-Type': metadata.contentType || 'application/octet-stream',
        'Content-Length': metadata.size,
        'Cache-Control': `public, max-age=${cacheTtlSec}`,
      });

      const stream = file.createReadStream();

      stream.on('error', (err: Error) => {
        logger.error('Stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error streaming file' });
        }
      });

      stream.pipe(res);
    } catch (error) {
      logger.error('Error downloading file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error downloading file' });
      }
    }
  }

  /**
   * Gets a signed upload URL for client-side uploads
   */
  async getObjectEntityUploadURL(): Promise<string> {
    if (!isFirebaseConfigured()) {
      throw new Error('Firebase Storage not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY and FIREBASE_STORAGE_BUCKET.');
    }

    const privateDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const fullPath = `${privateDir}/uploads/${objectId}`;

    const storage = getFirebaseStorage();
    const bucket = storage.bucket();
    const file = bucket.file(fullPath);

    // Generate signed URL for PUT method (15 min TTL)
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: 'application/octet-stream',
    });

    return signedUrl;
  }

  /**
   * Upload a local file to storage and return the public URL
   */
  async uploadLocalFile(localFilePath: string, destKey: string): Promise<string> {
    if (!isFirebaseConfigured()) {
      throw new Error('Firebase Storage not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY and FIREBASE_STORAGE_BUCKET.');
    }

    const privateDir = this.getPrivateObjectDir();
    const fullPath = `${privateDir}/${destKey}`.replace(/^\/+/, '');

    const storage = getFirebaseStorage();
    const bucket = storage.bucket();

    try {
      await bucket.upload(localFilePath, {
        destination: fullPath,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });

      logger.info('File uploaded successfully', { destKey, fullPath });

      // Return a Firebase Storage URL
      const bucketName = bucket.name;
      return `https://storage.googleapis.com/${bucketName}/${fullPath}`;
    } catch (error) {
      logger.error('Error uploading file to Firebase Storage', { error, destKey });
      throw new Error('Failed to upload file to storage');
    }
  }

  /**
   * Upload a buffer directly to storage
   */
  async uploadBuffer(buffer: Buffer, destKey: string, contentType: string = 'application/octet-stream'): Promise<string> {
    if (!isFirebaseConfigured()) {
      throw new Error('Firebase Storage not configured.');
    }

    const privateDir = this.getPrivateObjectDir();
    const fullPath = `${privateDir}/${destKey}`.replace(/^\/+/, '');

    const storage = getFirebaseStorage();
    const bucket = storage.bucket();
    const file = bucket.file(fullPath);

    try {
      await file.save(buffer, {
        metadata: {
          contentType,
          cacheControl: 'public, max-age=31536000',
        },
      });

      logger.info('Buffer uploaded successfully', { destKey, fullPath });

      const bucketName = bucket.name;
      return `https://storage.googleapis.com/${bucketName}/${fullPath}`;
    } catch (error) {
      logger.error('Error uploading buffer to Firebase Storage', { error, destKey });
      throw new Error('Failed to upload buffer to storage');
    }
  }

  /**
   * Get a signed URL for viewing a file
   */
  async getSignedViewUrl(storageUrl: string, ttlSeconds: number = 604800): Promise<string> {
    if (!isFirebaseConfigured()) {
      return storageUrl; // Return original URL as fallback
    }

    try {
      // Parse the storage URL to extract bucket and object name
      const url = new URL(storageUrl);
      const pathParts = url.pathname.split('/').filter((p) => p.length > 0);

      if (pathParts.length < 2) {
        throw new Error('Invalid storage URL format');
      }

      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join('/');

      const storage = getFirebaseStorage();
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(objectName);

      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + ttlSeconds * 1000,
      });

      return signedUrl;
    } catch (error) {
      logger.error('Error generating signed URL', { error, storageUrl });
      return storageUrl; // Return original as fallback
    }
  }

  /**
   * Delete a file from storage
   */
  async deleteObject(filePath: string): Promise<boolean> {
    if (!isFirebaseConfigured()) {
      logger.warn('Firebase Storage not configured');
      return false;
    }

    try {
      const storage = getFirebaseStorage();
      const bucket = storage.bucket();
      const file = bucket.file(filePath);

      await file.delete();
      logger.info('File deleted successfully', { filePath });
      return true;
    } catch (error) {
      logger.error('Error deleting file from storage', { error, filePath });
      return false;
    }
  }

  /**
   * Check if a file exists in storage
   */
  async fileExists(filePath: string): Promise<boolean> {
    if (!isFirebaseConfigured()) {
      return false;
    }

    try {
      const storage = getFirebaseStorage();
      const bucket = storage.bucket();
      const file = bucket.file(filePath);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      logger.error('Error checking file existence', { error, filePath });
      return false;
    }
  }
}

// Export singleton instance for convenience
export const firebaseStorageService = FirebaseStorageService.getInstance();

/**
 * Backward-compatible exports
 * These match the interface from the original objectStorage.ts
 */
export const objectStorageService = firebaseStorageService;
export const ObjectStorageService = FirebaseStorageService;
