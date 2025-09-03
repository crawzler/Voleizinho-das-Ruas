// Importa configurações
importScripts('./sw-config.js');

// --- IndexedDB lightweight logger for SW debugging ---
const SW_LOG_DB = 'sw-debug-logs';
const SW_LOG_STORE = 'logs';

function openSwLogDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SW_LOG_DB, 1);
    req.onupgradeneeded = (e) => {
        try {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(SW_LOG_STORE)) db.createObjectStore(SW_LOG_STORE, { keyPath: 'id', autoIncrement: true });
          if (!db.objectStoreNames.contains('pending_actions')) db.createObjectStore('pending_actions', { keyPath: 'id', autoIncrement: true });
        } catch (_) {}
      };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function logSwEvent(entry) {
  try {
    const db = await openSwLogDb();
    const tx = db.transaction(SW_LOG_STORE, 'readwrite');
    const store = tx.objectStore(SW_LOG_STORE);
    const payload = Object.assign({ ts: Date.now() }, entry);
    store.add(payload);
    tx.oncomplete = () => db.close();
  } catch (e) {
    // silencioso
  }
}

async function getRecentSwLogs(limit = 100) {
  try {
    const db = await openSwLogDb();
    const tx = db.transaction(SW_LOG_STORE, 'readonly');
    const store = tx.objectStore(SW_LOG_STORE);
    return new Promise((resolve, reject) => {
      const results = [];
      const req = store.openCursor(null, 'prev');
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = () => reject(req.error);
    }).finally(() => db.close());
  } catch (e) {
    return [];
  }
}

// Guarda uma ação pendente para ser processada pelo cliente quando abrir
async function addPendingAction(entry) {
  try {
    const db = await openSwLogDb();
    const tx = db.transaction('pending_actions', 'readwrite');
    const store = tx.objectStore('pending_actions');
    const payload = Object.assign({ ts: Date.now() }, entry);
    store.add(payload);
    tx.oncomplete = () => db.close();
  } catch (e) {
    // silencioso
  }
}

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

// Mantém o service worker ativo para notificações
self.addEventListener('sync', (event) => {
  // Mantém o SW ativo
});

// Listener para push notifications (caso seja implementado no futuro)
self.addEventListener('push', (event) => {
  // Push message received
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
    case 'GET_SW_DEBUG_LOGS':
      {
        const limit = data.limit || 100;
        getRecentSwLogs(limit).then(logs => {
          try {
            if (event.ports && event.ports[0]) {
              event.ports[0].postMessage({ success: true, logs });
            } else {
              // Fallback: post to all clients
              clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsList => {
                clientsList.forEach(c => c.postMessage({ type: 'SW_DEBUG_LOGS', logs }));
              });
            }
          } catch (e) {
            // silencioso
          }
        }).catch(err => {
          try { if (event.ports && event.ports[0]) event.ports[0].postMessage({ success: false, error: err.message }); } catch (e) {}
        });
      }
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
            logSwEvent({ type: 'clientsClaimed' });
          } catch (err) {
            try { if (event.ports && event.ports[0]) event.ports[0].postMessage({ success: false, error: String(err) }); } catch (_) {}
            logSwEvent({ type: 'clientsClaimFailed', error: (err && err.message) || String(err) });
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

            logSwEvent({ type: 'clearSwDebugDbSuccess' });
          } catch (err) {
            try { if (event.ports && event.ports[0]) event.ports[0].postMessage({ success: false, error: String(err) }); } catch (_) {}
            logSwEvent({ type: 'clearSwDebugDbFailed', error: (err && err.message) || String(err) });
          }
        })();
      }
      break;
  }
});

