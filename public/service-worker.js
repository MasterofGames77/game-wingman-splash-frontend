// Service Worker for Video Game Wingman PWA
// Version 2.0.0 - Epic 2: Offline Queue & Background Sync

const CACHE_NAME = 'wingman-v2.0';
const RUNTIME_CACHE = 'wingman-runtime-v2.0';
const OFFLINE_URL = '/offline.html';
const API_BASE_URL = self.location.origin.includes('localhost') 
  ? 'http://localhost:5000' 
  : self.location.origin;

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

  // Handle cross-origin image requests (ImageKit, etc.) - cache them
  const isImageRequest = request.destination === 'image' || 
                        url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ||
                        url.hostname.includes('imagekit.io');
  
  // Skip cross-origin requests (except API calls and images we want to cache)
  if (url.origin !== location.origin && !url.pathname.startsWith('/api/') && !isImageRequest) {
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

  // Handle images (including cross-origin ImageKit images) - Cache First strategy
  if (isImageRequest) {
    event.respondWith(
      (async () => {
        // Try cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Try network, cache for future use
        try {
          const networkResponse = await fetch(request, {
            mode: 'cors', // Allow CORS for external images
            credentials: 'omit'
          });
          
          // Cache successful image responses
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(RUNTIME_CACHE)
              .then((cache) => {
                cache.put(request, responseToCache).catch((err) => {
                  console.warn('[Service Worker] Failed to cache image:', err);
                });
              });
          }
          
          return networkResponse;
        } catch (error) {
          // Network failed - return fallback or 404
          console.log('[Service Worker] Image fetch failed:', request.url);
          return caches.match('/icons/icon-192x192.png')
            .then((fallback) => fallback || new Response('', { status: 404 }));
        }
      })()
    );
    return;
  }

  // Handle static assets (CSS, JS, fonts) - Cache First strategy
  // This includes Next.js static assets (with query parameters)
  if (
    request.destination === 'style' ||
    request.destination === 'script' ||
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

  // Handle API requests - Network First with cache fallback and stale-while-revalidate
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      (async () => {
        // Try network first
        try {
          const networkResponse = await fetch(request);
          
          // Cache successful responses (cache all 200 responses, even with different query params)
          if (networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(RUNTIME_CACHE)
              .then((cache) => {
                // Cache with full URL (including query params)
                cache.put(request, responseToCache).catch((err) => {
                  console.warn('[Service Worker] Failed to cache API response:', err);
                });
              });
          }
          
          return networkResponse;
        } catch (error) {
          // Network failed - try cache with multiple strategies
          console.log('[Service Worker] Network failed, checking cache for:', request.url);
          
          // Strategy 1: Try exact match (with query params)
          let cachedResponse = await caches.match(request);
          
          // Strategy 2: If no exact match, try matching without query params
          if (!cachedResponse && url.pathname.startsWith('/api/')) {
            const urlWithoutQuery = new URL(request.url);
            urlWithoutQuery.search = '';
            cachedResponse = await caches.match(urlWithoutQuery);
          }
          
          // Strategy 3: Try matching by pathname and similar query params
          // For example: /api/public/forum-posts?forumId=X&limit=5&offset=0
          // might match /api/public/forum-posts?forumId=X&limit=5&offset=5
          if (!cachedResponse && url.pathname.startsWith('/api/')) {
            const cache = await caches.open(RUNTIME_CACHE);
            const keys = await cache.keys();
            
            // Extract base path and important params
            const basePath = url.pathname;
            const params = new URLSearchParams(url.search);
            const forumId = params.get('forumId');
            const seriesId = params.get('seriesId');
            
            // Try to find a cached response with same path and same forumId/seriesId
            for (const key of keys) {
              const keyUrl = new URL(key.url);
              if (keyUrl.pathname === basePath) {
                const keyParams = new URLSearchParams(keyUrl.search);
                // Match if forumId or seriesId matches (for forum/linkedin posts)
                if (forumId && keyParams.get('forumId') === forumId) {
                  cachedResponse = await cache.match(key);
                  if (cachedResponse) break;
                } else if (seriesId && keyParams.get('seriesId') === seriesId) {
                  cachedResponse = await cache.match(key);
                  if (cachedResponse) break;
                }
              }
            }
          }
          
          // Strategy 4: Try matching by pathname only (last resort)
          if (!cachedResponse) {
            const cache = await caches.open(RUNTIME_CACHE);
            const keys = await cache.keys();
            for (const key of keys) {
              const keyUrl = new URL(key.url);
              if (keyUrl.pathname === url.pathname) {
                cachedResponse = await cache.match(key);
                if (cachedResponse) {
                  console.log('[Service Worker] Found cache by pathname:', key.url);
                  break;
                }
              }
            }
          }
          
          if (cachedResponse) {
            console.log('[Service Worker] Serving cached response for:', request.url);
            return cachedResponse;
          }
          
          // No cache available - return offline response
          console.log('[Service Worker] No cache available for:', request.url);
          return new Response(
            JSON.stringify({ 
              error: 'Offline', 
              message: 'No internet connection and no cached data available',
              offline: true 
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      })()
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

// Background Sync event - process queued actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'process-queue') {
    console.log('[Service Worker] Background sync triggered: process-queue');
    event.waitUntil(processQueue());
  }
});

// Process queued actions
async function processQueue() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/pwa/queue/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        processAll: true,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('[Service Worker] Queue processed:', result);
      
      // Notify all clients
      const clients = await self.clients.matchAll();
      clients.forEach((client) => {
        client.postMessage({
          type: 'QUEUE_PROCESSED',
          processed: result.processed || 0,
          failed: result.failed || 0,
        });
      });
    }
  } catch (error) {
    console.error('[Service Worker] Queue processing failed:', error);
  }
}

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

  if (event.data && event.data.type === 'PROCESS_QUEUE') {
    event.waitUntil(processQueue());
  }
});
