// js/main.js
// Ponto de entrada principal do seu aplicativo. Orquestra a inicialização e os módulos.

import { initFirebaseApp, getAppId } from './firebase/config.js';
import { logout, setupAuthListener, signInAnonymouslyUser, updateProfileMenuLoginState, getCurrentUser, loginWithGoogle } from './firebase/auth.js'; // Imports updateProfileMenuLoginState
import { setupFirestorePlayersListener } from './data/players.js';
import * as SchedulesData from './data/schedules.js'; // Keep this for other uses of SchedulesData
// Removed imports related to processPendingNotificationAttendance
import { showPage, updatePlayerModificationAbility, setupSidebar, setupPageNavigation, setupAccordion, setupScoreInteractions, setupTeamSelectionModal, closeSidebar, hideConfirmationModal, showConfirmationModal, forceUpdateIcons } from './ui/pages.js';

// Torna showPage global para o controle de navegação
window.showPage = showPage;
import { setupConfigUI, loadConfig } from './ui/config-ui.js'; // Importa loadConfig
import { startGame, toggleTimer, swapTeams, endGame, restoreSavedGameIfAny } from './game/logic.js';
import { generateTeams } from './game/teams.js';
import { loadAppVersion, registerServiceWorker } from './utils/app-info.js';
import { getPlayers } from './data/players.js';
import * as Elements from './ui/elements.js';
import { displayMessage } from './ui/messages.js';
import { updatePlayerCount, updateSelectAllToggle, savePlayerSelectionState } from './ui/players-ui.js';
import { setupHistoryPage } from './ui/history-ui.js';
import { setupSchedulingPage, updateSchedulingPermissions } from './ui/scheduling-ui.js';
import './ui/profile-menu.js';
import { setupQuickSettings } from './ui/quick-settings.js';
import { setupSidebar as setupModernSidebar } from './ui/sidebar-ui.js';
import { getUserRole } from './ui/users.js';

import { registerNotificationServiceWorker } from './notifications/notifications.js';
import { initWelcomeNotifications } from './notifications/welcome-notifications.js';
import { initDailyReminders } from './utils/daily-reminders.js';
import connectivityManager from './utils/connectivity.js';
import offlineStorage from './utils/offline-storage.js';
import pwaManager from './utils/pwa-manager.js';
import { getActiveTeam1Name } from '../js/game/logic.js';
import { getActiveTeam2Name } from '../js/game/logic.js';
import safeAreasManager from './utils/safe-areas.js';
import firestoreRecovery from './firebase/recovery.js';
import './firebase/dev-fix.js';

import { signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

let authListenerInitialized = false;
export function markAuthInitialized() { authListenerInitialized = true; }
let loadingTimeout = null;

// Função utilitária para checar se o usuário atual é admin
function isCurrentUserAdmin() {
    const user = getCurrentUser();
    if (!user || !user.uid) return false;
    // Usa a configuração centralizada de roles
    return getUserRole ? getUserRole(user.uid) === 'dev' : false;
}

// Função utilitária para checar se o usuário atual está autenticado com Google
function isCurrentUserGoogle() {
    const user = getCurrentUser();
    if (!user || !user.uid) return false;
    // Firebase define isAnonymous = true para usuários anônimos
    return !user.isAnonymous;
}

/**
 * Atualiza o indicador de status de conexão na UI.
 * @param {'online' | 'offline' | 'reconnecting'} status - O status da conexão.
 */
// Exporta funções para uso em outros módulos
export { loadOfflineData, setupAutoSave };

export function updateConnectionIndicator(status) {
    const indicator = Elements.connectionIndicator();
    const statusDot = Elements.statusDot();
    const statusText = Elements.statusText();

    if (!indicator || !statusDot || !statusText) {
        return;
    }

    const config = loadConfig(); // Carrega a configuração mais recente

    if (!config.showConnectionStatus) {
        indicator.classList.add('hidden-by-config');
        return;
    } else {
        indicator.classList.remove('hidden-by-config');
    }

    statusDot.className = 'status-dot'; // Resets the classes
    statusText.textContent = ''; // Resets the text

    switch (status) {
        case 'online':
            if (isCurrentUserGoogle()) {
                statusDot.classList.add('online'); // Verde para autenticado Google
            } else {
                statusDot.classList.add('not-admin-online'); // Cinza para anônimo ou visitante
            }
            statusText.textContent = 'Online';
            break;
        case 'offline':
            statusDot.classList.add('offline');
            statusText.textContent = 'Offline';
            break;
        case 'reconnecting':
            statusDot.classList.add('reconnecting');
            statusText.textContent = 'Reconectando...';
            break;
    }
}

/**
 * Hides the loading overlay.
 */
export function hideLoadingOverlay() {
    const loadingOverlay = Elements.loadingOverlay();
    if (loadingOverlay && !loadingOverlay.classList.contains('hidden')) {
        loadingOverlay.classList.add('hidden');
        if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            loadingTimeout = null;
        }
    }
}

function waitForCorrectPage(targetPageId, maxAttempts = 20, interval = 100) {
    let attempts = 0;
    const check = () => {
        const activePage = document.querySelector('.app-page--active');
        const activeId = activePage ? activePage.id : null;
        if (activeId === targetPageId) {
            return;
        }
        attempts++;
        if (attempts < maxAttempts) {
            setTimeout(check, interval);
        }
    };
    check();
}

/**
 * Parseia parâmetros anexados ao hash e dispara a ação de notificação se presente.
 * Exemplo de hash: #scheduling-page?action=going&id=abc123
 */
function processNotificationHashParams() {
    try {
        const hash = window.location.hash || '';
        if (!hash.includes('?')) return;
        const [, query] = hash.split('?');
        if (!query) return;
        const params = new URLSearchParams(query);
        const action = params.get('action');
        const id = params.get('id');
        if (action || id) {
            const data = id ? { id } : null;
            import('./notifications/notifications.js').then(mod => {
                if (mod && typeof mod.handleNotificationAction === 'function') {
                    mod.handleNotificationAction(action || 'view', data);
                }
            }).catch(() => {});
        }
    } catch (e) {
        // silencioso
    }
}

// Processa notificações pendentes enviadas pelo service worker antes do app estar pronto
function processPendingNotificationFromSession() {
    try {
        const raw = sessionStorage.getItem('pendingNotification');
        if (!raw) return;
        const data = JSON.parse(raw);
        sessionStorage.removeItem('pendingNotification');
        if (data && data.type === 'NOTIFICATION_ACTION') {
            import('./notifications/notifications.js').then(mod => {
                if (mod && typeof mod.handleNotificationAction === 'function') {
                    mod.handleNotificationAction(data.action, data.data || null);
                }
            }).catch(() => {});
        }
    } catch (e) {}
}

// Desabilita pull-to-refresh completamente
function disablePullToRefresh() {
    // CSS overscroll-behavior
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';
    
    // Bloqueia touchstart no topo da página
    document.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        if (touch.clientY <= 10 && window.scrollY === 0) {
            e.preventDefault();
        }
    }, { passive: false });
    
    // Bloqueia touchmove que pode causar pull-to-refresh
    document.addEventListener('touchmove', (e) => {
        if (window.scrollY === 0 && e.touches[0].clientY > e.touches[0].clientY) {
            e.preventDefault();
        }
    }, { passive: false });
    
    // Força overscroll-behavior em todos os elementos
    const style = document.createElement('style');
    style.textContent = `
        *, *::before, *::after {
            overscroll-behavior: none !important;
            overscroll-behavior-y: none !important;
        }
        html, body {
            overscroll-behavior: none !important;
            overscroll-behavior-y: none !important;
        }
    `;
    document.head.appendChild(style);
}

// Chama imediatamente
disablePullToRefresh();

// ===== TIMER DRAWER FUNCTIONS =====
// Cache dos elementos DOM
let timerDrawerElement = null;
let timerDrawerTabElement = null;
let isTimerDrawerInitialized = false;

/**
 * Inicializa o timer drawer
 */
