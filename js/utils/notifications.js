// js/utils/notifications.js
// Sistema de notificações push para agendamentos

import { showPage } from '../ui/pages.js';
import { getCurrentUser } from '../firebase/auth.js';


export async function requestNotificationPermission() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    } catch (e) {
        return false;
    }
}

export async function notifyNewSchedule(schedule) {
    showInAppNotification(schedule);
    
    if (Notification.permission !== 'granted') return;

    const gameDate = new Date(schedule.date + 'T' + schedule.startTime);
    const formattedDate = gameDate.toLocaleDateString('pt-BR');
    const currentUser = getCurrentUser();

    let bodyText = `Clique para responder sua presença\n\n📅 ${formattedDate}\n⏰ ${schedule.startTime}`;
    if (schedule.endTime) {
        bodyText += ` - ${schedule.endTime}`;
    }
    bodyText += `\n📍 ${schedule.location}`;
    if (schedule.notes) {
        bodyText += `\n📝 ${schedule.notes}`;
    }

    const notificationOptions = {
        body: bodyText,
        icon: './images/icon-192x192.png',
        badge: './images/icon-96x96.png',
        tag: 'new-schedule',
        requireInteraction: true,
        data: { type: 'schedule', id: schedule.id, userId: currentUser?.uid }
    };

    try {
        const registration = await navigator.serviceWorker.ready;
        if (registration.active) {
            await registration.showNotification('Novo Jogo', notificationOptions);
        } else {
            throw new Error('Service Worker não está ativo');
        }
    } catch (error) {
        try {
            const notification = new Notification('Novo Jogo', {
                body: notificationOptions.body,
                icon: notificationOptions.icon,
                tag: notificationOptions.tag
            });
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
            setTimeout(() => notification.close(), 10000);
        } catch (fallbackError) {}
    }
}

