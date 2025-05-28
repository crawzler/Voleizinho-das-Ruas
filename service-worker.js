// service-worker.js

// Define o nome do cache. É crucial que este nome seja atualizado (incrementado)
// a cada nova versão do seu aplicativo para garantir que o Service Worker
// instale a nova versão e limpe os caches antigos.
const CACHE_NAME = 'placar-volei-v2.3'; // MUDANÇA: Incrementado para forçar a atualização

// Lista de URLs para pré-cachear. Estes são os recursos essenciais para o
// funcionamento offline do seu aplicativo.
const urlsToCache = [
  './', // O arquivo HTML principal (raiz do seu app)
  './index.html', // O arquivo HTML principal explicitamente
  './manifest.json', // O manifesto do PWA
  './service-worker.js', // O próprio Service Worker (para garantir que ele seja atualizado)
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css', // CSS do Font Awesome
  // Adicione todos os seus arquivos de ícones aqui para pré-cache
  './images/icon-48x48.png',
  './images/icon-72x72.png',
  './images/icon-96x96.png',
  './images/icon-144x144.png',
  './images/icon-192x192.png',
  './images/icon-512x512.png'
];

// Evento 'install': É acionado quando o Service Worker é instalado.
// Neste evento, abrimos um cache e adicionamos todos os recursos listados em `urlsToCache`.
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando e pré-cacheando recursos.');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Cache aberto e recursos pré-cacheados.');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Service Worker: Falha ao pré-cachear recursos.', error);
      })
  );
});

// Evento 'activate': É acionado quando o Service Worker é ativado.
// Este é o lugar ideal para limpar caches antigos que não são mais necessários.
self.addEventListener('activate', event => {
  console.log('Service Worker: Ativando e limpando caches antigos.');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Verifica se o nome do cache atual é diferente do CACHE_NAME.
          // Se for diferente, significa que é um cache antigo e deve ser deletado.
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deletando cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    // MUDANÇA CRUCIAL: self.clients.claim()
    // Isso faz com que o novo Service Worker assuma o controle da página
    // imediatamente após a ativação, sem a necessidade de fechar e reabrir as abas.
    // Isso é fundamental para que as atualizações sejam aplicadas mais rapidamente.
    .then(() => self.clients.claim())
  );
});

// Evento 'fetch': Intercepta todas as requisições de rede feitas pelo aplicativo.
// Implementa uma estratégia de "Cache, then Network" com atualização de cache.
// Primeiro, tenta servir o recurso do cache para uma resposta rápida.
// Em segundo plano, busca a versão mais recente na rede e a atualiza no cache.
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      // Retorna o recurso do cache se ele existir.
      // Isso proporciona uma experiência offline e de carregamento rápido.
      if (response) {
        // MUDANÇA: Se a resposta estiver no cache, retornamos ela,
        // mas também tentamos buscar a versão mais recente em segundo plano.
        // Isso ajuda a manter o cache atualizado para futuras visitas.
        fetch(event.request)
          .then(networkResponse => {
            // Verifica se a resposta da rede é válida antes de tentar armazená-la.
            // Evita armazenar respostas de erro ou requisições não HTTP.
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseToCache = networkResponse.clone(); // Clona a resposta para que possa ser usada pelo cache e pelo navegador
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache); // Atualiza o cache com a nova versão
              });
            }
          })
          .catch(error => {
            console.warn('Service Worker: Falha ao buscar atualização em segundo plano para:', event.request.url, error);
            // Não há necessidade de relançar o erro aqui, pois já estamos retornando a versão do cache.
          });
        return response; // Retorna a versão do cache imediatamente
      }

      // Se o recurso não estiver no cache, busca na rede.
      return fetch(event.request)
        .then(networkResponse => {
          // Verifica se a resposta da rede é válida antes de tentar armazená-la.
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone(); // Clona a resposta
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache); // Adiciona o recurso ao cache
            });
          }
          return networkResponse; // Retorna a resposta da rede
        })
        .catch(error => {
          console.error('Service Worker: Falha na requisição de rede e sem cache para:', event.request.url, error);
          // Opcional: Aqui você pode retornar uma página offline personalizada ou um recurso de fallback.
          // Por exemplo: return caches.match('/offline.html');
          // Por enquanto, vamos apenas relançar o erro para que a aplicação saiba que a requisição falhou.
          throw error;
        });
    })
  );
});