function initTimerDrawer() {
    // Previne múltiplas inicializações
    if (isTimerDrawerInitialized) {
        return;
    }

    timerDrawerElement = document.getElementById('timer-drawer');
    timerDrawerTabElement = document.getElementById('timer-drawer-tab');
    
    if (!timerDrawerElement || !timerDrawerTabElement) {
        return;
    }

    // Função para toggle do drawer
    const handleTabClick = () => {
        toggleTimerDrawer();
    };

    // Função para fechar drawer ao clicar fora
    const handleDocumentClick = (e) => {
        if (!timerDrawerElement.contains(e.target) && timerDrawerElement.classList.contains('expanded')) {
            closeTimerDrawer();
        }
    };

    // Função para prevenir fechamento ao clicar dentro
    const handleDrawerClick = (e) => {
        e.stopPropagation();
    };

    // Adiciona eventos
    timerDrawerTabElement.addEventListener('click', handleTabClick);
    document.addEventListener('click', handleDocumentClick);
    timerDrawerElement.addEventListener('click', handleDrawerClick);

    isTimerDrawerInitialized = true;

    // Atualiza visibilidade inicial
    updateTimerDrawerVisibility();
}

/**
 * Alterna o estado do timer drawer (aberto/fechado)
 */
function toggleTimerDrawer() {
    if (!timerDrawerElement) {
        timerDrawerElement = document.getElementById('timer-drawer');
    }
    if (!timerDrawerElement) return;

    if (timerDrawerElement.classList.contains('expanded')) {
        closeTimerDrawer();
    } else {
        openTimerDrawer();
    }
}

/**
 * Abre o timer drawer
 */
function openTimerDrawer() {
    if (!timerDrawerElement) {
        timerDrawerElement = document.getElementById('timer-drawer');
    }
    if (!timerDrawerElement) return;

    timerDrawerElement.classList.add('expanded');
}

/**
 * Fecha o timer drawer
 */
function closeTimerDrawer() {
    if (!timerDrawerElement) {
        timerDrawerElement = document.getElementById('timer-drawer');
    }
    if (!timerDrawerElement) return;

    timerDrawerElement.classList.remove('expanded');
}

/**
 * Mostra ou oculta o timer drawer baseado na configuração
 */
function updateTimerDrawerVisibility() {
    if (!timerDrawerElement) {
        timerDrawerElement = document.getElementById('timer-drawer');
    }
    if (!timerDrawerElement) return;

    // Verifica se deve exibir o timer com tratamento de erro
    let config = {};
    try {
        config = JSON.parse(localStorage.getItem('volleyballConfig')) || {};
    } catch (error) {
        console.warn('Erro ao carregar configuração do timer drawer:', error);
        config = {};
    }
    
    const shouldDisplayTimer = config.displayTimer !== false; // padrão é true

    // Verifica se está na página de pontuação
    const scoringPage = document.getElementById('scoring-page');
    const isInScoringPage = scoringPage && scoringPage.classList.contains('app-page--active');

    // Verifica se não está na start-page
    const startPage = document.getElementById('start-page');
    const isInStartPage = startPage && startPage.classList.contains('app-page--active');

    if (shouldDisplayTimer && isInScoringPage && !isInStartPage) {
        timerDrawerElement.style.display = 'block';
    } else {
        timerDrawerElement.style.display = 'none';
        closeTimerDrawer(); // Fecha se estiver aberto
    }
}

// Exporta as funções para uso em outros módulos se necessário
window.updateTimerDrawerVisibility = updateTimerDrawerVisibility;
window.toggleTimerDrawer = toggleTimerDrawer;
window.openTimerDrawer = openTimerDrawer;
window.closeTimerDrawer = closeTimerDrawer;

