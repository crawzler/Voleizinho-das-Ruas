// js/ui/quick-settings.js
// Gerencia as configurações rápidas da partida

import { loadConfig, saveConfig } from './config-ui.js';
import { displayMessage } from './messages.js';

// Configura o modal de configurações rápidas
export function setupQuickSettings() {
    const quickSettingsButton = document.getElementById('quick-settings-button');
    const quickSettingsModal = document.getElementById('quick-settings-modal');
    const quickSettingsClose = document.getElementById('quick-settings-close');
    const pointsInput = document.getElementById('quick-points-per-set');
    const setsInput = document.getElementById('quick-number-of-sets');

    // Continua inicialização mesmo sem o botão (foi removido da UI)
    if (!quickSettingsModal) {
        // Log removido
        return;
    }

    // Carrega valores salvos na inicialização
    const loadValues = () => {
        const config = loadConfig();
        if (pointsInput) pointsInput.value = config.pointsPerSet || 15;
        if (setsInput) setsInput.value = config.numberOfSets || 1;
    };
    
    // Carrega valores iniciais
    loadValues();

    // Protege o modal de configurações contra o listener global que previne touchmove
    const quickSettingsContent = quickSettingsModal.querySelector('.quick-settings-content');
    if (quickSettingsContent) {
        // Evita que os eventos touch subam até document.body (onde um listener globall pode chamar preventDefault)
        quickSettingsContent.addEventListener('touchstart', (ev) => ev.stopPropagation(), { passive: false });
        quickSettingsContent.addEventListener('touchmove', (ev) => ev.stopPropagation(), { passive: false });
    }
    
    // Abre o modal se o botão existir (backward compatibility)
    if (quickSettingsButton) {
        quickSettingsButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Log removido
            loadValues(); // Recarrega valores atuais
            quickSettingsModal.classList.add('active');
        });
    }

    // Fecha o modal
    const closeModal = () => {
        // Log removido
        quickSettingsModal.classList.remove('active');
    };

    if (quickSettingsClose) {
        quickSettingsClose.addEventListener('click', closeModal);
    }

    // Fecha ao clicar fora
    quickSettingsModal.addEventListener('click', (e) => {
        if (e.target === quickSettingsModal) {
            closeModal();
        }
    });

    // Salva automaticamente ao alterar valores
    if (pointsInput) {
        pointsInput.addEventListener('input', () => {
            const value = parseInt(pointsInput.value) || 15;
            localStorage.setItem('volleyballConfig', JSON.stringify({
                ...loadConfig(),
                pointsPerSet: value
            }));
            // Log removido
        });
    }

    if (setsInput) {
        setsInput.addEventListener('input', () => {
            const value = parseInt(setsInput.value) || 1;
            localStorage.setItem('volleyballConfig', JSON.stringify({
                ...loadConfig(),
                numberOfSets: value
            }));
            // Log removido
        });
    }
}

// Exposto para abrir o modal diretamente pelo menu do placar
export function openQuickSettingsModal() {
    const quickSettingsModal = document.getElementById('quick-settings-modal');
    const pointsInput = document.getElementById('quick-points-per-set');
    const setsInput = document.getElementById('quick-number-of-sets');
    if (!quickSettingsModal) return;

    const config = loadConfig();
    if (pointsInput) pointsInput.value = config.pointsPerSet || 15;
    if (setsInput) setsInput.value = config.numberOfSets || 1;

    quickSettingsModal.classList.add('active');
}
