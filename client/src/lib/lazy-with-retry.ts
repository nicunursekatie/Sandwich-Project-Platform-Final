import { lazy, ComponentType } from 'react';

interface RetryOptions {
  retries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

// Session keys to prevent infinite reload loops while still allowing a few
// auto-recovery attempts during a slow auth handshake.
const RELOAD_KEY = 'chunk-reload-timestamp';
const RELOAD_COUNT_KEY = 'chunk-reload-count';

// How long to remember reload attempts (ms). A stale-chunk auto-reload takes
// longer than you'd think because it also re-runs the auth handshake, which
// can take 10-20s on slow networks. 2 minutes is a comfortable upper bound.
const RELOAD_GUARD_WINDOW_MS = 2 * 60 * 1000;

// How many consecutive reloads we'll allow before falling back to a visible
// error UI. 2 covers "one stale HTML load, one stale chunk load, then fine";
// beyond that, reloading is clearly not helping and the user needs to act.
const MAX_AUTO_RELOADS = 2;

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

function getReloadState(): { count: number; withinWindow: boolean } {
  try {
    const last = sessionStorage.getItem(RELOAD_KEY);
    const count = parseInt(sessionStorage.getItem(RELOAD_COUNT_KEY) || '0', 10);
    if (!last) return { count: 0, withinWindow: false };
    const withinWindow = Date.now() - parseInt(last, 10) < RELOAD_GUARD_WINDOW_MS;
    return { count: withinWindow ? count : 0, withinWindow };
  } catch {
    return { count: 0, withinWindow: false };
  }
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
 * Allows up to MAX_AUTO_RELOADS within RELOAD_GUARD_WINDOW_MS before falling
 * back to a visible error UI. If reloading hasn't fixed things after that
 * many tries, the user's cache is stuck and they need to hard-reload or
 * clear site data — we tell them so explicitly.
 */
function reloadOnceForStaleChunks(): void {
  const { count, withinWindow } = getReloadState();
  const now = Date.now();

  if (withinWindow && count >= MAX_AUTO_RELOADS) {
    console.error(
      `Stale chunk still failing after ${count} auto-reloads. Surfacing manual-reload UI.`
    );
    showStaleChunkFallbackUI();
    return;
  }

  const nextCount = withinWindow ? count + 1 : 1;
  console.warn(
    `Stale chunk detected — auto-reloading (attempt ${nextCount}/${MAX_AUTO_RELOADS})...`
  );
  try {
    sessionStorage.setItem(RELOAD_KEY, String(now));
    sessionStorage.setItem(RELOAD_COUNT_KEY, String(nextCount));
  } catch {
    // storage unavailable; proceed anyway
  }

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

/**
 * Render a plain-DOM fallback banner explaining the situation and giving the
 * user a single big "Hard reload" button. We can't mount a React tree here
 * (the failure is usually in loading the React tree), so this is intentionally
 * done with raw DOM calls.
 */
function showStaleChunkFallbackUI(): void {
  // Don't stack multiple banners
  if (document.getElementById('stale-chunk-fallback')) return;

  const overlay = document.createElement('div');
  overlay.id = 'stale-chunk-fallback';
  overlay.setAttribute('role', 'alert');
  overlay.style.cssText = [
    'position: fixed',
    'inset: 0',
    'z-index: 2147483647',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    'padding: 24px',
    'background: rgba(15, 23, 42, 0.72)',
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  ].join(';');

  const card = document.createElement('div');
  card.style.cssText = [
    'max-width: 480px',
    'width: 100%',
    'background: #ffffff',
    'border-radius: 12px',
    'padding: 24px',
    'box-shadow: 0 20px 40px rgba(0,0,0,0.2)',
    'text-align: left',
  ].join(';');

  card.innerHTML = `
    <h2 style="margin:0 0 12px;font-size:18px;color:#0f172a;">
      The app couldn't finish loading
    </h2>
    <p style="margin:0 0 12px;font-size:14px;color:#334155;line-height:1.5;">
      Your browser is holding on to an old version of the app. A hard reload
      usually fixes it.
    </p>
    <p style="margin:0 0 20px;font-size:13px;color:#64748b;line-height:1.5;">
      If the button below doesn't work, close every tspapp.org tab and open
      a fresh one, or clear the site's cached data in your browser settings.
    </p>
    <button
      type="button"
      id="stale-chunk-fallback-button"
      style="
        display:block;
        width:100%;
        padding:12px 16px;
        font-size:15px;
        font-weight:600;
        color:#ffffff;
        background:#236383;
        border:0;
        border-radius:8px;
        cursor:pointer;
      "
    >
      Hard reload
    </button>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const btn = document.getElementById('stale-chunk-fallback-button');
  btn?.addEventListener('click', () => {
    try {
      sessionStorage.removeItem(RELOAD_KEY);
      sessionStorage.removeItem(RELOAD_COUNT_KEY);
    } catch {
      // ignore
    }
    // Force a fresh URL to dodge any cached redirect / HTML.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('_v');
      url.searchParams.set('_v', String(Date.now()));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  });
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
  // old reload-guard state so a future stale-chunk error can reload
  // immediately instead of being blocked by the cooldown, and so the
  // consecutive-failure counter doesn't accidentally trigger the fallback
  // UI after an unrelated reload days later.
  try {
    sessionStorage.removeItem(RELOAD_KEY);
    sessionStorage.removeItem(RELOAD_COUNT_KEY);
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