document.addEventListener('DOMContentLoaded', async () => {
    window.isAppReady = true;
    
    // Reforça a desabilitação após DOM carregar
    disablePullToRefresh();
    
    // Limpeza preventiva de dados de notificação residuais para evitar abertura desnecessária do modal
    try {
        const fromNotification = sessionStorage.getItem('fromNotification');
        const notificationTimestamp = sessionStorage.getItem('notificationTimestamp');
        
        // Se os dados são antigos (mais de 30 segundos), limpa tudo
        if (fromNotification && notificationTimestamp) {
            const timeDiff = Date.now() - parseInt(notificationTimestamp);
            if (timeDiff > 30000) {
                sessionStorage.removeItem('fromNotification');
                sessionStorage.removeItem('notificationTimestamp');
                sessionStorage.removeItem('pendingOpenRsvpScheduleId');
                sessionStorage.removeItem('lastRSVPData');
            }
        }
        
        // Se não veio de uma notificação, limpa dados residuais
        if (!window.location.search.includes('fromNotification') && !window.location.hash.includes('fromNotification')) {
            sessionStorage.removeItem('pendingOpenRsvpScheduleId');
            sessionStorage.removeItem('lastRSVPData');
        }
    } catch (e) {
        // Em caso de erro, limpa tudo para segurança
        sessionStorage.removeItem('fromNotification');
        sessionStorage.removeItem('notificationTimestamp');
        sessionStorage.removeItem('pendingOpenRsvpScheduleId');
        sessionStorage.removeItem('lastRSVPData');
    }
    
    // Detecta se veio do popup e aplica CSS para ocultar barra
    if (window.location.hash.includes('fromPopup=true')) {
        document.body.classList.add('from-popup');
        // Remove o parâmetro da URL
        const newHash = window.location.hash.replace(/[?&]fromPopup=true/, '');
        history.replaceState(null, null, newHash);
    }
    
    // Controle do botão voltar
    const handleBackButton = () => {
        const currentPage = document.querySelector('.app-page--active')?.id;
        
        // Se está na tela de login ou inicial (scoring), pergunta se quer fechar
        if (currentPage === 'login-page' || currentPage === 'scoring-page' || !currentPage) {
            if (confirm('Deseja fechar o aplicativo?')) {
                if (window.close) window.close();
            } else {
                history.pushState(null, null, window.location.href);
            }
            return;
        }
        
        // Nas demais páginas, volta para a tela de partida
        showPage('scoring-page');
        history.pushState(null, null, window.location.href);
    };
    
    // Listener para o botão voltar
    window.addEventListener('popstate', handleBackButton);
    
    // Adiciona entrada inicial no histórico
    history.pushState(null, null, window.location.href);
    

    
    // Navegação automática baseada no hash ao abrir o app
    if (window.location.hash && window.location.hash.startsWith('#') && window.location.hash.length > 1) {
        const hashPart = window.location.hash.substring(1);
        const [pageId, queryString] = hashPart.split('?');
        
        // Só ativa se o elemento existe e termina com '-page'
        if (document.getElementById(pageId) && pageId.endsWith('-page')) {
            const mod = await import('./ui/pages.js');
            if (mod && typeof mod.showPage === 'function') {
                mod.showPage(pageId);
                waitForCorrectPage(pageId);
                
                // Verifica se deve abrir modal
                if (queryString && pageId === 'scheduling-page') {
                    const params = new URLSearchParams(queryString);
                    const openModal = params.get('openModal');
                    if (openModal) {
                        setTimeout(() => {
                            import('./ui/scheduling-ui.js').then(schedulingMod => {
                                if (schedulingMod && typeof schedulingMod.showResponsesModal === 'function') {
                                    const schedules = JSON.parse(localStorage.getItem('voleiScoreSchedules') || '[]');
                                    const schedule = schedules.find(s => s.id === openModal);
                                    if (schedule) {
                                        schedulingMod.showResponsesModal(schedule);
                                    }
                                }
                            }).catch(() => {});
                        }, 1000);
                    }
                }
            }
        }
    }
    handleHashNavigation();
    // Process notification action if app opened with hash params (e.g. #scheduling-page?action=going&id=...)
    try {
        processNotificationHashParams();
    } catch (e) {}
    try {
        processPendingNotificationFromSession();
    } catch (e) {}
    // Sistema de debug apenas para admins autenticados
    try {
        const waitForAdminOverlay = (timeoutMs = 10000, intervalMs = 500) => {
            let elapsed = 0;
            const id = setInterval(() => {
                try {
                    const config = JSON.parse(localStorage.getItem('volleyballConfig') || '{}');
                    const isAdmin = config.adminKey === 'admin998939';
                    if (isAdmin && typeof isCurrentUserGoogle === 'function' && isCurrentUserGoogle()) {
                        createAdminSwLogOverlay();
                        clearInterval(id);
                        return;
                    }
                } catch (e) {}
                elapsed += intervalMs;
                if (elapsed >= timeoutMs) clearInterval(id);
            }, intervalMs);
        };
        waitForAdminOverlay();
    } catch (e) {}
});
    // --- SCOREBOARD MENU DROPDOWN ---
    const scoreboardMenuButton = document.getElementById("scoreboard-menu-button");
    const scoreboardMenuDropdown = document.getElementById("scoreboard-dropdown");
    const scoreboardMenuOverlay = document.getElementById("scoreboard-overlay");

    if (scoreboardMenuButton && scoreboardMenuDropdown && scoreboardMenuOverlay) {
        scoreboardMenuButton.addEventListener("click", (event) => {
            event.stopPropagation();
            const isOpen = scoreboardMenuDropdown.classList.toggle("show");
            if (isOpen) {
                scoreboardMenuOverlay.classList.add("active");
            } else {
                scoreboardMenuOverlay.classList.remove("active");
            }
        });
        
        // Fechar ao clicar no overlay
        scoreboardMenuOverlay.addEventListener("click", () => {
            scoreboardMenuDropdown.classList.remove("show");
            scoreboardMenuOverlay.classList.remove("active");
        });
    }




    // Seleciona o primeiro botão do scoreboard-dropdown
    const invertTeamsButton = document.querySelector('#scoreboard-dropdown [data-action="swap"]');

    if (invertTeamsButton) {
        // Adiciona um evento de clique ao botão
        invertTeamsButton.addEventListener('click', () => {
            // Chama a função swapTeams quando o botão for clicado
            import('../js/game/logic.js').then(mod => {
                mod.swapTeams();
            });
        });
    }

    
    // Seleciona o botão de substituir time 2
    const team2ChangeButtonOption = document.querySelector('#scoreboard-dropdown [data-action="change-team2"]');

    // Define o texto com o nome atual do time 2 preservando o ícone
    if (team2ChangeButtonOption) {
        const iconEl = team2ChangeButtonOption.querySelector('.material-icons');
        const iconHTML = iconEl ? iconEl.outerHTML : '';
        team2ChangeButtonOption.innerHTML = `${iconHTML} Substituir ${getActiveTeam2Name()}`;
        // Adiciona um evento de clique ao botão
        team2ChangeButtonOption.addEventListener('click', async () => {
            // Abre o modal de seleção diretamente para o painel do Time 2
            const mod = await import('./ui/pages.js');
            if (mod && typeof mod.openTeamSelectionModal === 'function') {
                mod.openTeamSelectionModal('team2');
            }
        });
    }


    // Seleciona o botão de substituir time 1
    const team1ChangeButtonOption = document.querySelector('#scoreboard-dropdown [data-action="change-team1"]');

    // Define o texto com o nome atual do time 1 preservando o ícone
    if (team1ChangeButtonOption) {
        const iconEl = team1ChangeButtonOption.querySelector('.material-icons');
        const iconHTML = iconEl ? iconEl.outerHTML : '';
        team1ChangeButtonOption.innerHTML = `${iconHTML} Substituir ${getActiveTeam1Name()}`;
        // Adiciona um evento de clique ao botão
        team1ChangeButtonOption.addEventListener('click', async () => {
            // Abre o modal de seleção diretamente para o painel do Time 1
            const mod = await import('./ui/pages.js');
            if (mod && typeof mod.openTeamSelectionModal === 'function') {
                mod.openTeamSelectionModal('team1');
            }
        });
    }








        
    // Última opção: Configuração rápida da partida
    const quickSettingsOption = document.querySelector('#scoreboard-dropdown [data-action="settings"]');
    if (quickSettingsOption) {
        const iconEl = quickSettingsOption.querySelector('.material-icons');
        const iconHTML = iconEl ? iconEl.outerHTML : '';
        quickSettingsOption.innerHTML = `${iconHTML} Configurações`;
        quickSettingsOption.addEventListener('click', async () => {
            // Abre o modal de configurações rápidas diretamente (sem depender do botão removido)
            const mod = await import('./ui/quick-settings.js');
            if (mod && typeof mod.openQuickSettingsModal === 'function') {
                mod.openQuickSettingsModal();
            }
        });
    }

    // Exibe a tela de carregamento imediatamente
    const loadingOverlay = Elements.loadingOverlay();
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden'); // Garante que a tela de carregamento esteja visível
    }


    // Inicia o timer para forçar a liberação da UI caso a autenticação demore
    loadingTimeout = setTimeout(() => {
        const overlay = Elements.loadingOverlay ? Elements.loadingOverlay() : null;
        if (!authListenerInitialized || (overlay && !overlay.classList.contains('hidden'))) {
            displayMessage("Carregando demorou, iniciando sem login.", "info");
            if (window.location.hash === '#scheduling') {
                showPage('scheduling-page');
            } else {
                showPage('players-page');
            }
            updateConnectionIndicator('offline');
            hideLoadingOverlay();
        }
    }, 5000);


    const { app, db, auth } = await initFirebaseApp();
    const appId = getAppId();
    
    // Aplica otimizações Firestore
    try {
        const { applyDevFirestoreFix } = await import('./firebase/dev-fix.js');
        await applyDevFirestoreFix();
        console.log('Otimizações Firestore aplicadas');
    } catch (error) {
        console.warn('Erro ao aplicar otimizações Firestore:', error);
    }

    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
            await signInWithCustomToken(auth, __initial_auth_token);
        } catch (error) {

        }
    }


    await registerNotificationServiceWorker();

    // Listen for messages from service worker (notification actions)
    if (navigator.serviceWorker && navigator.serviceWorker.addEventListener) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'NOTIFICATION_ACTION') {
                try {
                    // If the app isn't ready yet, store for later
                    if (!window.isAppReady) {
                        sessionStorage.setItem('pendingNotification', JSON.stringify(event.data));
                    } else {
                        // Call handler from notifications util if available
                        import('./notifications/notifications.js').then(mod => {
                            if (mod && typeof mod.handleNotificationAction === 'function') {
                                mod.handleNotificationAction(event.data.action, event.data.data || null);
                            }
                        }).catch(() => {});
                    }
                } catch (e) {}
            }
            
            // Novo: escuta mensagens de clique em notificação
            if (event.data && event.data.type === 'NOTIFICATION_CLICKED') {
                try {
                    const baseUrl = window.location.origin + (window.location.hostname.includes('github.io') ? '/Voleizinho-das-Ruas/' : '/');
                    const scheduleData = encodeURIComponent(JSON.stringify(event.data.data || {}));
                    const popupUrl = baseUrl + 'popup.html?data=' + scheduleData;
                    window.open(popupUrl, '_blank', 'width=400,height=600');
                } catch (e) {
                    console.error('Erro ao abrir popup:', e);
                }
            }
            
            // Novo: escuta mensagens de ações pendentes disponíveis
            if (event.data && event.data.type === 'PENDING_ACTION_AVAILABLE') {
                try {
                    console.log(`[DEBUG: main.js] Received pending action available:`, event.data);
                    
                    // Processa imediatamente se o app estiver pronto
                    if (window.isAppReady) {
                        import('./notifications/notifications.js').then(mod => {
                            if (mod && typeof mod.handleNotificationAction === 'function') {
                                mod.handleNotificationAction(event.data.action, event.data.data || null);
                            }
                        }).catch(() => {});
                    } else {
                        // Se não estiver pronto, agenda para processar em breve
                        setTimeout(() => {
                            try { processPendingActionsFromSwDb(); } catch (e) {}
                        }, 2000);
                    }
                } catch (e) {
                    console.error(`[DEBUG: main.js] Error handling pending action available:`, e);
                }
            }
        });
    }

    // Quando a aba ficar visível novamente, processa notificações pendentes (caso o SW tenha enviado antes)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            try { processPendingNotificationFromSession(); } catch (e) {}
            try { processPendingActionsFromSwDb(); } catch (e) {}
        }
    });
    
    // Listener para atualizações de RSVP do popup
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SCHEDULE_UPDATED') {
            try {
                // Força atualização da interface de agendamentos
                import('./ui/scheduling-ui.js').then(mod => {
                    if (mod && typeof mod.renderScheduledGames === 'function') {
                        mod.renderScheduledGames();
                        console.log('Interface de agendamentos atualizada após RSVP');
                        
                        // Se tem forceRefresh, atualiza modal aberto também
                        if (event.data.forceRefresh) {
                            const openModal = document.querySelector('.attendance-modal-overlay:not(.hidden)');
                            if (openModal && event.data.scheduleId) {
                                const schedules = JSON.parse(localStorage.getItem('voleiScoreSchedules') || '[]');
                                const schedule = schedules.find(s => s.id === event.data.scheduleId);
                                if (schedule && mod.showResponsesModal) {
                                    setTimeout(() => mod.showResponsesModal(schedule), 100);
                                }
                            }
                        }
                    }
                }).catch(() => {});
            } catch (e) {
                console.error('Erro ao atualizar interface:', e);
            }
        }
        
        if (event.data && event.data.type === 'OPEN_RESPONSE_MODAL') {
            try {
                setTimeout(() => {
                    import('./ui/scheduling-ui.js').then(mod => {
                        if (mod && typeof mod.showResponsesModal === 'function') {
                            const schedules = JSON.parse(localStorage.getItem('voleiScoreSchedules') || '[]');
                            const schedule = schedules.find(s => s.id === event.data.scheduleId);
                            if (schedule) {
                                mod.showResponsesModal(schedule);
                            }
                        }
                    }).catch(() => {});
                }, 500);
            } catch (e) {
                console.error('Erro ao abrir modal:', e);
            }
        }
    });
    
    // Processa ações pendentes apenas se realmente necessário
    setTimeout(() => {
        // Só processa se veio de uma notificação
        const fromNotification = sessionStorage.getItem('fromNotification');
        if (fromNotification === 'true') {
            try { processPendingActionsFromSwDb(); } catch (e) {}
        }
        
        // Verifica se deve abrir modal após navegação do popup
        const openModalId = sessionStorage.getItem('openModalOnLoad');
        if (openModalId) {
            sessionStorage.removeItem('openModalOnLoad');
            setTimeout(() => {
                import('./ui/scheduling-ui.js').then(mod => {
                    if (mod && typeof mod.showResponsesModal === 'function') {
                        const schedules = JSON.parse(localStorage.getItem('voleiScoreSchedules') || '[]');
                        const schedule = schedules.find(s => s.id === openModalId);
                        if (schedule) {
                            mod.showResponsesModal(schedule);
                        }
                    }
                }).catch(() => {});
            }, 1500);
        }
    }, 1000);
    
    // Processamento periódico removido para evitar abertura desnecessária do modal
    
    // Listener para atualizações de RSVP via localStorage
    window.addEventListener('storage', (e) => {
        if (e.key === 'scheduleUpdateTrigger' && e.newValue) {
            try {
                const updateData = JSON.parse(e.newValue);
                import('./ui/scheduling-ui.js').then(mod => {
                    if (mod && typeof mod.renderScheduledGames === 'function') {
                        mod.renderScheduledGames();
                        console.log('Interface atualizada via localStorage');
                    }
                }).catch(() => {});
                // Remove o trigger após processar
                localStorage.removeItem('scheduleUpdateTrigger');
            } catch (e) {}
        }
    });

