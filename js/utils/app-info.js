// js/utils/app-info.js
// Lógica para carregar informações do aplicativo (versão) e registrar Service Worker.

import * as Elements from '../ui/elements.js'; // Caminho corrigido

/**
 * Carrega e exibe a versão do aplicativo a partir do Service Worker.
 */
export async function loadAppVersion() {
    if (Elements.appVersionDisplay()) {
        try {
            const response = await fetch('./service-worker.js');
            const text = await response.text();
            const match = text.match(/const CACHE_NAME = '(.*?)';/);
            if (match && match[1]) {
                Elements.appVersionDisplay().textContent = match[1];
            } else {
                Elements.appVersionDisplay().textContent = 'Não disponível';
            }
        } catch (error) {
            // Apenas erro crítico mantido
            console.error('Erro ao carregar a versão do app:', error);
            Elements.appVersionDisplay().textContent = 'Erro ao carregar';
        }
    }
}

/**
 * Registra o Service Worker do aplicativo.
 */
export function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js')
                .catch(error => {
                    // Apenas erro crítico mantido
                    console.error('Falha no registro do Service Worker:', error);
                });
        });
    }
}
