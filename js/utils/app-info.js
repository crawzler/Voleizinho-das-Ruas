// js/utils/app-info.js
// Lógica para carregar informações do aplicativo (versão) e registrar Service Worker.

import * as Elements from '../ui/elements.js'; // Caminho corrigido

/**
 * Carrega e exibe a versão do aplicativo a partir do Service Worker.
 */
export async function loadAppVersion() {
    if (Elements.appVersionDisplay) {
        try {
            const response = await fetch('./service-worker.js'); // Caminho relativo ao root do app
            const text = await response.text();
            const match = text.match(/const CACHE_NAME = '(.*?)';/);
            if (match && match[1]) {
                Elements.appVersionDisplay.textContent = match[1];
            } else {
                Elements.appVersionDisplay.textContent = 'Não disponível';
            }
        } catch (error) {
            console.error('Erro ao carregar a versão do app:', error);
            Elements.appVersionDisplay.textContent = 'Erro ao carregar';
        }
    }
}

/**
 * Registra o Service Worker do aplicativo.
 */
export function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js') // Caminho relativo ao root do app
                .then(registration => {
                    console.log('Service Worker registrado com sucesso:', registration);
                })
                .catch(error => {
                    console.error('Falha no registro do Service Worker:', error);
                });
        });
    } else {
        console.warn('Service Workers não são suportados neste navegador.');
    }
}