// --- IndexedDB reader for pending actions written by the SW ---
function openSwDbFromClient() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('sw-debug-logs', 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function readPendingActions(limit = 10) {
    try {
        const db = await openSwDbFromClient();
        const tx = db.transaction('pending_actions', 'readwrite');
        const store = tx.objectStore('pending_actions');
        return await new Promise((resolve, reject) => {
            const items = [];
            const req = store.openCursor();
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor && items.length < limit) {
                    items.push(cursor.value);
                    cursor.delete(); // limpa após ler
                    cursor.continue();
                } else {
                    resolve(items);
                }
            };
            req.onerror = () => reject(req.error);
        }).finally(() => db.close());
    } catch (e) {
        return [];
    }
}

async function processPendingActionsFromSwDb() {
    try {
        // Verifica se realmente deve processar ações pendentes
        const fromNotification = sessionStorage.getItem('fromNotification');
        const notificationTimestamp = sessionStorage.getItem('notificationTimestamp');
        
        // Só processa se veio de uma notificação recente (menos de 10 segundos)
        if (fromNotification !== 'true' || !notificationTimestamp) {
            return;
        }
        
        const timeDiff = Date.now() - parseInt(notificationTimestamp);
        if (timeDiff > 10000) {
            return; // Muito antigo, ignora
        }
        
        const pending = await readPendingActions(5); // Reduz o limite para evitar processamento excessivo
        if (!pending || pending.length === 0) return;
        
        console.log(`[DEBUG: main.js] Processing ${pending.length} pending actions from SW DB`);
        
        // Processa em ordem: do mais antigo para o mais novo
        const sortedPending = pending.sort((a, b) => (a.ts || 0) - (b.ts || 0));
        
        for (const item of sortedPending) {
            try {
                // Verifica se a ação é recente (menos de 30 segundos)
                if (item.ts && (Date.now() - item.ts) > 30000) {
                    continue; // Pula ações muito antigas
                }
                
                console.log(`[DEBUG: main.js] Processing pending action:`, item);
                
                // Aguarda o módulo carregar antes de processar
                const mod = await import('./notifications/notifications.js');
                if (mod && typeof mod.handleNotificationAction === 'function') {
                    // Adiciona um pequeno delay entre ações para evitar conflitos
                    await new Promise(resolve => setTimeout(resolve, 200));
                    mod.handleNotificationAction(item.action, item.data || null);
                    console.log(`[DEBUG: main.js] Processed pending action: ${item.action}`);
                } else {
                    console.warn(`[DEBUG: main.js] handleNotificationAction not available`);
                }
            } catch (e) {
                console.error(`[DEBUG: main.js] Error processing pending action:`, e);
            }
        }
    } catch (e) {
        console.error(`[DEBUG: main.js] Error reading pending actions:`, e);
    }
}

// ---------------- Admin SW log overlay ----------------
// Ask the service worker to broadcast its logs (used by the admin overlay)
function askSwForLogs() {
    try {
        const statusEl = document.getElementById('admin-sw-status');
        if (statusEl) statusEl.textContent = 'Requesting logs from SW...';

        // Try controller first (MessageChannel or simple postMessage)
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            try {
                navigator.serviceWorker.controller.postMessage({ type: 'GET_SW_DEBUG_LOGS', limit: 500 });
            } catch (e) {}
        }

        // Fallback: postMessage to all registrations' active workers
        if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function') {
            navigator.serviceWorker.getRegistrations().then(regs => {
                for (const r of (regs || [])) {
                    if (r && r.active && typeof r.active.postMessage === 'function') {
                        try { r.active.postMessage({ type: 'GET_SW_DEBUG_LOGS', limit: 500 }); } catch (e) {}
                    }
                }
            }).catch(() => {});
        }

        // Give the SW a short moment to respond/write DB, then refresh the overlay
        setTimeout(() => refreshAdminSwLogs(false), 900);
    } catch (e) {
        try { refreshAdminSwLogs(false); } catch (_) {}
    }
}

// Try to force the service worker to control this page: re-register and reload
function takeControl() {
    try {
        const statusEl = document.getElementById('admin-sw-status');
        if (statusEl) statusEl.textContent = 'Attempting to take control (re-registering SW)...';

        // Try to register a new copy (with cache-bust) and then call skipWaiting on waiting worker
        const stamp = Date.now();
        navigator.serviceWorker.register(`./service-worker.js?v=${stamp}`).then(async reg => {
            // If there's a waiting worker, tell it to skipWaiting
            if (reg.waiting) {
                try { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (_) {}
            }

            // Try to request claim from active worker via MessageChannel
            try {
                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                    const mc = new MessageChannel();
                    const resp = await new Promise((resolve) => {
                        let settled = false;
                        mc.port1.onmessage = (e) => { settled = true; resolve(e.data); };
                        try { navigator.serviceWorker.controller.postMessage({ type: 'REQUEST_CLAIM' }, [mc.port2]); } catch (e) { settled = true; resolve(null); }
                        setTimeout(() => { if (!settled) resolve(null); }, 2000);
                    });
                    if (resp && (resp.type === 'CLIENT_CLAIMED' || resp.success)) {
                        // success: reload so controller becomes available
                        setTimeout(() => window.location.reload(), 300);
                        return;
                    }
                }
            } catch (e) {}

            // Fallback: if no controller or claim didn't confirm, reload after short wait
            setTimeout(() => window.location.reload(), 800);
        }).catch(() => {
            // fallback: hard reload
            setTimeout(() => window.location.reload(true), 400);
        });
    } catch (e) {
        try { window.location.reload(); } catch (_) {}
    }
}

