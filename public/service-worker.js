// Service Worker for Video Game Wingman PWA
// Version 1.2.0

const CACHE_NAME = 'wingman-v1.2';
const RUNTIME_CACHE = 'wingman-runtime-v1.2';
const OFFLINE_URL = '/offline.html';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Install error:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (except API calls we want to cache)
  if (url.origin !== location.origin && !url.pathname.startsWith('/api/')) {
    return;
  }

  // Handle navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response
          const responseToCache = response.clone();
          
          // Cache the response
          caches.open(RUNTIME_CACHE)
            .then((cache) => {
              cache.put(request, responseToCache);
            });
          
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // No cache, return offline page
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }

  // Handle static assets (CSS, JS, images) - Cache First strategy
  // This includes Next.js static assets (with query parameters)
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'image' ||
    request.destination === 'font' ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/')
  ) {
    event.respondWith(
      // First, try cache (without query params for better matching)
      caches.match(request, { ignoreSearch: false })
        .then((cachedResponse) => {
          // Return cached version if available
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Try network, cache for future use
          return fetch(request)
            .then((response) => {
              // Only cache successful responses
              if (response && response.status === 200 && response.type === 'basic') {
                const responseToCache = response.clone();
                // Cache immediately for offline use
                caches.open(RUNTIME_CACHE)
                  .then((cache) => {
                    // Cache with the full URL including query params
                    cache.put(request, responseToCache).catch((err) => {
                      console.warn('[Service Worker] Cache put failed:', err);
                    });
                  });
              }
              return response;
            })
            .catch((error) => {
              // Network failed - try cache again (with and without query params)
              // Next.js adds query params for cache busting, but we want to match anyway
              return caches.match(request, { ignoreSearch: false })
                .then((cachedResponse) => {
                  if (cachedResponse) {
                    return cachedResponse;
                  }
                  // Try matching without query params (for Next.js assets)
                  const urlWithoutQuery = new URL(request.url);
                  urlWithoutQuery.search = '';
                  return caches.match(urlWithoutQuery, { ignoreSearch: true });
                })
                .then((cachedResponse) => {
                  if (cachedResponse) {
                    return cachedResponse;
                  }
                  // No cache available - return appropriate fallback
                  if (request.destination === 'image') {
                    return caches.match('/icons/icon-192x192.png')
                      .then((fallback) => fallback || new Response('', { status: 404 }));
                  }
                  // For CSS/JS, we must return something or page breaks
                  // Return empty but valid response to prevent errors
                  return new Response('', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: { 
                      'Content-Type': request.destination === 'style' 
                        ? 'text/css' 
                        : request.destination === 'script'
                        ? 'application/javascript'
                        : 'text/plain'
                    }
                  });
                });
            });
        })
        .catch((error) => {
          // Final fallback - always return a Response
          console.warn('[Service Worker] Cache match error:', error);
          if (request.destination === 'image') {
            return caches.match('/icons/icon-192x192.png')
              .then((fallback) => fallback || new Response('', { status: 404 }));
          }
          return new Response('', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 
              'Content-Type': request.destination === 'style' 
                ? 'text/css' 
                : request.destination === 'script'
                ? 'application/javascript'
                : 'text/plain'
            }
          });
        })
    );
    return;
  }

  // Handle API requests - Network First with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache successful responses
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(RUNTIME_CACHE)
              .then((cache) => {
                cache.put(request, responseToCache);
              });
          }
          return response;
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Return a basic offline response
              return new Response(
                JSON.stringify({ error: 'Offline', message: 'No internet connection' }),
                {
                  status: 503,
                  headers: { 'Content-Type': 'application/json' },
                }
              );
            });
        })
    );
    return;
  }

  // Default: Network First
  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseToCache = response.clone();
        caches.open(RUNTIME_CACHE)
          .then((cache) => {
            cache.put(request, responseToCache);
          });
        return response;
      })
      .catch(() => {
        return caches.match(request)
          .then((cachedResponse) => {
            // Always return a Response, even if cache miss
            return cachedResponse || new Response('', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Message event - handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(RUNTIME_CACHE)
        .then((cache) => {
          return cache.addAll(event.data.urls);
        })
    );
  }
});
