const CACHE_NAME = 'tsp-v1.0.1';
const RUNTIME_CACHE = 'tsp-runtime-v1.0.1';

// Assets to cache on install (only files guaranteed to exist in production)
const PRECACHE_URLS = [
  '/',
  '/attached_assets/LOGOS/TSP_transparent.png',
  '/attached_assets/LOGOS/sandwich logo.png',
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Precaching assets');
        // Use addAll with error handling for missing assets
        return cache.addAll(PRECACHE_URLS).catch((err) => {
          console.warn('[Service Worker] Failed to precache some assets:', err);
          // Continue installation even if some assets fail
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

// Fetch event - network first with cache fallback for API, cache first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // API requests - network first, cache fallback (GET only)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Only cache GET requests - POST/PUT/DELETE cannot be cached
          if (request.method === 'GET') {
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
              // Return offline response for API calls
              return new Response(
                JSON.stringify({ error: 'Offline', message: 'No network connection' }),
                { 
                  status: 503, 
                  headers: { 'Content-Type': 'application/json' } 
                }
              );
            });
          }
          // For non-GET requests, just return error
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

  // Static assets - cache first, network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Only cache GET requests (Cache API doesn't support POST/PUT/DELETE)
        if (request.method === 'GET') {
          // Clone and cache the response
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
