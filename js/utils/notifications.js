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

    // Sempre mostra notificação visual na interface
    showInAppNotification(schedule);
    
    // Envia notificação push se permitida
    if (Notification.permission !== 'granted') {
        return;
    }

    const gameDate = new Date(schedule.date + 'T' + schedule.startTime);
    const formattedDate = gameDate.toLocaleDateString('pt-BR');
    const formattedTime = schedule.startTime;

    const currentUser = getCurrentUser();
    const userId = currentUser ? currentUser.uid : null; // Obter o UID do usuário logado

    const notificationOptions = {
        body: `📅 ${formattedDate} às ${formattedTime}\n📍 ${schedule.location}\n\n✅ Vou  🚫 Não vou  ❓ Talvez`,
        icon: './images/icon-192x192.png',
        badge: './images/icon-96x96.png',
        tag: 'new-schedule',
        requireInteraction: true,
        actions: [
            { action: 'going', title: '✅ Vou' },
            { action: 'not_going', title: '🚫 Não vou' },
            { action: 'maybe', title: '❓ Talvez' }
        ],
        data: { type: 'schedule', id: schedule.id, userId: userId, hasActions: true }
    };



    try {
        // Tenta usar Service Worker para notificação persistente
        const registration = await navigator.serviceWorker.ready;
        if (registration.active) {
            await registration.showNotification('🏐 Novo Jogo Agendado!', notificationOptions);

        } else {
            throw new Error('Service Worker não está ativo');
        }
    } catch (error) {

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

        } catch (fallbackError) {

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

            const registration = await navigator.serviceWorker.ready;
            
            // Adiciona listener para ações de notificação
            navigator.serviceWorker.addEventListener('message', (event) => {

                if (event.data && event.data.type === 'NOTIFICATION_ACTION') {

                    handleNotificationAction(event.data.action, event.data.data || null);
                }
            });

            return registration;
        } catch (error) {
    
        }
    }
    return null;
}

/**
 * Trata ações das notificações
 */
