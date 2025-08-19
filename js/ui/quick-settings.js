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

    if (!quickSettingsButton || !quickSettingsModal) return;

    // Carrega valores salvos na inicialização
    const loadValues = () => {
        const config = loadConfig();
        if (pointsInput) pointsInput.value = config.pointsPerSet || 15;
        if (setsInput) setsInput.value = config.numberOfSets || 1;
    };
    
    // Carrega valores iniciais
    loadValues();
    
    // Abre o modal
    quickSettingsButton.addEventListener('click', () => {
        loadValues(); // Recarrega valores atuais
        quickSettingsModal.classList.add('active');
    });

    // Fecha o modal
    const closeModal = () => {
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
            const config = loadConfig();
            config.pointsPerSet = parseInt(pointsInput.value) || 15;
            saveConfig(config);
        });
    }

    if (setsInput) {
        setsInput.addEventListener('input', () => {
            const config = loadConfig();
            config.numberOfSets = parseInt(setsInput.value) || 1;
            saveConfig(config);
        });
    }
}