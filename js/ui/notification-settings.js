// js/ui/notification-settings.js
// Interface para configurações de notificações

import { requestNotificationPermission, areNotificationsEnabled } from '../utils/notifications.js';
import { displayMessage } from './messages.js';

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
    
    button.addEventListener('click', async () => {
        if (areNotificationsEnabled()) {
            // Se já estão habilitadas, mostra status
            displayMessage('Notificações já estão ativadas! 🔔', 'info');
        } else {
            // Tenta solicitar permissão
            const granted = await requestNotificationPermission();
            if (granted) {
                displayMessage('Notificações ativadas! Você será notificado sobre novos jogos. 🔔', 'success');
                updateButtonState(button);
            } else {
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
    const icon = button.querySelector('.material-icons');
    const text = button.querySelector('.btn-text');
    
    if (isEnabled) {
        button.classList.add('enabled');
        icon.textContent = 'notifications_active';
        text.textContent = 'Notificações Ativas';
        button.title = 'Notificações estão ativadas';
    } else {
        button.classList.remove('enabled');
        icon.textContent = 'notifications_off';
        text.textContent = 'Ativar Notificações';
        button.title = 'Clique para ativar notificações';
    }
}

/**
 * Adiciona o botão de notificações à página de agendamentos
 */
export function addNotificationButtonToScheduling() {
    const schedulingPage = document.getElementById('scheduling-page');
    if (!schedulingPage) return;
    
    // Verifica se já existe o botão
    if (schedulingPage.querySelector('.notification-toggle-btn')) return;
    
    const button = createNotificationButton();
    
    // Adiciona o botão no topo da página
    const header = schedulingPage.querySelector('h2');
    if (header) {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'notification-button-container';
        buttonContainer.appendChild(button);
        header.parentNode.insertBefore(buttonContainer, header.nextSibling);
    }
}