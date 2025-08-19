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

    if (!quickSettingsButton || !quickSettingsModal) {
        console.error('Elementos do modal de configurações rápidas não encontrados');
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
    
    // Abre o modal
    quickSettingsButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Botão de configurações rápidas clicado');
        loadValues(); // Recarrega valores atuais
        quickSettingsModal.classList.add('active');
    });

    // Fecha o modal
    const closeModal = () => {
        console.log('Fechando modal de configurações rápidas');
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
            console.log('Pontos por set salvos:', value);
        });
    }

    if (setsInput) {
        setsInput.addEventListener('input', () => {
            const value = parseInt(setsInput.value) || 1;
            localStorage.setItem('volleyballConfig', JSON.stringify({
                ...loadConfig(),
                numberOfSets: value
            }));
            console.log('Número de sets salvos:', value);
        });
    }
}