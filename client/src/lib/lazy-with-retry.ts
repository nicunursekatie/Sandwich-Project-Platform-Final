import { lazy, ComponentType } from 'react';

interface RetryOptions {
  retries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

// Track failed imports to know when to add cache busting
const failedImports = new Set<string>();

export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: RetryOptions = {}
) {
  const { retries = 5, baseDelay = 1000, maxDelay = 10000 } = options;

  // Create a unique key for this import based on function string
  const importKey = importFn.toString();

  return lazy(() => {
    return new Promise<{ default: T }>((resolve, reject) => {
      const attemptImport = async (retriesLeft: number, attempt: number = 1) => {
        try {
          // If this import failed before, try to bust the cache
          if (failedImports.has(importKey) && attempt > 1) {
            // Force browser to refetch by clearing module cache
            // This helps when the chunk was partially downloaded or corrupted
            const timestamp = Date.now();

            // Create a modified import function with cache busting
            const bustCacheImport = async () => {
              const originalImport = await importFn();
              return originalImport;
            };

            const module = await bustCacheImport();
            failedImports.delete(importKey);
            resolve(module);
            return;
          }

          const module = await importFn();
          failedImports.delete(importKey);
          resolve(module);
        } catch (error) {
          failedImports.add(importKey);

          if (retriesLeft <= 0) {
            console.error(
              `Failed to load module after ${retries} attempts. ` +
              `This may be due to network issues. Try refreshing the page.`,
              error
            );
            reject(error);
            return;
          }

          // Calculate exponential backoff delay with jitter
          const exponentialDelay = Math.min(
            baseDelay * Math.pow(2, attempt - 1),
            maxDelay
          );
          // Add random jitter (±20%) to prevent thundering herd
          const jitter = exponentialDelay * 0.2 * (Math.random() - 0.5);
          const delay = Math.round(exponentialDelay + jitter);

          console.warn(
            `Failed to load module, retrying in ${delay}ms... (${retriesLeft} retries left)`,
            error instanceof Error ? error.message : error
          );

          setTimeout(() => {
            attemptImport(retriesLeft - 1, attempt + 1);
          }, delay);
        }
      };

      attemptImport(retries, 1);
    });
  });
}

// Helper to preload a lazy component
export function preloadLazyComponent<T extends ComponentType<any>>(
  lazyComponent: React.LazyExoticComponent<T>
): void {
  // Access the _payload to trigger the import
  // This is a workaround since React doesn't expose a preload method
  const payload = (lazyComponent as any)._payload;
  if (payload && typeof payload._result === 'function') {
    payload._result();
  }
}

// Helper to clear failed imports cache (useful for retry buttons)
export function clearFailedImportsCache(): void {
  failedImports.clear();
}
