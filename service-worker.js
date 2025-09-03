importScripts('./sw-config.js');

const { CACHE_VERSION, STRATEGIES, TIMEOUTS, CRITICAL_RESOURCES, EXTERNAL_RESOURCES, IGNORE_PATTERNS, CLEANUP } = self.SW_CONFIG;

const STATIC_CACHE = `static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-v${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-v${CACHE_VERSION}`;

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './css/global.css',
  './css/sidebar.css',
  './css/login.css',
  './css/style.css',
  './css/teams.css',
   './css/config.css',
    './css/scheduling.css',
  './css/history.css',
  './css/offline-fallback.css',
  './assets/app-logo.png',
  './assets/google-icon.png',
  './images/icon-192x192.png',
  './images/icon-512x512.png',
  './js/main.js',
  './js/data/players.js',
  './js/data/history.js',
  './js/data/schedules.js',
  './js/firebase/auth.js',
  './js/firebase/config.js',
  './js/game/logic.js',
  './js/game/teams.js',
  './js/ui/config-ui.js',
  './js/ui/display-name.js',
  './js/ui/elements.js',
  './js/ui/game-ui.js',
  './js/ui/history-ui.js',
  './js/ui/messages.js',
  './js/ui/pages.js',
  './js/ui/players-ui.js',
  './js/ui/scheduling-ui.js',
  './js/utils/app-info.js',
  './js/utils/helpers.js',
  './js/utils/connectivity.js',
  './js/utils/offline-storage.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => {
        return Promise.allSettled(
          urlsToCache.map(async (url) => {
            try {
              const response = await fetch(url, { 
                cache: 'no-cache',
                headers: { 'Cache-Control': 'no-cache' }
              });
              if (response.ok) {
                return cache.put(url, response);
              }
              throw new Error(`HTTP ${response.status}`);
            } catch (error) {
              if (CRITICAL_RESOURCES.includes(url)) {
                setTimeout(() => {
                  fetch(url).then(r => r.ok && cache.put(url, r)).catch(() => {});
                }, 2000);
              }
            }
          })
        );
      }),
      
      caches.open(DYNAMIC_CACHE).then(cache => {
        return Promise.allSettled(
          Object.entries(EXTERNAL_RESOURCES).map(async ([url, config]) => {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.NETWORK_TIMEOUT);
              
              // Avoid sending custom request headers for cross-origin resources (triggers CORS preflight failures)
              const response = await fetch(url, { 
                mode: 'cors',
                signal: controller.signal
              });
              
              clearTimeout(timeoutId);
              
              if (response.ok) {
                return cache.put(url, response.clone());
              }
            } catch (error) {
              // Silencioso
            }
          })
        );
      })
    ])
  );
  
  // Força a ativação imediata para garantir que as notificações funcionem
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  if (IGNORE_PATTERNS.some(pattern => pattern.test(request.url))) {
    return;
  }
  
  const strategy = getStrategy(request, url);
  event.respondWith(handleRequest(request, strategy));
});

function getStrategy(request, url) {
  if (EXTERNAL_RESOURCES[request.url]) {
    return EXTERNAL_RESOURCES[request.url].strategy || STRATEGIES.CACHE_FIRST;
  }
  
  if (request.destination === 'document') {
    return STRATEGIES.NETWORK_FIRST;
  }
  
  if (request.destination === 'script' || 
      request.destination === 'style' ||
      request.destination === 'image' ||
      url.pathname.includes('.js') ||
      url.pathname.includes('.css')) {
    return STRATEGIES.CACHE_FIRST;
  }
  
  if (url.pathname.includes('/api/') || 
      url.hostname !== location.hostname) {
    return STRATEGIES.NETWORK_FIRST;
  }
  
  return STRATEGIES.STALE_WHILE_REVALIDATE;
}

async function handleRequest(request, strategy) {
  switch (strategy) {
    case STRATEGIES.CACHE_FIRST:
      return cacheFirst(request);
    case STRATEGIES.NETWORK_FIRST:
      return networkFirst(request);
    case STRATEGIES.STALE_WHILE_REVALIDATE:
      return staleWhileRevalidate(request);
    default:
      return cacheFirst(request);
  }
}

