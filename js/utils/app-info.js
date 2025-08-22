// js/utils/app-info.js
// Lógica para carregar informações do aplicativo (versão) e registrar Service Worker.

import * as Elements from '../ui/elements.js'; // Caminho corrigido

/**
 * Carrega e exibe a versão do aplicativo a partir do sw-config.js.
 */
export async function loadAppVersion() {
    const versionElement = Elements.appVersionDisplay();
    if (versionElement) {
        try {
            const response = await fetch('./sw-config.js');
            const text = await response.text();
            const match = text.match(/CACHE_VERSION: '(.*?)'/); 
            if (match && match[1]) {
                versionElement.textContent = `Versão: ${match[1]}`;
            } else {
                versionElement.textContent = 'Versão: Não disponível';
            }
        } catch (error) {
            // Log removido
            versionElement.textContent = 'Versão: Erro ao carregar';
        }
    } else {
        // Log removido
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
                    // Log removido
                });
        });
    }
}
