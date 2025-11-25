import { lazy, ComponentType } from 'react';

interface RetryOptions {
  retries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

// Track failed imports for debugging purposes
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
          const module = await importFn();
          failedImports.delete(importKey);
          resolve(module);
        } catch (error) {
          failedImports.add(importKey);

          if (retriesLeft <= 0) {
            // Total attempts = retries + 1 (initial attempt + all retries)
            const totalAttempts = retries + 1;
            console.error(
              `Failed to load module after ${totalAttempts} attempts. ` +
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
          // 0.4 * (random - 0.5) gives range of -0.2 to +0.2
          const jitter = exponentialDelay * 0.4 * (Math.random() - 0.5);
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

// Helper to clear failed imports cache (useful for retry buttons)
export function clearFailedImportsCache(): void {
  failedImports.clear();
}
