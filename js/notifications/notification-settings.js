// js/ui/notification-settings.js
// Interface para configurações de notificações

import { requestNotificationPermission, areNotificationsEnabled, setNotificationsEnabled, areNotificationsSupported } from '../utils/notifications.js';
import { displayMessage } from './messages.js';

// Função utilitária para query selector seguro
function safeQuerySelector(selector, parent = document) {
    try {
        return parent.querySelector(selector);
    } catch (e) {
        console.warn(`Erro ao buscar elemento: ${selector}`, e);
        return null;
    }
}

/**
 * Cria o botão de configuração de notificações
 */
export function createNotificationButton() {
    const button = document.createElement('button');
    button.className = 'notification-toggle-btn';
    button.innerHTML = `
        <span class="material-icons">notifications</span>
        <span class="btn-text">Notificações</span>
    `;
    
    updateButtonState(button);

    // Check if notifications are supported at all
    if (!areNotificationsSupported()) {
        button.disabled = true;
        button.title = 'Notificações não são suportadas neste dispositivo/navegador.';
        button.querySelector('.btn-text').textContent = 'Não Suportado';
        button.querySelector('.material-icons').textContent = 'notifications_off';
        displayMessage('As notificações não são suportadas neste dispositivo ou navegador. 🚫', 'error');
        return button; // Exit early if not supported
    }
    
    button.addEventListener('click', async () => {
        if (areNotificationsEnabled()) {
            // Se já estão habilitadas, mostra status
            displayMessage('Notificações já estão ativadas! 🔔', 'info');
        } else {
            // Tenta solicitar permissão
            const granted = await requestNotificationPermission();
            if (granted) {
                setNotificationsEnabled(true);
                displayMessage('Notificações ativadas! Você será notificado sobre novos jogos. 🔔', 'success');
                updateButtonState(button);
            } else {
                setNotificationsEnabled(false);
                displayMessage('Permissão negada. Ative nas configurações do navegador para receber notificações. ⚠️', 'warning');
            }
        }
    });
    
    return button;
}

/**
 * Atualiza o estado visual do botão
 */
function updateButtonState(button) {
    const isEnabled = areNotificationsEnabled();
    const icon = safeQuerySelector('.material-icons', button);
    const text = safeQuerySelector('.btn-text', button);
    
    if (isEnabled) {
        button.classList.add('enabled');
        if (icon) icon.textContent = 'notifications_active';
        if (text) text.textContent = 'Notificações Ativas';
        button.title = 'Notificações estão ativadas';
    } else {
        button.classList.remove('enabled');
        if (icon) icon.textContent = 'notifications_off';
        if (text) text.textContent = 'Ativar Notificações';
        button.title = 'Clique para ativar notificações';
    }
}

/**
 * Adiciona o botão de notificações à página de agendamentos
 */
export function addNotificationButtonToScheduling() {
    try {
        const schedulingPage = document.getElementById('scheduling-page');
        if (!schedulingPage) return;
        
        // Verifica se já existe o botão
        if (schedulingPage.querySelector('.notification-toggle-btn')) return;
        
        const button = createNotificationButton();
        
        // Adiciona o botão no topo da página
        const header = safeQuerySelector('h2', schedulingPage);
        if (header && header.parentNode) {
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'notification-button-container';
            buttonContainer.appendChild(button);
            header.parentNode.insertBefore(buttonContainer, header.nextSibling);
        }
    } catch (error) {
        console.warn('Erro ao adicionar botão de notificações:', error);
    }
}
