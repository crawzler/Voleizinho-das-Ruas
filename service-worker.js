const CACHE_NAME = 'VdR-DZ-v0.1.7_Test';
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js' // Alterado de script.js para main.js, que é o ponto de entrada principal
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
