// js/utils/notifications.js
// Sistema de notificações push para agendamentos

import { showPage } from '../ui/pages.js';
import * as Elements from '../ui/elements.js';
import { getCurrentUser } from '../firebase/auth.js'; // Import for user data
import { renderScheduledGames } from '../ui/scheduling-ui.js'; // Import for local schedule management and modal


/**
 * Solicita permissão para notificações
 */
export async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('[DEBUG: notifications.js] Notifications not supported.');
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
    console.log(`[DEBUG: notifications.js] Chamando notifyNewSchedule com:`, schedule);

    // Sempre mostra notificação visual na interface
    showInAppNotification(schedule);
    
    // Envia notificação push se permitida
    if (Notification.permission !== 'granted') {
        console.log(`[DEBUG: notifications.js] Permissão de notificação não concedida. Estado atual: ${Notification.permission}`);
        return;
    }

    const gameDate = new Date(schedule.date + 'T' + schedule.startTime);
    const formattedDate = gameDate.toLocaleDateString('pt-BR');
    const formattedTime = schedule.startTime;

    const currentUser = getCurrentUser();
    const userId = currentUser ? currentUser.uid : null; // Obter o UID do usuário logado

    const notificationOptions = {
        body: `📅 ${formattedDate} às ${formattedTime}\n📍 ${schedule.location}`,
        icon: './images/icon-192x192.png',
        badge: './images/icon-96x96.png',
        tag: 'new-schedule',
        requireInteraction: true,
        actions: [
            { action: 'going', title: '✅ Vou' },
            { action: 'not_going', title: '🚫 Não vou' },
            { action: 'maybe', title: 'Talvez' }
        ],
        data: { type: 'schedule', id: schedule.id, userId: userId } // ADICIONADO userId AQUI
    };

    console.log('[DEBUG: notifications.js] Payload da notificação:', notificationOptions);

    try {
        // Tenta usar Service Worker para notificação persistente
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('🏐 Novo Jogo Agendado!', notificationOptions);
        console.log('[DEBUG: notifications.js] Notificação de novo agendamento enviada via Service Worker.');
    } catch (error) {
        console.error('[DEBUG: notifications.js] Erro ao enviar notificação via Service Worker:', error);
        // Fallback para notificação simples
        try {
            const notification = new Notification('🏐 Novo Jogo Agendado!', {
                body: notificationOptions.body,
                icon: notificationOptions.icon,
                tag: notificationOptions.tag
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
            };

            setTimeout(() => notification.close(), 10000);
            console.log('[DEBUG: notifications.js] Notificação de novo agendamento enviada via fallback.');
        } catch (fallbackError) {
            console.error('[DEBUG: notifications.js] Erro ao enviar notificação de fallback:', fallbackError);
        }
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
    const reasonText = schedule.cancelReason ? `\n⚠️ ${schedule.cancelReason}` : '';

    try {
        // Tenta usar Service Worker para notificação persistente
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('❌ Jogo Cancelado', {
            body: `📅 ${formattedDate} às ${formattedTime}\n📍 ${schedule.location}${reasonText}`,
            icon: './images/icon-192x192.png',
            badge: './images/icon-96x96.png',
            tag: 'cancelled-schedule',
            requireInteraction: true,
            // Removido: ações de presença não devem aparecer nesta notificação
            data: { type: 'schedule', id: schedule.id }
        });
    } catch (error) {
        // Fallback para notificação simples
        const notification = new Notification('❌ Jogo Cancelado', {
            body: `📅 ${formattedDate} às ${formattedTime}\n📍 ${schedule.location}${reasonText}`,
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
            ${type === 'cancelled' && schedule.cancelReason ? `<br><strong>⚠️ Motivo:</strong> ${schedule.cancelReason}` : ''}
        </div>
    `;

    // Adiciona ao topo da página
    document.body.appendChild(notification);

    // Animação de entrada e saída
    requestAnimationFrame(() => {
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    });
}

/**
 * Registra service worker para notificações
 */
export async function registerNotificationServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            console.log('[DEBUG: notifications.js] 2023-10-27T10:00:00.000Z - Registering service worker listener.');
            const registration = await navigator.serviceWorker.ready;
            
            // Adiciona listener para ações de notificação
            navigator.serviceWorker.addEventListener('message', (event) => {
                console.log('[DEBUG: notifications.js] 2023-10-27T10:00:00.000Z - Message received from service worker.');
                if (event.data && event.data.type === 'NOTIFICATION_ACTION') {
                    console.log('[DEBUG: notifications.js] 2023-10-27T10:00:00.000Z - Handling NOTIFICATION_ACTION.');
                    handleNotificationAction(event.data.action, event.data.data || null);
                }
            });

            return registration;
        } catch (error) {
            console.error("Error registering notification service worker:", error);
        }
    }
    return null;
}

/**
 * Trata ações das notificações
 */
function handleNotificationAction(action, data) {
    console.log(`[DEBUG: notifications.js] 2023-10-27T10:00:00.000Z - handleNotificationAction called. Action: ${action}`);
    sessionStorage.setItem('fromNotification', 'true');

    // Garante que action nunca seja vazio
    const normalizedAction = action && action.length > 0 ? action : 'view';

    const executeAction = () => {
        console.log(`[DEBUG: notifications.js] 2023-10-27T10:00:00.000Z - App is ready, executing action.`);
        switch (normalizedAction) {
            case 'going':
            case 'not_going':
            case 'maybe':
                if (data && data.id) {
                    // Inclui o nome correto do jogador logado
                    let playerName = null;
                    try {
                        const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
                        playerName = user && (user.displayName || user.email) ? (user.displayName || user.email) : null;
                    } catch (_) { /* noop */ }

                    // Debug antes de gravar
                    console.log('[DEBUG: notifications.js] Salvando lastRSVPData no sessionStorage:', { action: normalizedAction, scheduleId: data.id, data, playerName });
                    const lastRSVPData = { action: normalizedAction, scheduleId: data.id, data: data, playerName };
                    sessionStorage.setItem('lastRSVPData', JSON.stringify(lastRSVPData));
                    // Debug depois de gravar
                    console.log('[DEBUG: notifications.js] lastRSVPData gravado (sessionStorage):', sessionStorage.getItem('lastRSVPData'));
                    // Dispara evento customizado
                    const rsvpEvent = new CustomEvent('schedule-rsvp', { detail: lastRSVPData });
                    window.dispatchEvent(rsvpEvent);
                }
                showPage('scheduling-page');
                break;
            case 'view':
                // Salva intenção de abrir o modal de presença ao entrar na página de agendamentos
                if (data && data.id) {
                    sessionStorage.setItem('pendingOpenRsvpScheduleId', data.id);
                }
                showPage('scheduling-page');
                break;
            case 'close':
                // Do nothing
                break;
        }
    };

    const waitForAppReady = () => {
        console.log(`[DEBUG: notifications.js] 2023-10-27T10:00:00.000Z - Waiting for app to be ready...`);
        if (window.isAppReady) {
            executeAction();
        } else {
            setTimeout(waitForAppReady, 100);
        }
    };

    waitForAppReady();
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
            // Removido: ações de presença não devem aparecer nesta notificação
            data: { type: 'schedule', id: schedule.id }
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



export function areNotificationsEnabled() {
    try {
        const value = localStorage.getItem('notificationsEnabled');
        return value === null ? true : value === 'true';
    } catch (_) {
        return true;
    }
}

export function setNotificationsEnabled(enabled) {
    try {
        localStorage.setItem('notificationsEnabled', enabled ? 'true' : 'false');
    } catch (_) { /* noop */ }
}

export function getNotificationsPreference() {
    try {
        const raw = localStorage.getItem('notificationsSettings');
        return raw ? JSON.parse(raw) : {};
    } catch (_) {
        return {};
    }
}

export function areNotificationsSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator;
}