self.addEventListener('notificationclick', (event) => {
  console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Notification clicked. Action: '${event.action}', hasAction: ${!!event.action}`);
  logSwEvent({ type: 'notificationclick', action: event.action || '', hasAction: !!event.action });
  event.notification.close();

  const payload = event.notification && event.notification.data ? event.notification.data : null;
  
  // Se action buttons não funcionam mas a notificação tem ações, mostra modal de seleção
  let action;
  if (event.action && event.action.trim().length > 0) {
    action = event.action;
  } else if (payload && payload.hasActions) {
    action = 'select_action'; // Ação especial para mostrar modal de seleção
  } else {
    action = 'view';
  }
  
  console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Processed action: '${action}', payload:`, payload);

  if (action === 'close') {
    console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Close action, doing nothing.`);
    return;
  }

  event.waitUntil(
    (async () => {
      console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Handling notification click...`);
      // Broadcast immediately that a notificationclick was received (so clients see it fast)
      try {
        const bcPayload = { ts: Date.now(), action, data: payload };
        const clientListForBroadcast = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        clientListForBroadcast.forEach(c => { try { c.postMessage({ type: 'NOTIFICATION_CLICK_RECEIVED', payload: bcPayload }); } catch (_) {} });
        logSwEvent({ type: 'notificationClickBroadcast', action });
      } catch (_) {}

      // Persistir ação pendente para o cliente consumir ao abrir — aumenta chance de entrega no Android
      try {
        await addPendingAction({ action, data: payload });
        logSwEvent({ type: 'pendingActionSaved', action });
      } catch (e) {
        logSwEvent({ type: 'pendingActionSaveFailed', error: (e && e.message) || String(e) });
      }
      
      // Define a URL correta baseada na localização atual
      let baseUrl;
      if (self.location.hostname === 'crawzler.github.io') {
        baseUrl = 'https://crawzler.github.io/Voleizinho-das-Ruas/';
      } else if (self.location.hostname.includes('github.io')) {
        baseUrl = self.location.origin + '/Voleizinho-das-Ruas/';
      } else {
        baseUrl = self.location.origin + '/';
      }
      
      console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Base URL: ${baseUrl}`);
      
  // Primeiro, tenta encontrar uma janela existente
      const clientList = await clients.matchAll({ 
        type: 'window', 
        includeUncontrolled: true 
      });
      
      console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Found ${clientList.length} clients.`);
      
      // Construir URL com possíveis parâmetros de ação/ID (ex: #scheduling-page?action=going&id=...)
      const urlParams = [];
      try { if (payload && payload.id) urlParams.push(`id=${encodeURIComponent(String(payload.id))}`); } catch (e) {}
      try { if (action) urlParams.push(`action=${encodeURIComponent(String(action))}`); } catch (e) {}
      const paramStr = urlParams.length ? `?${urlParams.join('&')}` : '';
      const urlWithHash = baseUrl + '#scheduling-page' + paramStr;

      // Procura por uma janela do app que já esteja aberta
      let existingClient = null;
      for (const client of clientList) {
        if (client.url.includes('Voleizinho-das-Ruas') || 
            client.url.includes(self.location.origin)) {
          existingClient = client;
          break;
        }
      }

      if (existingClient) {
        console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Found existing client. Attempting to navigate/focus and send message.`);
        logSwEvent({ type: 'existingClientFound', clientUrl: existingClient.url });
        try {
          // Tenta navegar o cliente existente diretamente para a URL com params (alguns navegadores suportam)
          if (typeof existingClient.navigate === 'function') {
            try {
              await existingClient.navigate(urlWithHash);
              console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Navigated existing client to ${urlWithHash}`);
              logSwEvent({ type: 'existingClientNavigate', url: urlWithHash });
            } catch (navErr) {
              console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - existingClient.navigate() failed:`, navErr);
              logSwEvent({ type: 'existingClientNavigateFailed', error: (navErr && navErr.message) || String(navErr) });
            }
          }

          // Tenta focar
          try { await existingClient.focus(); logSwEvent({ type: 'existingClientFocus' }); } catch (focusErr) { console.log('existingClient.focus failed', focusErr); logSwEvent({ type: 'existingClientFocusFailed', error: (focusErr && focusErr.message) || String(focusErr) }); }

          // Envia mensagem como redundância
          for (let attempt = 1; attempt <= 3; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
            try {
              existingClient.postMessage({ type: 'NOTIFICATION_ACTION', action, data: payload });
              console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Message sent to existing client (attempt ${attempt}).`);
              logSwEvent({ type: 'postMessageSent', target: 'existingClient', attempt, action });
              break;
            } catch (msgError) {
              console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Message attempt ${attempt} failed:`, msgError);
              logSwEvent({ type: 'postMessageFailed', target: 'existingClient', attempt, error: (msgError && msgError.message) || String(msgError) });
            }
          }

          return existingClient;
        } catch (error) {
          console.error(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Error handling existing client:`, error);
        }
      }
      
    // Abre uma nova janela com hash para página de agendamentos (usa urlWithHash já construída)
    console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Opening new window: ${urlWithHash}`);
      
      if (clients.openWindow) {
        try {
      const newClient = await clients.openWindow(urlWithHash);
          
          if (newClient) {
            console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - New window opened successfully.`);

            // Tenta focar a nova janela imediatamente para trazê-la ao primeiro plano (Android/Chrome)
            try {
              if (typeof newClient.focus === 'function') {
                await newClient.focus();
                console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - newClient.focus() called.`);
                logSwEvent({ type: 'newClientFocus' });
              }
            } catch (focusErr) {
              console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - newClient.focus() failed:`, focusErr);
              logSwEvent({ type: 'newClientFocusFailed', error: (focusErr && focusErr.message) || String(focusErr) });
            }

            // Aguarda o app carregar e envia múltiplas tentativas de mensagem
            for (let attempt = 1; attempt <= 5; attempt++) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              
              try {
                // Tenta encontrar o cliente ativo
                const updatedClientList = await clients.matchAll({ 
                  type: 'window', 
                  includeUncontrolled: true 
                });
                
                let targetClient = newClient;
                for (const client of updatedClientList) {
                  if (client.url.includes('Voleizinho-das-Ruas') || 
                      client.url.includes(self.location.origin)) {
                    targetClient = client;
                    break;
                  }
                }

                // Tenta focar o cliente alvo antes de enviar a mensagem
                try {
                  if (targetClient && typeof targetClient.focus === 'function') {
                    await targetClient.focus();
                    console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - targetClient.focus() called (attempt ${attempt}).`);
                    logSwEvent({ type: 'targetClientFocus', attempt });
                  }
                } catch (focusErr2) {
                  console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - targetClient.focus() failed:`, focusErr2);
                  logSwEvent({ type: 'targetClientFocusFailed', attempt, error: (focusErr2 && focusErr2.message) || String(focusErr2) });
                }

                // Envia a mensagem
                targetClient.postMessage({ 
                  type: 'NOTIFICATION_ACTION', 
                  action, 
                  data: payload 
                });
                
                console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Message sent (attempt ${attempt}).`);
                logSwEvent({ type: 'postMessageSent', target: 'newClient', attempt, action });
                
                if (attempt >= 3) break; // Para após 3 tentativas bem-sucedidas
              } catch (msgError) {
                console.log(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Message attempt ${attempt} failed:`, msgError);
              }
            }

            return newClient;
          } else {
            console.error(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Failed to open new window.`);
          }
        } catch (error) {
          console.error(`[DEBUG: service-worker.js] ${new Date().toISOString()} - Error opening window:`, error);
        }
      } else {
        console.error(`[DEBUG: service-worker.js] ${new Date().toISOString()} - clients.openWindow not available.`);
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