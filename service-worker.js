const CACHE_NAME = 'VdR-DZ-v0.2.4k_Test';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './assets/app-logo.png', // Verifique se este caminho está correto ou se o logo é usado
  './assets/google-icon.png', // Verifique se este caminho está correto ou se o ícone é usado
  './images/icon-48x48.png',
  './images/icon-72x72.png',
  './images/icon-96x96.png',
  './images/icon-144x144.png',
  './images/icon-192x192.png',
  './images/icon-512x512.png',
  './js/main.js',
  // Adicionando todas as dependências JavaScript explicitamente
  './js/data/players.js',
  './js/firebase/auth.js',
  './js/firebase/config.js',
  './js/game/logic.js',
  './js/game/teams.js',
  './js/ui/config-ui.js',
  './js/ui/elements.js',
  './js/ui/game-ui.js',
  './js/ui/messages.js',
  './js/ui/pages.js',
  './js/ui/players-ui.js',
  './js/utils/app-info.js',
  './js/utils/helpers.js',
  './js/ui/history-ui.js',
  './js/data/history.js', // Certifique-se de cachear este também
  './js/ui/scheduling-ui.js', // Certifique-se de cachear este também


  // Adicionando as dependências do Firebase importadas via URL (agora com as URLs completas e versões explícitas)
  "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js",
  "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js",
  "https://fonts.googleapis.com/icon?family=Material+Icons"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Cache aberto e adicionando URLs...');
        return cache.addAll(urlsToCache)
          .then(() => console.log('Service Worker: Todas as URLs adicionadas ao cache com sucesso.'))
          .catch((e) => console.error('Service Worker: Erro ao adicionar algumas URLs ao cache:', e));
      })
      .catch((error) => {
        console.error('Service Worker: Falha ao abrir cache durante a instalação:', error);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Se a requisição está no cache, retorna-a
        if (response) {
          console.log(`Service Worker: Servindo do cache: ${event.request.url}`);
          return response;
        }
        // Se não estiver no cache, tenta buscar da rede
        console.log(`Service Worker: Buscando da rede: ${event.request.url}`);
        return fetch(event.request)
          .then((networkResponse) => {
            // Se a requisição foi bem-sucedida e não é um erro de rede,
            // clona a resposta e a adiciona ao cache para futuras utilizações.
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                })
                .catch((e) => console.warn(`Service Worker: Erro ao cachear ${event.request.url}:`, e));
            }
            return networkResponse;
          })
          .catch((error) => {
            console.error(`Service Worker: Erro de rede ao buscar ${event.request.url}:`, error);
            // Isso é onde você poderia servir uma página de fallback offline, se houver
            // Ex: return caches.match('/offline.html');
            // Para este app, simplesmente falhamos a requisição se não estiver no cache e houver erro de rede
            throw error; // Propaga o erro se não conseguir servir do cache ou da rede
          });
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log(`Service Worker: Deletando cache antigo: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  console.log('Service Worker: Ativado.');
});
