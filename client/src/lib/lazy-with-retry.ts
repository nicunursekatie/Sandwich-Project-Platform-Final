import { lazy, ComponentType } from 'react';

interface RetryOptions {
  retries?: number;
  delay?: number;
}

export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: RetryOptions = {}
) {
  const { retries = 3, delay = 1000 } = options;

  return lazy(() => {
    return new Promise<{ default: T }>((resolve, reject) => {
      const attemptImport = async (retriesLeft: number) => {
        try {
          const module = await importFn();
          resolve(module);
        } catch (error) {
          if (retriesLeft <= 0) {
            reject(error);
            return;
          }

          console.warn(
            `Failed to load module, retrying... (${retriesLeft} retries left)`,
            error
          );

          setTimeout(() => {
            attemptImport(retriesLeft - 1);
          }, delay);
        }
      };

      attemptImport(retries);
    });
  });
}