async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetchWithTimeout(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone()).catch(e => {});
    }
    return networkResponse;
  } catch (error) {
    return handleFetchError(request, error);
  }
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetchWithTimeout(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone()).catch(e => {});
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return handleFetchError(request, error);
  }
}

async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);
  
  const networkResponsePromise = fetchWithTimeout(request)
    .then(response => {
      if (response && response.status === 200) {
        const cache = caches.open(RUNTIME_CACHE);
        cache.then(c => c.put(request, response.clone()));
      }
      return response;
    })
    .catch(e => {});
  
  return cachedResponse || networkResponsePromise;
}

function fetchWithTimeout(request, timeout = TIMEOUTS.NETWORK_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error('Network timeout'));
    }, timeout);
    
    fetch(request, { signal: controller.signal })
      .then(response => {
        clearTimeout(timeoutId);
        resolve(response);
      })
      .catch(error => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

async function handleFetchError(request, error) {
  const url = new URL(request.url);
  
  if (request.destination === 'document') {
    const indexResponse = await caches.match('./index.html');
    if (indexResponse) {
      return indexResponse;
    }
  }
  
  if (url.hostname === 'fonts.googleapis.com') {
    const fallbackResponse = await caches.match('./css/offline-fallback.css');
    if (fallbackResponse) {
      return fallbackResponse;
    }
    return new Response('/* Offline fallback */', {
      headers: { 'Content-Type': 'text/css' }
    });
  }
  
  if (request.destination === 'image') {
    return new Response('', { status: 200 });
  }
  
  if (url.pathname.includes('/api/')) {
    return new Response(JSON.stringify({ 
      error: 'Offline', 
      message: 'Esta funcionalidade requer conexão com a internet' 
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  throw error;
}

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [STATIC_CACHE, DYNAMIC_CACHE, RUNTIME_CACHE];
  
  event.waitUntil(
    Promise.all([
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (!cacheWhitelist.includes(cacheName)) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      cleanupOldCacheEntries(),
      self.clients.claim()
    ])
  );
});

self.addEventListener('sync', (event) => {});
self.addEventListener('push', (event) => {});

async function cleanupOldCacheEntries() {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const requests = await cache.keys();
    if (requests.length > CLEANUP.MAX_ENTRIES) {
      const entriesToDelete = requests.slice(0, requests.length - CLEANUP.MAX_ENTRIES);
      await Promise.all(entriesToDelete.map(request => cache.delete(request)));
    }
  } catch (error) {}
}

self.addEventListener('message', (event) => {
  const { data } = event;
  
  if (!data) return;
  
  switch (data.type) {
    case 'CLEAR_CACHE':
      event.waitUntil(
        clearAllCaches().then(() => {
          event.ports[0].postMessage({ success: true });
        }).catch(error => {
          event.ports[0].postMessage({ success: false, error: error.message });
        })
      );
      break;
      
    case 'CLEAR_ICON_CACHE':
      event.waitUntil(
        clearIconCache().then(() => {
          event.ports[0].postMessage({ success: true });
        }).catch(error => {
          event.ports[0].postMessage({ success: false, error: error.message });
        })
      );
      break;
      
    case 'GET_CACHE_STATS':
      event.waitUntil(
        getCacheStats().then(stats => {
          event.ports[0].postMessage({ success: true, stats });
        }).catch(error => {
          event.ports[0].postMessage({ success: false, error: error.message });
        })
      );
      break;
      
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'GET_SW_DEBUG_LOGS':
      try {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({ success: true, logs: [] });
        }
      } catch (e) {}
      break;
    case 'REQUEST_CLAIM':
      {
        // Client requests the active SW to claim uncontrolled clients
        (async () => {
          try {
            await clients.claim();
            // reply to the requester if possible
            try {
              if (event.ports && event.ports[0]) {
                event.ports[0].postMessage({ success: true, type: 'CLIENT_CLAIMED' });
              } else if (event.source && typeof event.source.postMessage === 'function') {
                event.source.postMessage({ success: true, type: 'CLIENT_CLAIMED' });
              } else {
                // broadcast as fallback
                const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
                all.forEach(c => { try { c.postMessage({ type: 'CLIENT_CLAIMED' }); } catch (_) {} });
              }
            } catch (_) {}

          } catch (err) {
            try { if (event.ports && event.ports[0]) event.ports[0].postMessage({ success: false, error: String(err) }); } catch (_) {}

          }
        })();
      }
      break;
    case 'CLEAR_SW_DEBUG_DB':
      {
        // Request to clear the SW's debug DB (logs and pending_actions)
        (async () => {
          try {
            const clearPromise = new Promise((resolve, reject) => {
              const req = indexedDB.open('sw-debug-logs', 1);
              req.onsuccess = () => {
                try {
                  const db = req.result;
                  const hasLogs = db.objectStoreNames.contains('logs');
                  const hasPending = db.objectStoreNames.contains('pending_actions');
                  if (hasLogs || hasPending) {
                    const stores = [];
                    if (hasLogs) stores.push('logs');
                    if (hasPending) stores.push('pending_actions');
                    const tx = db.transaction(stores, 'readwrite');
                    stores.forEach(s => { try { tx.objectStore(s).clear(); } catch(_){} });
                    tx.oncomplete = () => { try { db.close(); } catch(_){}; resolve(true); };
                    tx.onerror = () => { try { db.close(); } catch(_){}; reject(tx.error || new Error('tx_error')); };
                  } else {
                    try { db.close(); } catch(_){}; resolve(true);
                  }
                } catch (e) {
                  try { req.result && req.result.close(); } catch(_){}; reject(e);
                }
              };
              req.onerror = () => reject(req.error || new Error('open_failed'));
            });

            await clearPromise;
            // Reply to the requester if possible
            try {
              if (event.ports && event.ports[0]) {
                event.ports[0].postMessage({ success: true, type: 'CLEAR_SW_DEBUG_DB_DONE' });
              } else if (event.source && typeof event.source.postMessage === 'function') {
                event.source.postMessage({ success: true, type: 'CLEAR_SW_DEBUG_DB_DONE' });
              } else {
                // broadcast as fallback
                const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
                all.forEach(c => { try { c.postMessage({ type: 'CLEAR_SW_DEBUG_DB_DONE' }); } catch (_) {} });
              }
            } catch (_) {}


          } catch (err) {
            try { if (event.ports && event.ports[0]) event.ports[0].postMessage({ success: false, error: String(err) }); } catch (_) {}

          }
        })();
      }
      break;
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const payload = event.notification?.data || null;

  event.waitUntil(
    (async () => {
      const baseUrl = self.location.origin + (self.location.hostname.includes('github.io') ? '/Voleizinho-das-Ruas/' : '/');
      
      try {
        const scheduleData = encodeURIComponent(JSON.stringify(payload || {}));
        const popupUrl = baseUrl + 'popup.html?data=' + scheduleData;
        await clients.openWindow(popupUrl);
      } catch (e) {}
    })()
  );
});

self.addEventListener('notificationclose', (event) => {});

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
}

async function clearIconCache() {
  try {
    const cacheNames = await caches.keys();
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      
      const iconRequests = requests.filter(request => {
        const url = request.url;
        return url.includes('icon-') || 
               url.includes('manifest.json') ||
               url.includes('favicon') ||
               url.includes('apple-touch-icon');
      });
      
      await Promise.all(
        iconRequests.map(request => cache.delete(request))
      );
    }
  } catch (error) {
    throw error;
  }
}

async function getCacheStats() {
  const cacheNames = await caches.keys();
  const stats = {};
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    stats[cacheName] = {
      entries: keys.length,
      urls: keys.map(request => request.url)
    };
  }
  
  return stats;
}

self.addEventListener('error', (event) => {});
self.addEventListener('unhandledrejection', (event) => event.preventDefault());