function createAdminSwLogOverlay() {
    if (document.getElementById('admin-sw-log-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'admin-sw-log-overlay';
    
    // CSS responsivo e moderno
    const style = document.createElement('style');
    style.textContent = `
        #admin-sw-log-overlay {
            position: fixed;
            right: 12px;
            bottom: 12px;
            width: min(520px, calc(100vw - 24px));
            max-height: min(70vh, 600px);
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: #f1f5f9;
            font-size: 13px;
            padding: 0;
            border-radius: 12px;
            z-index: 99999;
            box-shadow: 0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1);
            display: flex;
            flex-direction: column;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
            transition: all 0.3s ease;
        }
        
        #admin-sw-log-overlay button {
            background: rgba(255,255,255,0.1);
            color: #e2e8f0;
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s ease;
        }
        
        #admin-sw-log-overlay button:hover {
            background: rgba(255,255,255,0.2);
            border-color: rgba(255,255,255,0.3);
            transform: translateY(-1px);
        }
        
        @media (max-width: 768px) {
            #admin-sw-log-overlay {
                right: 8px;
                bottom: 8px;
                width: calc(100vw - 16px);
                max-height: 60vh;
            }
            
            #admin-sw-header {
                flex-wrap: wrap;
                gap: 8px !important;
            }
            
            #admin-sw-header > div:last-child {
                gap: 4px !important;
            }
            
            #admin-sw-log-overlay button {
                padding: 4px 6px !important;
                font-size: 11px;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Modal completo - inicia minimizado
    overlay.innerHTML = `
        <div id="admin-sw-full" style="display:none;">
            <div id="admin-sw-header" style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid rgba(255,255,255,0.1);">
                <div style="display:flex;align-items:center;gap:10px">
                    <strong style="font-size:14px;color:#38bdf8;">🔧 Debug</strong>
                    <span style="font-size:11px;color:#94a3b8;background:rgba(56,189,248,0.2);padding:2px 6px;border-radius:4px;">admin</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px">
                    <button id="admin-sw-refresh" title="Atualizar logs" style="padding:6px 8px">🔄</button>
                    <button id="admin-sw-copylogs" title="Copiar logs" style="padding:6px 8px">📋</button>
                    <button id="admin-sw-ask" title="Solicitar SW" style="padding:6px 8px">📡</button>
                    <button id="admin-sw-clear" title="Limpar DB" style="padding:6px 8px">🗑️</button>
                    <button id="admin-sw-minimize" title="Minimizar" style="padding:6px 8px">➖</button>
                    <button id="admin-sw-close" title="Fechar" style="padding:6px 8px">✕</button>
                </div>
            </div>
            <div id="admin-sw-main" style="display:flex;flex-direction:column;padding:12px;">
                <div id="admin-sw-log-list" style="overflow:auto;flex:1;background:rgba(0,0,0,0.3);padding:12px;border-radius:8px;font-family:'Courier New',monospace;white-space:pre-wrap;color:#e2e8f0;max-height:400px;border:1px solid rgba(255,255,255,0.1);">Clique em Atualizar para carregar dados...</div>
            </div>
        </div>
        <div id="admin-sw-mini" style="display:block;padding:8px 12px;cursor:pointer;" title="Expandir Debug">
            <span style="font-size:13px;color:#38bdf8;">🔧</span>
        </div>
    `;

    document.body.appendChild(overlay);
    
    // Ajusta o tamanho inicial para o modo minimizado
    overlay.style.width = 'auto';
    overlay.style.height = 'auto';

    document.body.appendChild(overlay);

    document.getElementById('admin-sw-close').addEventListener('click', () => overlay.remove());
    document.getElementById('admin-sw-refresh').addEventListener('click', () => refreshAdminSwLogs(true, 'both'));
    document.getElementById('admin-sw-copylogs').addEventListener('click', async () => {
        try {
            await copySwLogsToClipboard();
            const statusEl = document.getElementById('admin-sw-status');
            if (statusEl) statusEl.textContent = 'Logs copied to clipboard';
        } catch (e) {
            const statusEl = document.getElementById('admin-sw-status');
            if (statusEl) statusEl.textContent = 'Failed to copy logs';
        }
    });
    // Minimizar todo o modal
    document.getElementById('admin-sw-minimize').addEventListener('click', () => {
        document.getElementById('admin-sw-full').style.display = 'none';
        document.getElementById('admin-sw-mini').style.display = 'block';
        overlay.style.width = 'auto';
        overlay.style.height = 'auto';
    });
    
    document.getElementById('admin-sw-mini').addEventListener('click', () => {
        document.getElementById('admin-sw-full').style.display = 'block';
        document.getElementById('admin-sw-mini').style.display = 'none';
        overlay.style.width = 'min(520px, calc(100vw - 24px))';
        overlay.style.height = 'auto';
    });
    document.getElementById('admin-sw-ask').addEventListener('click', () => askSwForLogs());
    document.getElementById('admin-sw-clear').addEventListener('click', async () => {
        const statusEl = document.getElementById('admin-sw-status');
        try {
            if (statusEl) statusEl.textContent = 'Clearing DB...';
            // First, ask the service worker to clear its copy (if active)
            let swCleared = false;
            try {
                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                    const mc = new MessageChannel();
                    const resp = await new Promise((resolve) => {
                        let settled = false;
                        mc.port1.onmessage = (e) => { settled = true; resolve(e.data); };
                        try { navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_SW_DEBUG_DB' }, [mc.port2]); } catch (e) { settled = true; resolve(null); }
                        setTimeout(() => { if (!settled) resolve(null); }, 3000);
                    });
                    if (resp && (resp.success || resp.type === 'CLEAR_SW_DEBUG_DB_DONE')) swCleared = true;
                }
            } catch (e) {}

            // Fallback: postMessage to active registrations so SW can clear itself
            if (!swCleared && navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function') {
                try {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    for (const r of (regs || [])) {
                        if (r && r.active && typeof r.active.postMessage === 'function') {
                            try { r.active.postMessage({ type: 'CLEAR_SW_DEBUG_DB' }); } catch (e) {}
                        }
                    }

                    // wait briefly for SW to process
                    await new Promise(res => setTimeout(res, 600));
                } catch (e) {}
            }

            // Now clear the client-side view of the DB as well
            await clearSwDebugDb();
            // small delay to ensure DB commits
            await new Promise(r => setTimeout(r, 300));
            refreshAdminSwLogs(true);
        } catch (e) {
            if (statusEl) statusEl.textContent = 'Error clearing DB';
        }
    });


    // Não carrega automaticamente - usuário deve clicar em Atualizar
}

async function refreshAdminSwLogs(forceAll = false, tab = 'both') {
    const listEl = document.getElementById('admin-sw-log-list');
    if (!listEl) return;
    const statusEl = document.getElementById('admin-sw-status');
    if (statusEl) statusEl.textContent = 'Checking SW status...';
    listEl.textContent = 'Loading...';
    try {
        // SW controller/registration status
        let controllerExists = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
        let regInfo = null;
        try {
            const regs = await navigator.serviceWorker.getRegistrations();
            if (regs && regs.length) {
                const r = regs[0];
                regInfo = { scope: r.scope, active: !!r.active, scriptURL: r.active && r.active.scriptURL };
            }
        } catch (e) { regInfo = null; }
        if (statusEl) statusEl.textContent = `controller:${controllerExists} registration:${regInfo ? JSON.stringify(regInfo) : 'none'}`;
        let logs = [];
        let pending = [];

        // First try reading from IndexedDB directly
        try {
            if (tab === 'both' || tab === 'logs') logs = await readSwLogsFromClient(200);
            if (tab === 'both' || tab === 'pending') pending = await readPendingActionsClient(200);
        } catch (dbErr) {
            // ignore and try SW message fallback
            logs = [];
            pending = [];
        }

        // If empty and we want more, ask the service worker via MessageChannel or via registration.active.postMessage
        if ((logs.length === 0 && (tab === 'both' || tab === 'logs')) || (pending.length === 0 && (tab === 'both' || tab === 'pending')) || forceAll) {
            try {
                // Helper: wait for a one-shot message from the SW (fallback when DB reads fail)
                const waitForSwMessage = (timeoutMs = 2500) => new Promise((resolve) => {
                    let done = false;
                    const onMsg = (e) => {
                        try {
                            if (!e || !e.data) return;
                            // Accept SW_DEBUG_LOGS, NOTIFICATION_CLICK_RECEIVED, CLIENT_CLAIMED
                            if (e.data.type === 'SW_DEBUG_LOGS' && (e.data.logs || e.data.pending)) {
                                done = true;
                                navigator.serviceWorker.removeEventListener('message', onMsg);
                                resolve(e.data);
                                return;
                            }
                            if (e.data.type === 'NOTIFICATION_CLICK_RECEIVED' && e.data.payload) {
                                done = true;
                                navigator.serviceWorker.removeEventListener('message', onMsg);
                                resolve({ pending: [e.data.payload] });
                                return;
                            }
                            if (e.data.type === 'CLIENT_CLAIMED') {
                                done = true;
                                navigator.serviceWorker.removeEventListener('message', onMsg);
                                resolve({ claimed: true });
                                return;
                            }
                        } catch (_) {}
                    };
                    try { navigator.serviceWorker.addEventListener('message', onMsg); } catch (_) { resolve(null); return; }
                    setTimeout(() => {
                        if (!done) {
                            try { navigator.serviceWorker.removeEventListener('message', onMsg); } catch (_) {}
                            resolve(null);
                        }
                    }, timeoutMs);
                });

                // Try controller via MessageChannel first (direct port response is ideal)
                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                    try {
                        const mc = new MessageChannel();
                        const result = await new Promise((resolve) => {
                            let settled = false;
                            mc.port1.onmessage = (e) => { settled = true; resolve(e.data); };
                            try { navigator.serviceWorker.controller.postMessage({ type: 'GET_SW_DEBUG_LOGS', limit: 500 }, [mc.port2]); } catch (e) { settled = true; resolve(null); }
                            setTimeout(() => { if (!settled) resolve(null); }, 2000);
                        }).catch(() => null);
                        if (result && result.logs) logs = result.logs;
                    } catch (e) {}
                }

                // If still empty, try registrations fallback and also listen for a broadcasted message from SW
                if ((logs.length === 0) && navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
                    try {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        for (const r of (regs || [])) {
                            if (r && r.active && typeof r.active.postMessage === 'function') {
                                try {
                                    r.active.postMessage({ type: 'GET_SW_DEBUG_LOGS', limit: 500 });
                                } catch (e) {}
                            }
                        }

                        // Wait briefly for the SW to broadcast logs to clients, prefer direct message payload if available
                        const swMsg = await waitForSwMessage(2200);
                        if (swMsg && swMsg.logs && swMsg.logs.length) {
                            logs = swMsg.logs;
                        }

                        // Give SW a moment to write DB and retry reading DB if still empty
                        if (logs.length === 0) {
                            await new Promise(res => setTimeout(res, 800));
                            if (tab === 'both' || tab === 'logs') logs = await readSwLogsFromClient(200);
                            if (tab === 'both' || tab === 'pending') pending = await readPendingActionsClient(200);
                        }
                    } catch (e) {}
                }
            } catch (swMsgErr) {
                // ignore
            }
        }

        let out = '';
        if (tab === 'both' || tab === 'pending') {
            out += '--- Pending Actions ---\n';
            if (!pending || pending.length === 0) out += '(none)\n';
            else pending.forEach(p => out += `${new Date(p.ts).toISOString()} ${p.action} ${JSON.stringify(p.data)}\n`);
            out += '\n';
        }

        if (tab === 'both' || tab === 'logs') {
            out += '--- SW Logs ---\n';
            if (!logs || logs.length === 0) out += '(none)\n';
            else logs.forEach(l => out += `${new Date(l.ts).toISOString()} ${l.type} ${JSON.stringify(l)}\n`);
        }

        listEl.textContent = out;
        listEl.scrollTop = 0;
    } catch (e) {
        listEl.textContent = 'Error reading logs: ' + (e && e.message ? e.message : String(e));
    }
}

// Readers for the SW DB from the client
function openSwDbFromClientSimple() {
    // Open DB and create stores if missing (safe from client side)
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('sw-debug-logs', 1);
        req.onupgradeneeded = (e) => {
            try {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('logs')) db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('pending_actions')) db.createObjectStore('pending_actions', { keyPath: 'id', autoIncrement: true });
            } catch (_) { /* ignore */ }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function readSwLogsFromClient(limit = 100) {
    try {
    const db = await openSwDbFromClientSimple();
        const tx = db.transaction('logs', 'readonly');
        const store = tx.objectStore('logs');
        return await new Promise((resolve, reject) => {
            const items = [];
            const req = store.openCursor(null, 'prev');
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor && items.length < limit) {
                    items.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(items);
                }
            };
            req.onerror = () => reject(req.error);
        }).finally(() => db.close());
    } catch (e) {
        return [];
    }
}

async function readPendingActionsClient(limit = 100) {
    try {
    const db = await openSwDbFromClientSimple();
    const tx = db.transaction('pending_actions', 'readonly');
    const store = tx.objectStore('pending_actions');
        return await new Promise((resolve, reject) => {
            const items = [];
            const req = store.openCursor();
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor && items.length < limit) {
                    items.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(items);
                }
            };
            req.onerror = () => reject(req.error);
        }).finally(() => db.close());
    } catch (e) {
        return [];
    }
}

// Clear the SW debug DB (logs and pending_actions)
function clearSwDebugDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('sw-debug-logs', 1);
        req.onupgradeneeded = (e) => {
            // nothing to do, stores will be created if missing
            try { const db = e.target.result; if (!db.objectStoreNames.contains('logs')) db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true }); if (!db.objectStoreNames.contains('pending_actions')) db.createObjectStore('pending_actions', { keyPath: 'id', autoIncrement: true }); } catch(_){}
        };
        req.onsuccess = () => {
            try {
                const db = req.result;
                const tx = db.transaction(['logs','pending_actions'],'readwrite');
                tx.objectStore('logs').clear();
                tx.objectStore('pending_actions').clear();
                tx.oncomplete = () => { try { db.close(); } catch(_){}; resolve(true); };
                tx.onerror = () => { try { db.close(); } catch(_){}; reject(tx.error || new Error('clear_failed')); };
            } catch (e) { try { req.result && req.result.close(); } catch(_){}; reject(e); }
        };
        req.onerror = () => reject(req.error || new Error('open_failed'));
    });
}

// Copy current overlay logs to clipboard (reads from client DB if necessary)
async function copySwLogsToClipboard() {
    const listEl = document.getElementById('admin-sw-log-list');
    if (!listEl) throw new Error('no_list');
    let text = listEl.textContent || '';

    // If empty, try reading logs directly
    if (!text || text.trim().length === 0) {
        const logs = await readSwLogsFromClient(500);
        const pending = await readPendingActionsClient(500);
        let out = '';
        out += '--- Pending Actions ---\n';
        if (!pending || pending.length === 0) out += '(none)\n'; else pending.forEach(p => out += `${new Date(p.ts).toISOString()} ${p.action} ${JSON.stringify(p.data)}\n`);
        out += '\n--- SW Logs ---\n';
        if (!logs || logs.length === 0) out += '(none)\n'; else logs.forEach(l => out += `${new Date(l.ts).toISOString()} ${l.type} ${JSON.stringify(l)}\n`);
        text = out;
    }

    // Try navigator.clipboard first
    if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
    }

    // Fallback: create textarea and execCommand
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) throw new Error('copy_failed');
        return true;
    } catch (e) {
        try { document.body.removeChild(ta); } catch(_){}
        throw e;
    }
}


    setupAuthListener(auth, db, appId);


    setupSidebar();
    setupModernSidebar();
    setupPageNavigation(startGame, getPlayers, appId);
    setupAccordion();
    setupConfigUI();
    setupScoreInteractions();
    setupTeamSelectionModal();

    setupHistoryPage();
    setupSchedulingPage();
    setupQuickSettings();
    initTimerDrawer();

    // Listeners for team page buttons
    const generateTeamsButton = document.getElementById('generate-teams-button');
    if (generateTeamsButton) {
        generateTeamsButton.addEventListener('click', () => {
            showConfirmationModal(
                'Deseja gerar os times agora? Isso pode reorganizar os times atuais.',
                () => {
                    generateTeams(appId);
                }
            );
        });
    }

    // --- Indicador visual de overflow (sombra) para a área de times ---
    const teamsSub = document.querySelector('.teams-page-layout-sub');
    if (teamsSub) {
        const updateShadows = () => {
            const scrollTop = teamsSub.scrollTop;
            const scrollHeight = teamsSub.scrollHeight;
            const clientHeight = teamsSub.clientHeight;

            if (scrollTop > 5) {
                teamsSub.classList.add('has-scroll-top');
            } else {
                teamsSub.classList.remove('has-scroll-top');
            }

            if (scrollTop + clientHeight < scrollHeight - 5) {
                teamsSub.classList.add('has-scroll-bottom');
            } else {
                teamsSub.classList.remove('has-scroll-bottom');
            }
        };

        teamsSub.addEventListener('scroll', updateShadows, { passive: true });
        window.addEventListener('resize', updateShadows);
        setTimeout(updateShadows, 100);
    }

    const toggleTimerButton = document.getElementById('toggle-timer-button');
    if (toggleTimerButton) {
        toggleTimerButton.addEventListener('click', () => {
            toggleTimer();
        });
    }

    const swapTeamsButton = document.getElementById('swap-teams-button');
    if (swapTeamsButton) {
        swapTeamsButton.addEventListener('click', () => {
            swapTeams();
        });
    }

    const timerAndSetTimerWrapperElement = Elements.timerAndSetTimerWrapper();
    if (timerAndSetTimerWrapperElement) {
        timerAndSetTimerWrapperElement.addEventListener('click', () => {
            toggleTimer();
        });
    }

    const endGameButton = document.getElementById('end-game-button');
    if (endGameButton) {
        endGameButton.addEventListener('click', () => {
            showConfirmationModal(
                'Are you sure you want to end the game? The score will be saved to history.',
                () => {
                    endGame();
                }
            );
        });
    }

    const googleLoginButton = document.getElementById('google-login-button');
    if (googleLoginButton) {
        googleLoginButton.addEventListener('click', () => {
            loginWithGoogle();
        });
    }

    const anonymousLoginButton = document.getElementById('anonymous-login-button');
    if (anonymousLoginButton) {
        anonymousLoginButton.addEventListener('click', () => {
            signInAnonymouslyUser(appId);
        });
    }
    
    setTimeout(() => {
        if (window.pwaManager) {
            window.pwaManager.checkInstallStatus();
            if (!window.pwaManager.isInstalled) {
                window.pwaManager.showLoginInstallButton();
            }
        }
    }, 2000);

    try {
        await offlineStorage.init();
    } catch (error) {
        // Error initializing offline storage
    }
    

    // Configura listener para recuperação Firestore
    firestoreRecovery.addListener((event) => {
        switch (event) {
            case 'recovery-start':
                updateConnectionIndicator('reconnecting');
                displayMessage("Detectado problema de conexão. Reconectando...", "warning");
                break;
            case 'recovery-success':
                updateConnectionIndicator('online');
                displayMessage("Conexão restaurada com sucesso!", "success");
                break;
            case 'recovery-failed':
                updateConnectionIndicator('offline');
                displayMessage("Falha na reconexão. Usando dados locais.", "error");
                break;
        }
    });

    connectivityManager.onStatusChange(async (status) => {
        if (status === 'online') {
            displayMessage("Online novamente! Sincronizando dados...", "info");
            updateConnectionIndicator('reconnecting');
            
            try {
                // Reset sistema de recuperação ao voltar online
                firestoreRecovery.reset();
                
                const { app, db, auth } = await initFirebaseApp();
                const appId = getAppId();
                
                await setupAuthListener(auth, db, appId);
                await setupFirestorePlayersListener(db, appId);
                updateProfileMenuLoginState();
                updateSchedulingPermissions();
                
                if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = false;
                if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = false;
                
                displayMessage("Dados sincronizados com sucesso!", "success");
                updateConnectionIndicator('online');
            } catch (error) {
                displayMessage("Erro ao sincronizar dados", "error");
                updateConnectionIndicator('offline');
            }
        } else {
            displayMessage("Você está offline. Dados salvos localmente.", "warning");
            
            if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = true;
            if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = true;
            
            updateProfileMenuLoginState();
            updateConnectionIndicator('offline');
            
            await loadOfflineData();
        }
    });

    // Dropdown user menu logic
    const userDropdown = document.getElementById('userDropdown');
    const userDropdownToggle = document.getElementById('userDropdownToggle');
    const userDropdownMenu = document.getElementById('userDropdownMenu');
    const logoutBtn = document.getElementById('logoutBtn');

    if (userDropdown && userDropdownToggle && userDropdownMenu && logoutBtn) {
        userDropdownToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        });

        userDropdownMenu.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        document.addEventListener('click', () => {
            userDropdown.classList.remove('show');
        });

        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            userDropdown.classList.remove('show');
            logout();
        });
    }

    updateConnectionIndicator(connectivityManager.getStatus());

    (function setupScrollbarVisibility() {
        const scrollables = new Set();
        const selectors = [
            'body', '.app-main-content', '.sidebar-menu',
            '#players-page', '#teams-page', '#users-page', '.users-content', '.users-grid', '#history-page', '#config-page', '#scheduling-page',
            '.players-list-container', '.teams-page-layout-sub', '.scheduling-container', '.tab-content', '.schedule-modal-content', '.substitute-modal-content', '.substitute-players-list', '.accordion-content', '.select-team-modal-content-wrapper', '.team-players-column'
        ];
        const elems = selectors.flatMap(sel => Array.from(document.querySelectorAll(sel)));
        elems.forEach(el => {
            if (!el) return;
            const handler = () => {
                el.classList.add('is-scrolling');
                clearTimeout(el.__sbTimer);
                el.__sbTimer = setTimeout(() => el.classList.remove('is-scrolling'), 550);
            };
            el.addEventListener('scroll', handler, { passive: true });
            scrollables.add(el);
        });
        window.addEventListener('scroll', () => {
            document.body.classList.add('is-scrolling');
            clearTimeout(window.__sbTimer);
            window.__sbTimer = setTimeout(() => document.body.classList.remove('is-scrolling'), 550);
        }, { passive: true });
    })();

    document.body.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return;

    const modalOpen = document.querySelector('.quick-settings-modal.active') || document.querySelector('.substitute-modal') || document.querySelector('.select-team-modal-container.modal-active') || document.querySelector('.confirmation-modal-overlay.active') || document.querySelector('.schedule-modal.active');
        if (modalOpen) return;

    if (e.target.closest('.substitute-modal-content') || e.target.closest('.substitute-players-list') || e.target.closest('.teams-page-layout-sub') || e.target.closest('.players-list-container') || e.target.closest('.quick-settings-content') || e.target.closest('.quick-settings-modal') || e.target.closest('.config-page-layout') || e.target.closest('.accordion-content') || e.target.closest('.accordion-content-sub') || e.target.closest('.settings-list') || e.target.closest('.accordion-content-sub-teams') || e.target.closest('.accordion-content-sub-full-width') || e.target.closest('#scheduling-page') || e.target.closest('.scheduling-container') || e.target.closest('.tab-content') || e.target.closest('.schedule-modal') || e.target.closest('.schedule-modal-content') || e.target.closest('#users-page') || e.target.closest('.users-content') || e.target.closest('.users-grid')) {
            return;
        }
        const startY = e.touches[0].clientY;
        if (startY <= 10 && window.scrollY === 0) {
            e.preventDefault();
        }
    }, { passive: false });

    document.body.addEventListener('touchmove', e => {
    const modalOpen = document.querySelector('.quick-settings-modal.active') || document.querySelector('.substitute-modal') || document.querySelector('.select-team-modal-container.modal-active') || document.querySelector('.confirmation-modal-overlay.active') || document.querySelector('.schedule-modal.active');
        if (modalOpen) return;

        if (e.target.closest('.players-list-container') ||
            e.target.closest('.player-category-tabs') ||
            e.target.closest('.teams-page-layout-sub') ||
            e.target.closest('.substitute-modal-content') ||
            e.target.closest('.substitute-players-list') ||
            e.target.closest('.quick-settings-content') ||
            e.target.closest('.quick-settings-modal') ||
            e.target.closest('.config-page-layout') ||
            e.target.closest('.accordion-content') ||
            e.target.closest('.accordion-content-sub') ||
            e.target.closest('.settings-list') ||
            e.target.closest('.accordion-content-sub-teams') ||
            e.target.closest('.accordion-content-sub-full-width') ||
            e.target.closest('#scheduling-page') ||
            e.target.closest('.scheduling-container') ||
            e.target.closest('.tab-content') ||
            e.target.closest('.schedule-modal') ||
            e.target.closest('.schedule-modal-content') ||
            e.target.closest('#users-page') ||
            e.target.closest('.users-content') ||
            e.target.closest('.users-grid')) {
            return;
        }
        e.preventDefault();
    }, { passive: false });

    loadAppVersion();
    registerServiceWorker();

    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('clearCache') === '1' && 'serviceWorker' in navigator) {
            if (navigator.serviceWorker.controller) {
                const messageChannel = new MessageChannel();
                messageChannel.port1.onmessage = (event) => {
                    if (event.data && event.data.success) {
                        window.location.reload(true);
                    }
                };
                navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' }, [messageChannel.port2]);
            } else {
                navigator.serviceWorker.getRegistrations().then(regs => Promise.all(regs.map(r => r.unregister()))).then(() => window.location.reload(true));
            }
        }
    } catch (err) {

    }
    
    initDailyReminders();
    
    setupAutoSave();

    if (Elements.sidebarOverlay()) {
        Elements.sidebarOverlay().addEventListener('click', () => {
            closeSidebar();
        });
    }
    
    setTimeout(async () => {
        try {
            const restored = restoreSavedGameIfAny();
            if (restored) {
            }
            await updateStartButtonText();
            forceUpdateIcons();
            
            if (window.pwaManager) {
                window.pwaManager.checkInstallStatus();
                if (!window.pwaManager.isInstalled) {
                    window.pwaManager.showLoginInstallButton();
                }
            }
        } catch (e) {

        }
    }, 100);

    window.isAppReady = true;

    // Verifica saúde da conexão Firestore após inicialização
    setTimeout(async () => {
        try {
            const isHealthy = await firestoreRecovery.checkConnectionHealth();
            if (!isHealthy) {
                console.warn('Conexão Firestore pode estar instável');
                // Tenta aplicar correções automáticas
                const fixes = await applyFirestoreFixes();
                if (fixes.length > 0) {
                    console.log('Correções aplicadas:', fixes);
                }
            }
            

        } catch (e) {
            // Silencioso
        }
    }, 3000);
    


    // Verifica se há ações pendentes de notificação (apenas se realmente veio de uma notificação)
    setTimeout(() => {
        const fromNotification = sessionStorage.getItem('fromNotification');
        const notificationTimestamp = sessionStorage.getItem('notificationTimestamp');
        const pendingScheduleId = sessionStorage.getItem('pendingOpenRsvpScheduleId');
        
        // Só processa se realmente veio de uma notificação E tem dados pendentes específicos
        if (fromNotification === 'true' && notificationTimestamp && pendingScheduleId) {
            const timeDiff = Date.now() - parseInt(notificationTimestamp);
            // Se a notificação foi recente (menos de 5 segundos) e tem ID específico
            if (timeDiff < 5000) {
                // Verifica se o agendamento ainda existe
                try {
                    const schedules = JSON.parse(localStorage.getItem('voleiScoreSchedules') || '[]');
                    const scheduleExists = schedules.some(s => s.id === pendingScheduleId);
                    
                    if (scheduleExists) {
                        // Garante que estamos na página de agendamentos
                        if (typeof showPage === 'function') {
                            showPage('scheduling-page');
                        } else {
                            window.location.hash = '#scheduling-page';
                        }
                    }
                } catch (e) {
                    // Se houver erro ao verificar, não abre o modal
                }
            }
        }
        
        // Limpa os flags após processar (sempre limpa para evitar acúmulo)
        sessionStorage.removeItem('fromNotification');
        sessionStorage.removeItem('notificationTimestamp');
        sessionStorage.removeItem('lastRSVPData');
    }, 1000);






// Enforce no autocomplete on all forms and inputs, and prevent password save prompts
(function setupNoAutocomplete() {
    function applyNoAutoForInput(el) {
        if (!el) return;
        try {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                // Generic fields: disable autocomplete and suggestions
                el.setAttribute('autocomplete', 'off');
                el.setAttribute('autocapitalize', 'off');
                el.setAttribute('autocorrect', 'off');
                el.spellcheck = false;

                // Password fields: use new-password to avoid save/update prompts
                if (el.getAttribute('type') === 'password') {
                    el.setAttribute('autocomplete', 'new-password');
                    // Set a neutral name to avoid credential manager heuristics
                    if (!el.hasAttribute('name')) {
                        el.setAttribute('name', 'new-password');
                    }
                }
            }
        } catch (_) { /* noop */ }
    }

    function enforce(root) {
        const scope = root && root.querySelectorAll ? root : document;
        // Forms
        scope.querySelectorAll('form').forEach(f => {
            try { f.setAttribute('autocomplete', 'off'); } catch (_) { /* noop */ }
        });
        // Inputs & textareas
        scope.querySelectorAll('input, textarea').forEach(applyNoAutoForInput);
    }

    // Initial pass
    enforce(document);

    // Observe dynamically added nodes
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            m.addedNodes && m.addedNodes.forEach((node) => {
                if (!(node instanceof Element)) return;
                // Apply directly on the node if relevant
                if (node.matches('form')) {
                    try { node.setAttribute('autocomplete', 'off'); } catch (_) { /* noop */ }
                }
                if (node.matches('input, textarea')) {
                    applyNoAutoForInput(node);
                }
                // And any descendants
                enforce(node);
            });
        }
    });
    try {
        observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch (_) { /* noop */ }
    // Expose for potential cleanup/debug
    window.__noAutocompleteObserver = observer;
})();

// Função para atualizar o texto do botão de iniciar
async function updateStartButtonText() {
    const startButton = document.getElementById('start-game-button');
    if (startButton) {
        const { carregarEstado } = await import('./utils/helpers.js');
        const saved = carregarEstado();
        if (saved && saved.isGameInProgress) {
            startButton.textContent = 'Continuar Partida';
        } else {
            startButton.textContent = 'Começar Jogo';
        }
    }
}

// Função para carregar dados offline
async function loadOfflineData() {
    try {
        // Carrega jogadores do cache offline
        const cachedPlayers = await offlineStorage.getPlayers();
        if (cachedPlayers && cachedPlayers.length > 0) {
        }
        
        // Carrega configurações do cache offline
        const cachedConfig = await offlineStorage.getConfig();
        if (cachedConfig && Object.keys(cachedConfig).length > 0) {
        }
        
        // Carrega histórico do cache offline
        const cachedHistory = await offlineStorage.getGameHistory();
        if (cachedHistory && cachedHistory.length > 0) {
        }
        
    } catch (error) {

    }
}

// Função para configurar salvamento automático
function setupAutoSave() {
    // Salva dados críticos periodicamente
    setInterval(async () => {
        try {
            // Salva estado atual dos jogadores
            const currentPlayers = getPlayers();
            if (currentPlayers && currentPlayers.length > 0) {
                await offlineStorage.savePlayers(currentPlayers);
            }
            
            // Salva configurações atuais
            const currentConfig = loadConfig();
            if (currentConfig) {
                await offlineStorage.saveConfig(currentConfig);
            }
            
        } catch (error) {

        }
    }, 30000); // Salva a cada 30 segundos
    
    // Salva dados antes de fechar a página
    window.addEventListener('beforeunload', async () => {
        try {
            const currentPlayers = getPlayers();
            if (currentPlayers) await offlineStorage.savePlayers(currentPlayers);
            
            const currentConfig = loadConfig();
            if (currentConfig) await offlineStorage.saveConfig(currentConfig);
            
        } catch (error) {

        }
    });
}

// Função global para limpar cache (pode ser chamada das configurações)
window.clearOfflineCache = async () => {
    try {
        await offlineStorage.clearAll();
        
        if (window.clearAppCache) {
            await window.clearAppCache();
        }
        
        displayMessage('Cache offline limpo com sucesso!', 'success');
        
        setTimeout(() => {
            window.location.reload();
        }, 1000);
        
        return true;
    } catch (error) {

        displayMessage('Erro ao limpar cache offline', 'error');
        return false;
    }
};

// Função para obter estatísticas de armazenamento
window.getStorageStats = async () => {
    try {
        const stats = await offlineStorage.getStorageStats();
        return stats;
    } catch (error) {

        return null;
    }
};


// Adiciona navegação baseada no hash da URL
function handleHashNavigation() {
    const hash = window.location.hash.replace('#', '');
    if (hash && hash.endsWith('-page')) {
        showPage(hash);
    }
}
window.addEventListener('hashchange', handleHashNavigation);
document.addEventListener('DOMContentLoaded', () => {
    handleHashNavigation();
});
// Handler centralizado de mensagens do Service Worker foi movido para utils/notifications.js para evitar duplicidade e inconsistências de payload.