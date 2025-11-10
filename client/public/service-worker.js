const CACHE_NAME = 'tsp-v1.1.0';
const RUNTIME_CACHE = 'tsp-runtime-v1.1.0';

// Assets to cache on install (only files guaranteed to exist in production)
const PRECACHE_URLS = [
  '/attached_assets/LOGOS/TSP_transparent.png',
  '/attached_assets/LOGOS/sandwich logo.png',
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker v1.1.0] Installing with network-first strategy for JS chunks');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Precaching assets');
        return cache.addAll(PRECACHE_URLS).catch((err) => {
          console.warn('[Service Worker] Failed to precache some assets:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('[Service Worker] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - strategic caching to prevent stale chunk errors
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // NEVER cache JavaScript files - they change with every deployment
  // This prevents the "r in a gray box" error from stale chunks
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.mjs') || url.pathname.includes('/assets/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Main HTML page - always fetch fresh to get latest chunk references
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Fallback to cache only if network fails completely
        return caches.match(request);
      })
    );
    return;
  }

  // API requests - network first, cache fallback (GET only)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache GET requests
          if (request.method === 'GET' && response.status === 200) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails (GET only)
          if (request.method === 'GET') {
            return caches.match(request).then((cached) => {
              if (cached) {
                return cached;
              }
              return new Response(
                JSON.stringify({ error: 'Offline', message: 'No network connection' }),
                { 
                  status: 503, 
                  headers: { 'Content-Type': 'application/json' } 
                }
              );
            });
          }
          return new Response(
            JSON.stringify({ error: 'Offline', message: 'No network connection' }),
            { 
              status: 503, 
              headers: { 'Content-Type': 'application/json' } 
            }
          );
        })
    );
    return;
  }

  // Static assets (images, fonts, etc.) - cache first, network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        if (request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }

        return response;
      });
    })
  );
});

// Background sync for offline actions (future enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  // Placeholder for background sync logic
  console.log('[Service Worker] Background sync triggered');
}

// Push notification handler (for future real-time updates)
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'The Sandwich Project';
  const options = {
    body: data.body || 'New update available',
    icon: '/attached_assets/LOGOS/TSP_transparent.png',
    badge: '/attached_assets/LOGOS/sandwich logo.png',
    data: data.url || '/',
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data)
  );
});
