// js/main.js
// Ponto de entrada principal do seu aplicativo. Orquestra a inicialização e os módulos.

import { initFirebaseApp, getAppId } from './firebase/config.js';
import { logout, setupAuthListener, signInAnonymouslyUser, updateProfileMenuLoginState, getCurrentUser, loginWithGoogle } from './firebase/auth.js'; // Imports updateProfileMenuLoginState
import { setupFirestorePlayersListener } from './data/players.js';
import * as SchedulesData from './data/schedules.js'; // Keep this for other uses of SchedulesData
// Removed imports related to processPendingNotificationAttendance
import { showPage, updatePlayerModificationAbility, setupSidebar, setupPageNavigation, setupAccordion, setupScoreInteractions, setupTeamSelectionModal, closeSidebar, hideConfirmationModal, showConfirmationModal, forceUpdateIcons } from './ui/pages.js';
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
import { registerNotificationServiceWorker } from './utils/notifications.js';
import { initWelcomeNotifications } from './ui/welcome-notifications.js';
import { initDailyReminders } from './utils/daily-reminders.js';
import connectivityManager from './utils/connectivity.js';
import offlineStorage from './utils/offline-storage.js';
import pwaManager from './utils/pwa-manager.js';
import { getActiveTeam1Name } from '../js/game/logic.js';
import { getActiveTeam2Name } from '../js/game/logic.js';
import safeAreasManager from './utils/safe-areas.js';

import { signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

let authListenerInitialized = false;
export function markAuthInitialized() { authListenerInitialized = true; }
let loadingTimeout = null;

// Use exatamente os UIDs das regras do Firebase
const ADMIN_UIDS = [
    "fVTPCFEN5KSKt4me7FgPyNtXHMx1",
    "Q7cjHJcQoMV9J8IEaxnFFbWNXw22"
    // Adicione mais UIDs de admin aqui, se necessário
];

// Função utilitária para checar se o usuário atual é admin
function isCurrentUserAdmin() {
    const user = getCurrentUser();
    if (!user || !user.uid) return false;
    return ADMIN_UIDS.includes(user.uid);
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

document.addEventListener('DOMContentLoaded', async () => {
    window.isAppReady = true;
    

    
    // Navegação automática baseada no hash ao abrir o app
    if (window.location.hash && window.location.hash.startsWith('#') && window.location.hash.length > 1) {
        const pageId = window.location.hash.substring(1);
        // Só ativa se o elemento existe e termina com '-page'
        if (document.getElementById(pageId) && pageId.endsWith('-page')) {
            const mod = await import('./ui/pages.js');
            if (mod && typeof mod.showPage === 'function') {
                mod.showPage(pageId);
                waitForCorrectPage(pageId);
            }
        }
    }
    handleHashNavigation();
});
    // --- SCOREBOARD MENU DROPDOWN ---
    const scoreboardMenuButton = document.getElementById("scoreboard-menu-button");
    const scoreboardMenuDropdown = document.getElementById("scoreboard-menu-dropdown");
    const scoreboardMenuOverlay = document.getElementById("scoreboard-menu-overlay");




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




    // Seleciona o primeiro botão do scoreboard-menu-dropdown
    const invertTeamsButton = document.querySelector('#scoreboard-menu-dropdown button:first-child');

    // Adiciona um evento de clique ao botão
    invertTeamsButton.addEventListener('click', () => {
    // Chama a função swapTeams quando o botão for clicado
    import('../js/game/logic.js').then(mod => {
        mod.swapTeams();
    });
    });

    
    // Seleciona o terceiro botão do scoreboard-menu-dropdown
    const team2ChangeButtonOption = document.querySelector('#scoreboard-menu-dropdown button:nth-child(3)');

    // Define o texto com o nome atual do time 2 preservando o ícone
    if (team2ChangeButtonOption) {
        const iconEl = team2ChangeButtonOption.querySelector('.material-icons');
        const iconHTML = iconEl ? iconEl.outerHTML : '';
        team2ChangeButtonOption.innerHTML = `Substituir ${getActiveTeam2Name()} ${iconHTML}`;
        // Adiciona um evento de clique ao botão
        team2ChangeButtonOption.addEventListener('click', async () => {
            // Abre o modal de seleção diretamente para o painel do Time 2
            const mod = await import('./ui/pages.js');
            if (mod && typeof mod.openTeamSelectionModal === 'function') {
                mod.openTeamSelectionModal('team2');
            }
        });
    }


    // Seleciona o segundo botão do scoreboard-menu-dropdown
    const team1ChangeButtonOption = document.querySelector('#scoreboard-menu-dropdown button:nth-child(2)');

    // Define o texto com o nome atual do time 1 preservando o ícone
    if (team1ChangeButtonOption) {
        const iconEl = team1ChangeButtonOption.querySelector('.material-icons');
        const iconHTML = iconEl ? iconEl.outerHTML : '';
        team1ChangeButtonOption.innerHTML = `Substituir ${getActiveTeam1Name()} ${iconHTML}`;
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
    const quickSettingsOption = document.querySelector('#scoreboard-menu-dropdown button:nth-child(4)');
    if (quickSettingsOption) {
        const iconEl = quickSettingsOption.querySelector('.material-icons');
        const iconHTML = iconEl ? iconEl.outerHTML : '';
        quickSettingsOption.innerHTML = `Configurar partida ${iconHTML}`;
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

    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
            await signInWithCustomToken(auth, __initial_auth_token);
        } catch (error) {

        }
    }


    await registerNotificationServiceWorker();


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
    

    connectivityManager.onStatusChange(async (status) => {
        if (status === 'online') {
            displayMessage("Online novamente! Sincronizando dados...", "info");
            updateConnectionIndicator('reconnecting');
            
            try {
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
            '#players-page', '#teams-page', '#history-page', '#config-page', '#scheduling-page',
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

    if (e.target.closest('.substitute-modal-content') || e.target.closest('.substitute-players-list') || e.target.closest('.teams-page-layout-sub') || e.target.closest('.players-list-container') || e.target.closest('.quick-settings-content') || e.target.closest('.quick-settings-modal') || e.target.closest('.config-page-layout') || e.target.closest('.accordion-content') || e.target.closest('.accordion-content-sub') || e.target.closest('.settings-list') || e.target.closest('.accordion-content-sub-teams') || e.target.closest('.accordion-content-sub-full-width') || e.target.closest('#scheduling-page') || e.target.closest('.scheduling-container') || e.target.closest('.tab-content') || e.target.closest('.schedule-modal') || e.target.closest('.schedule-modal-content')) {
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
            e.target.closest('.schedule-modal-content')) {
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

    // Verifica se há ações pendentes de notificação
    setTimeout(() => {
        const fromNotification = sessionStorage.getItem('fromNotification');
        const notificationTimestamp = sessionStorage.getItem('notificationTimestamp');
        
        if (fromNotification === 'true' && notificationTimestamp) {
            const timeDiff = Date.now() - parseInt(notificationTimestamp);
            // Se a notificação foi recente (menos de 10 segundos)
            if (timeDiff < 10000) {

                
                // Verifica se há dados de RSVP pendentes
                const lastRSVPData = sessionStorage.getItem('lastRSVPData');
                const pendingScheduleId = sessionStorage.getItem('pendingOpenRsvpScheduleId');
                
                if (lastRSVPData || pendingScheduleId) {
                    // Garante que estamos na página de agendamentos
                    if (typeof showPage === 'function') {
                        showPage('scheduling-page');
                    } else {
                        window.location.hash = '#scheduling-page';
                    }
                }
            }
            
            // Limpa os flags após processar
            sessionStorage.removeItem('fromNotification');
            sessionStorage.removeItem('notificationTimestamp');
        }
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