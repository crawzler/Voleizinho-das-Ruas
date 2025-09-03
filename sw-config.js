// sw-config.js
// Configurações avançadas para o Service Worker

const SW_CONFIG = {
    // Versão do cache - incremente para forçar atualização
    CACHE_VERSION: 'VdR-0.6.9f_RMK',
    
    // Estratégias de cache
    STRATEGIES: {
        CACHE_FIRST: 'cache-first',
        NETWORK_FIRST: 'network-first',
        STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
    },
    
    // Configurações de timeout
    TIMEOUTS: {
        NETWORK_TIMEOUT: 5000,
        CACHE_TIMEOUT: 2000
    },
    
    // Recursos críticos que devem sempre estar em cache
    CRITICAL_RESOURCES: [
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
        './js/main.js'
    ],
    
    // Recursos que podem ser cacheados dinamicamente
    DYNAMIC_CACHE_PATTERNS: [
        /\.js$/,
        /\.css$/,
        /\.html$/,
        /\.png$/,
        /\.jpg$/,
        /\.jpeg$/,
        /\.svg$/,
        /\.ico$/
    ],
    
    // URLs que devem ser ignoradas pelo cache
    IGNORE_PATTERNS: [
        /\/api\/analytics/,
        /\/api\/logs/,
        /chrome-extension:/,
        /moz-extension:/
    ],
    
    // Recursos externos com fallbacks
    EXTERNAL_RESOURCES: {
        'https://fonts.googleapis.com/icon?family=Material+Icons': {
            fallback: './css/offline-fallback.css',
            strategy: 'STALE_WHILE_REVALIDATE'
        },
        'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js': {
            strategy: 'CACHE_FIRST'
        },
        'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js': {
            strategy: 'CACHE_FIRST'
        },
        'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js': {
            strategy: 'CACHE_FIRST'
        }
    },
    
    // Configurações de limpeza de cache
    CLEANUP: {
        MAX_AGE_DAYS: 7,
        MAX_ENTRIES: 100
    }
};

// Exporta para uso no service worker
if (typeof self !== 'undefined') {
    self.SW_CONFIG = SW_CONFIG;
}

// Exporta para uso em módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SW_CONFIG;
}
