// js/utils/notifications.js
// Sistema de notificações push para agendamentos

/**
 * Solicita permissão para notificações
 */
export async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.warn('Este navegador não suporta notificações');
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission === 'denied') {
        return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
}

/**
 * Envia notificação para novo agendamento
 */
export async function notifyNewSchedule(schedule) {
    // Sempre mostra notificação visual na interface
    showInAppNotification(schedule);
    
    // Envia notificação push se permitida
    if (Notification.permission !== 'granted') return;

    const gameDate = new Date(schedule.date + 'T' + schedule.startTime);
    const formattedDate = gameDate.toLocaleDateString('pt-BR');
    const formattedTime = schedule.startTime;

    try {
        // Tenta usar Service Worker para notificação persistente
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('🏐 Novo Jogo Agendado!', {
            body: `📅 ${formattedDate} às ${formattedTime}\n📍 ${schedule.location}`,
            icon: './images/icon-192x192.png',
            badge: './images/icon-96x96.png',
            tag: 'new-schedule',
            requireInteraction: true,
            actions: [
                { action: 'view', title: '👀 Ver Detalhes' },
                { action: 'close', title: '❌ Fechar' }
            ]
        });
    } catch (error) {
        // Fallback para notificação simples
        const notification = new Notification('🏐 Novo Jogo Agendado!', {
            body: `📅 ${formattedDate} às ${formattedTime}\n📍 ${schedule.location}`,
            icon: './images/icon-192x192.png',
            tag: 'new-schedule'
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };

        setTimeout(() => notification.close(), 10000);
    }
}

/**
 * Envia notificação para jogo cancelado
 */
export async function notifyCancelledSchedule(schedule) {
    // Sempre mostra notificação visual na interface
    showInAppNotification(schedule, 'cancelled');
    
    // Envia notificação push se permitida
    if (Notification.permission !== 'granted') return;

    const gameDate = new Date(schedule.date + 'T' + schedule.startTime);
    const formattedDate = gameDate.toLocaleDateString('pt-BR');
    const formattedTime = schedule.startTime;

    try {
        // Tenta usar Service Worker para notificação persistente
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('❌ Jogo Cancelado', {
            body: `📅 ${formattedDate} às ${formattedTime}\n📍 ${schedule.location}`,
            icon: './images/icon-192x192.png',
            badge: './images/icon-96x96.png',
            tag: 'cancelled-schedule',
            requireInteraction: true,
            actions: [
                { action: 'view', title: '👀 Ver Detalhes' },
                { action: 'close', title: '❌ Fechar' }
            ]
        });
    } catch (error) {
        // Fallback para notificação simples
        const notification = new Notification('❌ Jogo Cancelado', {
            body: `📅 ${formattedDate} às ${formattedTime}\n📍 ${schedule.location}`,
            icon: './images/icon-192x192.png',
            tag: 'cancelled-schedule'
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };

        setTimeout(() => notification.close(), 10000);
    }
}

/**
 * Mostra notificação visual na interface
 */
function showInAppNotification(schedule, type = 'new') {
    // Remove notificações existentes
    const existingNotifications = document.querySelectorAll('.schedule-notification');
    existingNotifications.forEach(notif => {
        if (notif.parentNode) {
            notif.parentNode.removeChild(notif);
        }
    });
    
    const gameDate = new Date(schedule.date + 'T' + schedule.startTime);
    const formattedDate = gameDate.toLocaleDateString('pt-BR');
    const formattedTime = schedule.startTime;
    
    const notification = document.createElement('div');
    notification.className = `schedule-notification ${type === 'cancelled' ? 'cancelled' : ''}`;
    
    const content = type === 'cancelled' ? {
        icon: '❌',
        title: 'Jogo Cancelado!',
        gradient: 'linear-gradient(135deg, #DC2626, #B91C1C)'
    } : type === 'today' ? {
        icon: '🏐',
        title: 'Jogo Hoje!',
        gradient: 'linear-gradient(135deg, #F59E0B, #D97706)'
    } : {
        icon: '🏐',
        title: 'Novo Jogo Agendado!',
        gradient: 'linear-gradient(135deg, #2563EB, #1D4ED8)'
    };
    
    notification.style.background = content.gradient;
    notification.innerHTML = `
        <div class="schedule-notification-header">
            <span class="material-icons">${content.icon}</span>
            ${content.title}
        </div>
        <div class="schedule-notification-body">
            📅 ${formattedDate} às ${formattedTime}<br>
            📍 ${schedule.location}
            ${schedule.notes ? `<br>📝 ${schedule.notes}` : ''}
        </div>
    `;
    
    // Adiciona ao body
    document.body.appendChild(notification);
    
    // Remove após 5 segundos
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
    
    // Permite fechar clicando
    notification.addEventListener('click', () => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    });
}

/**
 * Registra service worker para notificações
 */
export async function registerNotificationServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.ready;
            
            // Adiciona listener para ações de notificação
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'NOTIFICATION_ACTION') {
                    handleNotificationAction(event.data.action);
                }
            });

            return registration;
        } catch (error) {
            console.error('Erro ao registrar service worker para notificações:', error);
        }
    }
    return null;
}

/**
 * Trata ações das notificações
 */
function handleNotificationAction(action) {
    switch (action) {
        case 'view':
            // Navega para a página de agendamentos
            if (window.location.hash !== '#scheduling') {
                window.location.hash = '#scheduling';
            }
            break;
        case 'close':
            // Apenas fecha a notificação
            break;
    }
}

/**
 * Verifica se as notificações estão habilitadas
 */
export function areNotificationsEnabled() {
    const config = JSON.parse(localStorage.getItem('volleyballConfig') || '{}');
    return 'Notification' in window && 
           Notification.permission === 'granted' && 
           config.notificationsEnabled !== false;
}

/**
 * Salva preferência de notificações
 */
export function setNotificationsEnabled(enabled) {
    const config = JSON.parse(localStorage.getItem('volleyballConfig') || '{}');
    config.notificationsEnabled = enabled;
    localStorage.setItem('volleyballConfig', JSON.stringify(config));
}

/**
 * Obtém preferência de notificações
 */
export function getNotificationsPreference() {
    const config = JSON.parse(localStorage.getItem('volleyballConfig') || '{}');
    return config.notificationsEnabled !== false; // padrão é true
}

/**
 * Verifica se as notificações são suportadas
 */
export function areNotificationsSupported() {
    return 'Notification' in window;
}

/**
 * Envia notificação para jogo do dia
 */
export async function notifyTodayGame(schedule) {
    // Sempre mostra notificação visual na interface
    showInAppNotification(schedule, 'today');
    
    // Envia notificação push se permitida
    if (Notification.permission !== 'granted') return;

    const gameDate = new Date(schedule.date + 'T' + schedule.startTime);
    const formattedTime = schedule.startTime;

    try {
        // Tenta usar Service Worker para notificação persistente
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('🏐 Jogo Hoje!', {
            body: `⏰ ${formattedTime}\n📍 ${schedule.location}`,
            icon: './images/icon-192x192.png',
            badge: './images/icon-96x96.png',
            tag: 'today-game',
            requireInteraction: true,
            actions: [
                { action: 'view', title: '👀 Ver Detalhes' },
                { action: 'close', title: '❌ Fechar' }
            ]
        });
    } catch (error) {
        // Fallback para notificação simples
        const notification = new Notification('🏐 Jogo Hoje!', {
            body: `⏰ ${formattedTime}\n📍 ${schedule.location}`,
            icon: './images/icon-192x192.png',
            tag: 'today-game'
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };

        setTimeout(() => notification.close(), 10000);
    }
}