export async function notifyCancelledSchedule(schedule) {
    showInAppNotification(schedule, 'cancelled');
    
    if (Notification.permission !== 'granted') return;

    const gameDate = new Date(schedule.date + 'T' + schedule.startTime);
    const formattedDate = gameDate.toLocaleDateString('pt-BR');
    const reasonText = schedule.cancelReason ? `\n⚠️ ${schedule.cancelReason}` : '';

    try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('❌ Jogo Cancelado', {
            body: `📅 ${formattedDate} às ${schedule.startTime}\n📍 ${schedule.location}${reasonText}`,
            icon: './images/icon-192x192.png',
            badge: './images/icon-96x96.png',
            tag: 'cancelled-schedule',
            requireInteraction: true,
            data: { type: 'schedule', id: schedule.id }
        });
    } catch (error) {
        const notification = new Notification('❌ Jogo Cancelado', {
            body: `📅 ${formattedDate} às ${schedule.startTime}\n📍 ${schedule.location}${reasonText}`,
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


function showInAppNotification(schedule, type = 'new') {
    document.querySelectorAll('.schedule-notification').forEach(notif => notif.remove());
    
    const gameDate = new Date(schedule.date + 'T' + schedule.startTime);
    const formattedDate = gameDate.toLocaleDateString('pt-BR');
    const formattedTime = schedule.startTime;
    
    const notification = document.createElement('div');
    notification.className = `schedule-notification ${type === 'cancelled' ? 'cancelled' : ''}`;
    
    const content = type === 'cancelled' ? {
        icon: 'cancel',
        title: 'Jogo Cancelado!',
        gradient: 'linear-gradient(135deg, #DC2626, #B91C1C)'
    } : type === 'today' ? {
        icon: 'sports_volleyball',
        title: 'Jogo Hoje!',
        gradient: 'linear-gradient(135deg, #F59E0B, #D97706)'
    } : {
        icon: 'sports_volleyball',
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
            <span class="material-icons">event</span> ${formattedDate} às ${formattedTime}<br>
            <span class="material-icons">place</span> ${schedule.location}
            ${schedule.notes ? `<br><span class="material-icons">note</span> ${schedule.notes}` : ''}
            ${type === 'cancelled' && schedule.cancelReason ? `<br><strong><span class="material-icons">warning</span> Motivo:</strong> ${schedule.cancelReason}` : ''}
        </div>
    `;

    document.body.appendChild(notification);

    // Adicionar funcionalidade de swipe para fechar
    let startX = 0;
    let isDragging = false;

    const handleStart = (e) => {
        startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
        isDragging = true;
        notification.style.transition = 'none';
    };

    const handleMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const currentX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
        const deltaX = currentX - startX;
        notification.style.transform = `translateX(${deltaX}px)`;
    };

    const handleEnd = (e) => {
        if (!isDragging) return;
        isDragging = false;
        const currentX = e.type === 'mouseup' ? e.clientX : (e.changedTouches ? e.changedTouches[0].clientX : startX);
        const deltaX = currentX - startX;
        notification.style.transition = 'transform 0.3s ease';
        
        if (Math.abs(deltaX) > 80) {
            notification.style.transform = `translateX(${deltaX > 0 ? '100%' : '-100%'})`;
            setTimeout(() => notification.remove(), 300);
        } else {
            notification.style.transform = 'translateX(0)';
        }
    };

    // Touch events
    notification.addEventListener('touchstart', handleStart, { passive: true });
    notification.addEventListener('touchmove', handleMove, { passive: false });
    notification.addEventListener('touchend', handleEnd, { passive: true });
    
    // Mouse events para desktop
    notification.addEventListener('mousedown', handleStart);
    notification.addEventListener('mousemove', handleMove);
    notification.addEventListener('mouseup', handleEnd);
    notification.addEventListener('mouseleave', handleEnd);

    requestAnimationFrame(() => {
        notification.classList.add('show');
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    });
}

export async function registerNotificationServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.ready;
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'NOTIFICATION_ACTION') {
                    handleNotificationAction(event.data.action, event.data.data || null);
                }
            });
            return registration;
        } catch (error) {
            return null;
        }
    }
    return null;
}

export function handleNotificationAction(action, data) {
    // Previne ações duplicadas
    try {
        const key = `lastNotif:${action || 'view'}:${data?.id || ''}`;
        const last = sessionStorage.getItem(key);
        const now = Date.now();
        if (last && now - parseInt(last, 10) < 5000) return;
        sessionStorage.setItem(key, String(now));
    } catch (e) {}

    // Verifica se realmente deve processar (deve ter dados válidos)
    if (!action || !data || !data.id) {
        console.log('handleNotificationAction: Ação inválida ou sem dados, ignorando');
        return;
    }

    // Verifica se o agendamento ainda existe
    try {
        const schedules = JSON.parse(localStorage.getItem('voleiScoreSchedules') || '[]');
        const scheduleExists = schedules.some(s => s.id === data.id);
        if (!scheduleExists) {
            console.log('handleNotificationAction: Agendamento não encontrado, ignorando');
            return;
        }
    } catch (e) {
        console.log('handleNotificationAction: Erro ao verificar agendamento, ignorando');
        return;
    }

    sessionStorage.setItem('fromNotification', 'true');
    sessionStorage.setItem('notificationTimestamp', String(Date.now()));
    const normalizedAction = action || 'view';

    const navigateToScheduling = () => {
        if (typeof showPage === 'function') {
            showPage('scheduling-page');
        } else {
            window.location.hash = '#scheduling-page';
        }
    };

    const openResponseModal = async (gameId, autoResponse = null) => {
        if (!gameId) return;
        
        document.querySelectorAll('.attendance-modal-overlay').forEach(modal => modal.remove());
        
        try {
            const module = await import('../ui/scheduling-ui.js');
            const scheduledGames = JSON.parse(localStorage.getItem('voleiScoreSchedules') || '[]');
            const game = scheduledGames.find(g => g.id === gameId);
            
            if (game && module.showResponsesModal) {
                module.showResponsesModal(game, autoResponse);
            }
        } catch (error) {
            sessionStorage.setItem('pendingOpenRsvpScheduleId', gameId);
        }
    };

    const executeAction = () => {
        try {
            switch (normalizedAction) {
                case 'going':
                case 'not_going':
                case 'maybe':
                    setTimeout(() => openResponseModal(data?.id, normalizedAction), 500);
                    break;
                    
                case 'select_action':
                case 'view':
                    setTimeout(() => openResponseModal(data?.id), normalizedAction === 'view' ? 1500 : 500);
                    break;
                    
                case 'close':
                    return;
                    
                default:
                    break;
            }
            navigateToScheduling();
        } catch (error) {
            navigateToScheduling();
        }
    };

    const waitForAppReady = () => {
        const basicReady = window.isAppReady || 
                          (document.readyState === 'complete' && typeof showPage === 'function') ||
                          (window.location.hash && document.querySelector('.page'));

        let authReady = true;
        let scheduleReady = true;
        
        try {
            const user = getCurrentUser();
            authReady = user !== null;
        } catch (e) {
            authReady = true;
        }

        try {
            if (data?.id) {
                const scheduledGames = JSON.parse(localStorage.getItem('voleiScoreSchedules') || '[]');
                scheduleReady = scheduledGames.some(g => g?.id === data.id);
            }
        } catch (e) {
            scheduleReady = false;
        }

        if (basicReady && authReady && scheduleReady) {
            executeAction();
        } else {
            const attempts = parseInt(sessionStorage.getItem('notificationAttempts') || '0') + 1;
            sessionStorage.setItem('notificationAttempts', attempts.toString());
            const timeout = Math.min(200 * Math.pow(2, attempts - 1), 1500);

            if (attempts < 6) {
                setTimeout(waitForAppReady, timeout);
            } else {
                executeAction();
            }
        }
    };

    sessionStorage.removeItem('notificationAttempts');
    waitForAppReady();
}

export async function notifyTodayGame(schedule) {
    showInAppNotification(schedule, 'today');
    
    if (Notification.permission !== 'granted') return;

    try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('🏐 Jogo Hoje!', {
            body: `⏰ ${schedule.startTime}\n📍 ${schedule.location}`,
            icon: './images/icon-192x192.png',
            badge: './images/icon-96x96.png',
            tag: 'today-game',
            requireInteraction: true,
            data: { type: 'schedule', id: schedule.id }
        });
    } catch (error) {
        const notification = new Notification('🏐 Jogo Hoje!', {
            body: `⏰ ${schedule.startTime}\n📍 ${schedule.location}`,
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