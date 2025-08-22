// js/ui/welcome-notifications.js
// Modal de boas-vindas para solicitar permissão de notificações

import { requestNotificationPermission, setNotificationsEnabled } from '../utils/notifications.js';
import { displayMessage } from './messages.js';

const WELCOME_SHOWN_KEY = 'welcomeNotificationsShown';

/**
 * Verifica se deve mostrar o modal de boas-vindas
 */
export function shouldShowWelcomeModal() {
    const hasShown = localStorage.getItem(WELCOME_SHOWN_KEY);
    const hasNotificationPermission = 'Notification' in window && Notification.permission !== 'default';
    
    return !hasShown && !hasNotificationPermission;
}

/**
 * Mostra o modal de boas-vindas para notificações
 */
export function showWelcomeNotificationsModal() {
    const modal = document.getElementById('welcome-notifications-modal');
    if (!modal) return;

    modal.classList.add('show');
    
    // Configura botões
    const allowBtn = document.getElementById('welcome-allow-notifications');
    const denyBtn = document.getElementById('welcome-deny-notifications');
    
    if (allowBtn) {
        allowBtn.onclick = async () => {
            const granted = await requestNotificationPermission();
            
            if (granted) {
                setNotificationsEnabled(true);
                displayMessage('Notificações ativadas! 🔔', 'success');
            } else {
                setNotificationsEnabled(false);
                displayMessage('Você pode ativar depois nas configurações', 'info');
            }
            
            hideWelcomeModal();
        };
    }
    
    if (denyBtn) {
        denyBtn.onclick = () => {
            setNotificationsEnabled(false);
            displayMessage('Você pode ativar depois nas configurações', 'info');
            hideWelcomeModal();
        };
    }
}

/**
 * Esconde o modal de boas-vindas
 */
function hideWelcomeModal() {
    const modal = document.getElementById('welcome-notifications-modal');
    if (modal) {
        modal.classList.remove('show');
        
        // Marca como mostrado
        localStorage.setItem(WELCOME_SHOWN_KEY, 'true');
        
        // Remove listeners
        setTimeout(() => {
            const allowBtn = document.getElementById('welcome-allow-notifications');
            const denyBtn = document.getElementById('welcome-deny-notifications');
            
            if (allowBtn) allowBtn.onclick = null;
            if (denyBtn) denyBtn.onclick = null;
        }, 300);
    }
}

/**
 * Inicializa o sistema de boas-vindas
 */
export function initWelcomeNotifications() {
    // Aguarda um pouco para garantir que a página carregou
    setTimeout(() => {
        if (shouldShowWelcomeModal()) {
            showWelcomeNotificationsModal();
        }
    }, 2000); // 2 segundos após o carregamento
}
