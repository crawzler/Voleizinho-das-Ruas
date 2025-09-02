// Importa configurações
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
              
              const response = await fetch(url, { 
                mode: 'cors',
                signal: controller.signal,
                headers: { 'Cache-Control': 'max-age=86400' }
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

async function cleanupOldCacheEntries() {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const requests = await cache.keys();
    
    if (requests.length > CLEANUP.MAX_ENTRIES) {
      const entriesToDelete = requests.slice(0, requests.length - CLEANUP.MAX_ENTRIES);
      await Promise.all(
        entriesToDelete.map(request => cache.delete(request))
      );
    }
  } catch (error) {
    // Silencioso
  }
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
  }
});

self.addEventListener('notificationclick', (event) => {
  console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Notification clicked. Action: ${event.action}`);
  event.notification.close();

  const action = event.action;
  const payload = event.notification && event.notification.data ? event.notification.data : null;

  if (action === 'close') {
    console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Close action, doing nothing.`);
    return;
  }

  event.waitUntil(
    (async () => {
      console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Handling notification click...`);
      // Build a deep link that forces the app to open the scheduling page and carries
      // minimal information as query params so the app can act even if postMessage
      // from the service worker doesn't arrive (race with app load).
      const actionParam = action && action.length ? action : 'view';
      const safePayload = payload || {};
      const qp = new URLSearchParams();
      qp.set('notifAction', actionParam);
      if (safePayload.id) qp.set('scheduleId', safePayload.id);
      if (safePayload.userId) qp.set('userId', safePayload.userId);
      if (safePayload.playerName) qp.set('playerName', safePayload.playerName);
      if (safePayload.date) qp.set('date', safePayload.date);
      if (safePayload.startTime) qp.set('startTime', safePayload.startTime);
      if (safePayload.location) qp.set('location', safePayload.location);

      // Use index.html with hash to ensure single-page routing reaches scheduling page
      const urlToOpen = `${self.location.origin}/index.html?${qp.toString()}#scheduling`;

      const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Found ${clientList.length} clients.`);

      // If there's an existing client from our origin, focus it and send the message.
      for (const client of clientList) {
        try {
          if (new URL(client.url).origin === self.location.origin) {
            console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Focusing existing client and sending message.`);
            client.postMessage({ type: 'NOTIFICATION_ACTION', action: actionParam, data: safePayload });
            return client.focus();
          }
        } catch (e) {
          // ignore malformed client URLs
        }
      }

      // No client found - open a new window/tab with deep link that includes params as fallback
      if (clients.openWindow) {
        console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - No client found, opening new window at: ${urlToOpen}`);
        const newWindow = await clients.openWindow(urlToOpen);
        if (newWindow) {
          console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - New window opened. Waiting 700ms to send message.`);
          await new Promise(resolve => setTimeout(resolve, 700));

          const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
          console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Sending message to ${allClients.length} clients.`);
          allClients.forEach(client => {
            try {
              client.postMessage({ type: 'NOTIFICATION_ACTION', action: actionParam, data: safePayload });
            } catch (e) { /* ignore */ }
          });
        }
        return newWindow;
      }
    })()
  );
});

self.addEventListener('notificationclose', (event) => {
  // Silencioso
});

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

self.addEventListener('error', (event) => {
  // Silencioso
});

self.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
});