export function handleNotificationAction(action, data) {
    // Debounce / dedupe: evita processar a mesma ação/id várias vezes quando
    // o SW envia hash + postMessage (ambos podem chegar). Se a mesma action+id
    // foi processada nos últimos 5 segundos, ignora.
    try {
        const id = data && data.id ? String(data.id) : '';
        const key = `lastNotif:${action || 'view'}:${id}`;
        const last = sessionStorage.getItem(key);
        const now = Date.now();
        if (last) {
            const lastTs = parseInt(last, 10) || 0;
            if (now - lastTs < 5000) {
                // Ignora duplicata
                return;
            }
        }
        // Marca a execução atual
        sessionStorage.setItem(key, String(now));
    } catch (e) {
        // silencioso
    }

    // Marca que veio de notificação
    sessionStorage.setItem('fromNotification', 'true');
    sessionStorage.setItem('notificationTimestamp', Date.now().toString());

    // Garante que action nunca seja vazio
    const normalizedAction = action && action.length > 0 ? action : 'view';

    const executeAction = () => {
        
        try {
            switch (normalizedAction) {
                case 'going':
                case 'not_going':
                case 'maybe':

                    if (data && data.id) {
                        // Registra a resposta diretamente
                        setTimeout(() => {
                            // Fecha modais existentes primeiro
                            const existingModals = document.querySelectorAll('.attendance-modal-overlay');
                            existingModals.forEach(modal => modal.remove());
                            
                            import('../ui/scheduling-ui.js').then(module => {
                                if (typeof module.showResponsesModal === 'function') {
                                    const scheduledGames = JSON.parse(localStorage.getItem('voleiScoreSchedules') || '[]');
                                    const game = scheduledGames.find(g => g.id === data.id);
                                    if (game) {

                                        
                                        // Registra a resposta no objeto do jogo antes de abrir o modal
                                        const user = getCurrentUser();
                                        if (user) {
                                            if (!game.rsvps) game.rsvps = {};
                                            game.rsvps[user.uid] = normalizedAction;
                                        }
                                        
                                        module.showResponsesModal(game);
                                        
                                        // Salva diretamente no Firebase sem modal de confirmação
                                        setTimeout(async () => {
                                            if (user) {
                                                try {
                                                    const { saveSchedulesToLocalStorage } = await import('../ui/scheduling-ui.js');
                                                    const { updateSchedule } = await import('../data/schedules.js');
                                                    
                                                    // Salva no localStorage
                                                    const scheduledGames = JSON.parse(localStorage.getItem('voleiScoreSchedules') || '[]');
                                                    const gameIndex = scheduledGames.findIndex(g => g.id === data.id);
                                                    if (gameIndex !== -1) {
                                                        scheduledGames[gameIndex] = game;
                                                        localStorage.setItem('voleiScoreSchedules', JSON.stringify(scheduledGames));
                                                    }
                                                    
                                                    // Salva no Firebase
                                                    await updateSchedule(game);

                                                } catch (error) {

                                                }
                                            }
                                        }, 100);
                                    }
                                }
                            });
                        }, 500);
                    }
                    
                    // Garante que a página seja mostrada
                    if (typeof showPage === 'function') {
                        showPage('scheduling-page');
                    } else {
                        // Fallback: navega diretamente
                        window.location.hash = '#scheduling-page';
                    }
                    break;
                    
                case 'select_action':
                    // Abre modal de attendance para seleção direta
                    if (data && data.id) {
                        setTimeout(() => {
                            // Fecha modais existentes primeiro
                            const existingModals = document.querySelectorAll('.attendance-modal-overlay');
                            existingModals.forEach(modal => modal.remove());
                            
                            import('../ui/scheduling-ui.js').then(module => {
                                if (typeof module.showResponsesModal === 'function') {
                                    const scheduledGames = JSON.parse(localStorage.getItem('voleiScoreSchedules') || '[]');
                                    const game = scheduledGames.find(g => g.id === data.id);
                                    if (game) {
                                        module.showResponsesModal(game);
                                        setTimeout(() => {
                                            const modal = document.querySelector('.attendance-modal');
                                            if (modal) {
                                                const header = modal.querySelector('.att-modal__title');
                                                if (header) {
                                                    header.innerHTML = '🔔 Responder Convite';
                                                }
                                                
                                                // Adiciona pulsação nas opções para chamar atenção
                                                const choices = modal.querySelectorAll('.att-choice');
                                                choices.forEach(choice => {
                                                    choice.style.animation = 'pulse 1.5s ease-in-out 3';
                                                    choice.style.boxShadow = '0 0 15px rgba(37, 99, 235, 0.5)';
                                                });
                                                
                                                // Remove animação após 5 segundos
                                                setTimeout(() => {
                                                    choices.forEach(choice => {
                                                        choice.style.animation = '';
                                                        choice.style.boxShadow = '';
                                                    });
                                                }, 5000);
                                            }
                                        }, 100);
                                    }
                                }
                            });
                        }, 500);
                    }
                    
                    // Garante que a página seja mostrada
                    if (typeof showPage === 'function') {
                        showPage('scheduling-page');
                    } else {
                        // Fallback: navega diretamente
                        window.location.hash = '#scheduling-page';
                    }
                    break;
                    
                case 'view':
                    // Abre diretamente o modal attendance-modal
                    if (data && data.id) {
                        // Aguarda a página carregar e depois abre o modal
                        setTimeout(() => {
                            import('../ui/scheduling-ui.js').then(module => {
                                if (typeof module.showResponsesModal === 'function') {
                                    // Busca o jogo e abre o modal de respostas
                                    const scheduledGames = JSON.parse(localStorage.getItem('voleiScoreSchedules') || '[]');
                                    const game = scheduledGames.find(g => g.id === data.id);
                                    if (game) {
                                        module.showResponsesModal(game);
                                    }
                                }
                            }).catch(() => {
                                // Fallback: salva para abrir depois
                                sessionStorage.setItem('pendingOpenRsvpScheduleId', data.id);
                            });
                        }, 1500);
                    }
                    
                    // Garante que a página seja mostrada
                    if (typeof showPage === 'function') {
                        showPage('scheduling-page');
                    } else {
                        // Fallback: navega diretamente
                        window.location.hash = '#scheduling-page';
                    }
                    break;
                    
                case 'close':
                    // Do nothing
                    break;
                    
                default:

                    if (typeof showPage === 'function') {
                        showPage('scheduling-page');
                    } else {
                        window.location.hash = '#scheduling-page';
                    }
                    break;
            }
        } catch (error) {

            // Fallback em caso de erro
            window.location.hash = '#scheduling-page';
        }
    };

    const waitForAppReady = () => {
        
        // Verifica múltiplas condições para garantir que o app está pronto
        // Checa readiness adicional: usuário autenticado/carregado e dados de agendamento disponíveis
        const basicReady = window.isAppReady || 
                        (document.readyState === 'complete' && typeof showPage === 'function') ||
                        (window.location.hash && document.querySelector('.page'));

        let authReady = true;
        try {
            const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
            // Se houver usuário esperado para gravar resposta, aguarda usuário não-nulo
            authReady = user !== null;
        } catch (e) {
            authReady = true;
        }

        let scheduleReady = true;
        try {
            if (data && data.id) {
                const scheduledGames = JSON.parse(localStorage.getItem('voleiScoreSchedules') || '[]');
                scheduleReady = Array.isArray(scheduledGames) && scheduledGames.some(g => g && g.id === data.id);
            }
        } catch (e) {
            scheduleReady = false;
        }

        const isReady = basicReady && authReady && scheduleReady;
        
        if (isReady) {
            executeAction();
        } else {
            // Aumenta o timeout gradualmente para dar mais tempo ao app
            const attempts = parseInt(sessionStorage.getItem('notificationAttempts') || '0') + 1;
            sessionStorage.setItem('notificationAttempts', attempts.toString());

            // Exponential backoff: 200ms, 400ms, 800ms, ... cap em 1500ms
            const timeout = Math.min(200 * Math.pow(2, Math.max(0, attempts - 1)), 1500);

            // Max wait ~5s (aprox 4-5 tentativas)
            if (attempts < 6) {
                setTimeout(waitForAppReady, timeout);
            } else {
                // Se ainda não pronto, executa como fallback para não travar
                executeAction();
            }
        }
    };

    // Limpa contador de tentativas
    sessionStorage.removeItem('notificationAttempts');
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