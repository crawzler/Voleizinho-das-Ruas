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
  './css/style.css',
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
  console.log('Service Worker: Instalando versão', CACHE_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Cache recursos estáticos críticos
      caches.open(STATIC_CACHE).then(cache => {
        console.log('Service Worker: Cacheando recursos estáticos...');
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
              console.warn(`Falha ao cachear ${url}:`, error.message);
              // Para recursos críticos, tenta novamente
              if (CRITICAL_RESOURCES.includes(url)) {
                setTimeout(() => {
                  fetch(url).then(r => r.ok && cache.put(url, r)).catch(() => {});
                }, 2000);
              }
            }
          })
        );
      }),
      
      // Cache recursos externos com estratégias específicas
      caches.open(DYNAMIC_CACHE).then(cache => {
        console.log('Service Worker: Cacheando recursos externos...');
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
              console.warn(`Falha ao cachear recurso externo ${url}:`, error.message);
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
  
  // Ignora URLs que não devem ser cacheadas
  if (IGNORE_PATTERNS.some(pattern => pattern.test(request.url))) {
    return;
  }
  
  // Determina a estratégia baseada no tipo de recurso
  const strategy = getStrategy(request, url);
  
  event.respondWith(handleRequest(request, strategy));
});

// Função para determinar a estratégia de cache
function getStrategy(request, url) {
  // Recursos externos com configuração específica
  if (EXTERNAL_RESOURCES[request.url]) {
    return EXTERNAL_RESOURCES[request.url].strategy || STRATEGIES.CACHE_FIRST;
  }
  
  // Documentos HTML - Network First com fallback
  if (request.destination === 'document') {
    return STRATEGIES.NETWORK_FIRST;
  }
  
  // Recursos estáticos - Cache First
  if (request.destination === 'script' || 
      request.destination === 'style' ||
      request.destination === 'image' ||
      url.pathname.includes('.js') ||
      url.pathname.includes('.css')) {
    return STRATEGIES.CACHE_FIRST;
  }
  
  // APIs e recursos dinâmicos - Network First
  if (url.pathname.includes('/api/') || 
      url.hostname !== location.hostname) {
    return STRATEGIES.NETWORK_FIRST;
  }
  
  // Padrão - Stale While Revalidate
  return STRATEGIES.STALE_WHILE_REVALIDATE;
}

// Função principal para lidar com requisições
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

// Estratégia Cache First
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetchWithTimeout(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone()).catch(e => 
        console.warn('Erro ao cachear:', e)
      );
    }
    return networkResponse;
  } catch (error) {
    return handleFetchError(request, error);
  }
}

// Estratégia Network First
async function networkFirst(request) {
  try {
    const networkResponse = await fetchWithTimeout(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone()).catch(e => 
        console.warn('Erro ao cachear:', e)
      );
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

// Estratégia Stale While Revalidate
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
    .catch(e => console.warn('Erro na atualização em background:', e));
  
  return cachedResponse || networkResponsePromise;
}

// Fetch com timeout
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

// Tratamento de erros de fetch
async function handleFetchError(request, error) {
  const url = new URL(request.url);
  
  // Fallback para documentos HTML
  if (request.destination === 'document') {
    const indexResponse = await caches.match('./index.html');
    if (indexResponse) {
      return indexResponse;
    }
  }
  
  // Fallback para Google Fonts
  if (url.hostname === 'fonts.googleapis.com') {
    const fallbackResponse = await caches.match('./css/offline-fallback.css');
    if (fallbackResponse) {
      return fallbackResponse;
    }
    return new Response('/* Offline fallback */', {
      headers: { 'Content-Type': 'text/css' }
    });
  }
  
  // Fallback para imagens
  if (request.destination === 'image') {
    return new Response('', { status: 200 });
  }
  
  // Fallback para APIs
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
  console.log('Service Worker: Ativando versão', CACHE_VERSION);
  const cacheWhitelist = [STATIC_CACHE, DYNAMIC_CACHE, RUNTIME_CACHE];
  
  event.waitUntil(
    Promise.all([
      // Limpa caches antigos
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (!cacheWhitelist.includes(cacheName)) {
              console.log(`Service Worker: Deletando cache antigo: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Limpa entradas antigas do cache dinâmico
      cleanupOldCacheEntries(),
      
      // Assume controle imediatamente
      self.clients.claim()
    ])
  );
  
  console.log('Service Worker: Ativado e assumiu controle.');
});

// Função para limpar entradas antigas do cache
async function cleanupOldCacheEntries() {
  try {
    const cache = await caches.open(RUNTIME_CACHE);
    const requests = await cache.keys();
    
    if (requests.length > CLEANUP.MAX_ENTRIES) {
      const entriesToDelete = requests.slice(0, requests.length - CLEANUP.MAX_ENTRIES);
      await Promise.all(
        entriesToDelete.map(request => cache.delete(request))
      );
      console.log(`Service Worker: Limpou ${entriesToDelete.length} entradas antigas do cache`);
    }
  } catch (error) {
    console.warn('Erro na limpeza do cache:', error);
  }
}

// Gerenciamento de mensagens
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

// Listener para cliques em notificações
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const action = event.action;
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Se há uma janela aberta, foca nela
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_ACTION', action });
          return client.focus();
        }
      }
      
      // Se não há janela aberta, abre uma nova
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Listener para fechamento de notificações
self.addEventListener('notificationclose', (event) => {
  console.log('Notificação fechada:', event.notification.tag);
});

// Função para limpar todos os caches
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
  console.log('Service Worker: Todos os caches foram limpos');
}

// Função para obter estatísticas do cache
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

// Listener para erros não tratados
self.addEventListener('error', (event) => {
  console.error('Service Worker: Erro não tratado:', event.error);
});

// Listener para promises rejeitadas
self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker: Promise rejeitada:', event.reason);
  event.preventDefault();
});

console.log('Service Worker: Carregado com sucesso - Versão', CACHE_VERSION);
