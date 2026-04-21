import { lazy, ComponentType } from 'react';

interface RetryOptions {
  retries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

// Session key to prevent infinite reload loops
const RELOAD_KEY = 'chunk-reload-timestamp';

/**
 * Detect whether an import error is a stale/missing chunk (post-rebuild 404).
 * These can't be fixed by retrying — the file literally doesn't exist anymore.
 * The only fix is a full page reload to pick up the new bundle manifest.
 */
function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Loading chunk') ||
    message.includes('Loading CSS chunk') ||
    message.includes('error loading dynamically imported module') ||
    // Vite-specific: the chunk URL contains a hash that no longer exists
    /https?:\/\/.*\.js$/.test(message)
  );
}

/**
 * Force a reload that also cache-busts index.html.
 *
 * A plain `location.reload()` can still read a stale index.html from the
 * HTTP cache — the browser sees a fresh-enough copy and re-uses it, which
 * loops back to the same missing chunk. Appending a timestamp query param
 * guarantees a new URL, so the browser has to re-fetch and honor the
 * server's no-cache headers.
 *
 * Uses a short guard to prevent infinite reload loops if the server is
 * actually down.
 */
function reloadOnceForStaleChunks(): void {
  const lastReload = sessionStorage.getItem(RELOAD_KEY);
  const now = Date.now();

  // If we already reloaded within the last 30 seconds, don't reload again
  if (lastReload && now - parseInt(lastReload, 10) < 30_000) {
    console.error(
      'Stale chunk detected but already reloaded recently. The app may need a manual refresh.'
    );
    return;
  }

  console.warn('Stale chunk detected after rebuild — reloading page to fetch updated assets...');
  sessionStorage.setItem(RELOAD_KEY, String(now));

  // Cache-bust: strip any existing _v param and set a fresh one
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('_v');
    url.searchParams.set('_v', String(now));
    window.location.replace(url.toString());
  } catch {
    // Fall back to a plain reload if URL parsing fails for any reason
    window.location.reload();
  }
}

// Track failed imports for debugging purposes
const failedImports = new Set<string>();

export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: RetryOptions = {}
) {
  const { retries = 2, baseDelay = 1000, maxDelay = 5000 } = options;

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

          // If this is a stale chunk error (file no longer exists on server),
          // retrying the same URL won't help. Reload the page instead.
          if (isStaleChunkError(error)) {
            reloadOnceForStaleChunks();
            // reject so the error boundary catches it if reload doesn't happen
            reject(error);
            return;
          }

          if (retriesLeft <= 0) {
            const totalAttempts = retries + 1;
            console.error(
              `Failed to load module after ${totalAttempts} attempts. ` +
                `This may be due to network issues. Try refreshing the page.`,
              error
            );
            reject(error);
            return;
          }

          // Exponential backoff with jitter for transient network errors
          const exponentialDelay = Math.min(
            baseDelay * Math.pow(2, attempt - 1),
            maxDelay
          );
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

/**
 * Install a global handler that catches any unhandled dynamic import failures
 * (from plain lazy() calls or anything else) and auto-reloads.
 * Call this once at app startup.
 */
export function installChunkErrorHandler(): void {
  // If we got this far, the current bundle loaded successfully — clear any
  // old reload-guard timestamp so a future stale-chunk error can reload
  // immediately instead of being blocked by the 30s cooldown.
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    // sessionStorage may be unavailable (e.g., privacy mode); ignore
  }

  window.addEventListener('unhandledrejection', (event) => {
    if (isStaleChunkError(event.reason)) {
      event.preventDefault(); // suppress the console error
      reloadOnceForStaleChunks();
    }
  });
}
