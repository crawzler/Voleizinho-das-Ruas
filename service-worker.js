const CACHE_NAME = 'placar-volei-v2'; // Nome do cache
const urlsToCache = [
  './', // O arquivo HTML principal
  './index.html', // Ou o nome do seu arquivo HTML, se for diferente de index.html
  './manifest.json',
  './service-worker.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css', // CSS do Font Awesome
  // Adicione todos os seus arquivos de ícones aqui
  './images/icon-48x48.png',
  './images/icon-72x72.png',
  './images/icon-96x96.png',
  './images/icon-144x144.png',
  './images/icon-192x192.png',
  './images/icon-512x512.png'
];

// Evento 'install': É acionado quando o Service Worker é instalado.
// Aqui, cacheamos todos os recursos essenciais para o funcionamento offline.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache aberto e recursos pré-cacheados.');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Service Worker: Falha ao pré-cachear recursos:', error);
      })
  );
});

// Evento 'activate': É acionado quando o Service Worker é ativado.
// Usado para limpar caches antigos, garantindo que apenas a versão mais recente esteja ativa.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Evento 'fetch': Intercepta todas as requisições de rede feitas pelo aplicativo.
// Primeiramente, tenta servir o recurso do cache. Se não estiver no cache, busca na rede.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Se o recurso estiver no cache, retorna-o
        if (response) {
          return response;
        }
        // Se não estiver no cache, busca na rede
        return fetch(event.request)
          .then(networkResponse => {
            // Clona a resposta da rede porque a resposta original pode ser lida apenas uma vez.
            const clonedResponse = networkResponse.clone();
            // Tenta adicionar a resposta da rede ao cache para futuras requisições
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, clonedResponse);
            });
            return networkResponse;
          })
          .catch(error => {
            console.error('Service Worker: Falha na requisição de rede:', event.request.url, error);
            // Aqui você pode retornar uma página offline personalizada, se tiver uma.
            // Por exemplo: return caches.match('/offline.html');
          });
      })
  );
});