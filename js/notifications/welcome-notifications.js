// js/ui/welcome-notifications.js
// Modal de boas-vindas para solicitar permissão de notificações

import { requestNotificationPermission, setNotificationsEnabled } from './notifications.js';
import { displayMessage } from '../ui/messages.js';

const WELCOME_SHOWN_KEY = 'welcomeNotificationsShown';
const SUPPRESS_NOTIF_PROMPT_KEY = 'notificationsPromptSuppressed';

/**
 * Verifica se deve mostrar o modal de boas-vindas
 */
export function shouldShowWelcomeModal() {
    if (!('Notification' in window)) return false;
    const suppressed = localStorage.getItem(SUPPRESS_NOTIF_PROMPT_KEY) === 'true';
    return Notification.permission === 'default' && !suppressed;
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
    const neverAskBtn = document.getElementById('welcome-never-ask');
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
            
            // Fecha o modal sem gravar flag permanente; o estado do navegador rege a próxima exibição
            const modal = document.getElementById('welcome-notifications-modal');
            if (modal) modal.classList.remove('show');
        };
    }
    
    if (neverAskBtn) {
        neverAskBtn.onclick = () => {
            try { localStorage.setItem(SUPPRESS_NOTIF_PROMPT_KEY, 'true'); } catch (_) {}
            setNotificationsEnabled(false);
            displayMessage('Não perguntaremos novamente. Você pode ativar depois nas configurações.', 'info');
            const modal = document.getElementById('welcome-notifications-modal');
            if (modal) modal.classList.remove('show');
        };
    }

    if (denyBtn) {
        denyBtn.onclick = () => {
            setNotificationsEnabled(false);
            displayMessage('Você pode ativar depois nas configurações', 'info');
            // Não marca como "mostrado permanentemente". Apenas fecha o modal.
            const modal = document.getElementById('welcome-notifications-modal');
            if (modal) modal.classList.remove('show');
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
        
        // Não grava mais a flag permanente aqui; a exibição será decidida por Notification.permission
        
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
