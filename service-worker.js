const CACHE_NAME = 'volei-das-ruas-v0.1';

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './service-worker.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  './images/icon-48x48.png',
  './images/icon-72x72.png',
  './images/icon-96x96.png',
  './images/icon-144x144.png',
  './images/icon-192x192.png',
  './images/icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) {
        // Se a requisição for HTTP/HTTPS, tenta buscar da rede para atualizar a cache
        if (event.request.url.startsWith('http') || event.request.url.startsWith('https')) {
          fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, responseToCache);
                });
              }
            })
            .catch(error => {}); // Ignora erros de rede para não quebrar o retorno da cache
        }
        return response; // Retorna a versão da cache imediatamente
      }

      // Se não estiver na cache, tenta buscar da rede
      // Apenas guarda em cache se for uma requisição HTTP/HTTPS válida
      if (event.request.url.startsWith('http') || event.request.url.startsWith('https')) {
        return fetch(event.request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(error => {
            // Pode adicionar um fallback para uma página offline aqui, se desejar
            throw error;
          });
      } else {
        // Para requisições não HTTP/HTTPS (ex: chrome-extension), não tenta cachear e apenas busca
        return fetch(event.request);
      }
    })
  );
});
