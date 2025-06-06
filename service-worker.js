const CACHE_NAME = 'VdR-DZ-v0.2.1_Test';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './assets/app-logo.png',
  './assets/google-icon.png',
  './images/icon-48x48.png',
  './images/icon-72x72.png',
  './images/icon-96x96.png',
  './images/icon-144x144.png',
  './images/icon-192x192.png',
  './images/icon-512x512.png',
  './js/main.js',
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
  'https://fonts.googleapis.com/icon?family=Material+Icons'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Removido 'https://fonts.googleapis.com/icon?family=Material+Icons' daqui
        // para evitar erros de CORS ou falhas de rede durante o cache inicial.
        // O navegador ainda vai carregar a fonte diretamente do HTML.
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Falha ao adicionar URLs ao cache durante a instalação:', error);
        // Permite que o Service Worker continue a instalação mesmo se o cache inicial falhar.
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
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
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
