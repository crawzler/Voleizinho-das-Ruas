// js/main.js
// Ponto de entrada principal do seu aplicativo. Orquestra a inicialização e os módulos.

import { initFirebaseApp, getAppId } from './firebase/config.js';
import { logout, setupAuthListener, signInAnonymouslyUser, updateProfileMenuLoginState, getCurrentUser, loginWithGoogle } from './firebase/auth.js'; // Imports updateProfileMenuLoginState
import { setupFirestorePlayersListener } from './data/players.js';
import * as SchedulesData from './data/schedules.js';
import { showPage, updatePlayerModificationAbility, setupSidebar, setupPageNavigation, setupAccordion, setupScoreInteractions, setupTeamSelectionModal, closeSidebar, showConfirmationModal, hideConfirmationModal, forceUpdateIcons } from './ui/pages.js';
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
import { registerNotificationServiceWorker } from './utils/notifications.js';
import { initWelcomeNotifications } from './ui/welcome-notifications.js';
import { initDailyReminders } from './utils/daily-reminders.js';
import connectivityManager from './utils/connectivity.js';
import offlineStorage from './utils/offline-storage.js';
import pwaManager from './utils/pwa-manager.js';

import { signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

let authListenerInitialized = false;
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

document.addEventListener('DOMContentLoaded', async () => {
        
    // Exibe a tela de carregamento imediatamente
    const loadingOverlay = Elements.loadingOverlay();
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden'); // Garante que a tela de carregamento esteja visível
    }
    // Log removido

    // Inicia o timer para forçar o modo offline após 10 segundos, se necessário
    loadingTimeout = setTimeout(() => {
        if (!authListenerInitialized) {
            displayMessage("Não foi possível conectar. Modo offline ativado.", "info");
            showPage('start-page');
            updateConnectionIndicator('offline');
            hideLoadingOverlay();
        }
    }, 10000); // 10 segundos

    // Initializes the Firebase App and gets instances
    const { app, db, auth } = await initFirebaseApp();
    const appId = getAppId();

    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
            await signInWithCustomToken(auth, __initial_auth_token);
        } catch (error) {
            // Log removido
        }
    }

    setupAuthListener(auth, db, appId);
    authListenerInitialized = true;

    setupSidebar();
    setupPageNavigation(startGame, getPlayers, appId);
    setupAccordion();
    setupConfigUI();
    setupScoreInteractions();
    setupTeamSelectionModal();
    setupHistoryPage();
    setupSchedulingPage(); // Garante que a página de agendamento seja configurada uma vez
    setupQuickSettings(); // Configura as configurações rápidas da partida
    
    // Inicializa sistema de notificações
    await registerNotificationServiceWorker();

    // Listeners for team page buttons
    const generateTeamsButton = document.getElementById('generate-teams-button');
    if (generateTeamsButton) {
        generateTeamsButton.addEventListener('click', () => {
            generateTeams(appId);
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
        // roda uma vez para inicializar o estado
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
    
    // Inicializa botão PWA na tela de login após delay
    setTimeout(() => {
        if (window.pwaManager) {
            window.pwaManager.showLoginInstallButton();
        }
    }, 2000);

    // Inicializa sistema de armazenamento offline
    try {
        await offlineStorage.init();
        // Log removido
    } catch (error) {
        // Log removido
    }
    
    // Configura gerenciador de conectividade
    connectivityManager.onStatusChange(async (status) => {
        if (status === 'online') {
            displayMessage("Online novamente! Sincronizando dados...", "info");
            updateConnectionIndicator('reconnecting');
            
            try {
                const { app, db, auth } = await initFirebaseApp();
                const appId = getAppId();
                
                // Recarrega autenticação e configura listeners
                await setupAuthListener(auth, db, appId);
                await setupFirestorePlayersListener(db, appId);
                updateProfileMenuLoginState();
                updateSchedulingPermissions(); // Atualiza permissões de agendamento
                
                // Habilita botões de login
                if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = false;
                if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = false;
                
                displayMessage("Dados sincronizados com sucesso!", "success");
                updateConnectionIndicator('online');
            } catch (error) {
                // Log removido
                displayMessage("Erro ao sincronizar dados", "error");
                updateConnectionIndicator('offline');
            }
        } else {
            // Log removido
            displayMessage("Você está offline. Dados salvos localmente.", "warning");
            
            // Desabilita botões de login
            if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = true;
            if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = true;
            
            updateProfileMenuLoginState();
            updateConnectionIndicator('offline');
            
            // Carrega dados do cache offline
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

        // Prevent menu from closing when clicking inside
        userDropdownMenu.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            userDropdown.classList.remove('show');
        });

        // Logout button
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            userDropdown.classList.remove('show');
            logout();
        });
    }

    // Define o estado inicial do indicador de conexão
    updateConnectionIndicator(connectivityManager.getStatus());

    // Bloquear pull-to-refresh apenas no topo, mas permitir quando modais estão abertos
    document.body.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return;

        // Se algum modal está ativo, não bloquear (mais robusto que checar o target)
    const modalOpen = document.querySelector('.quick-settings-modal.active') || document.querySelector('.substitute-modal') || document.querySelector('.select-team-modal-container.modal-active') || document.querySelector('.confirmation-modal-overlay.active') || document.querySelector('.schedule-modal.active');
        if (modalOpen) return;

        // Se o toque começou dentro de um elemento que deve rolar (modais/listas/páginas de configuração), não bloquear
    if (e.target.closest('.substitute-modal-content') || e.target.closest('.substitute-players-list') || e.target.closest('.teams-page-layout-sub') || e.target.closest('.players-list-container') || e.target.closest('.quick-settings-content') || e.target.closest('.quick-settings-modal') || e.target.closest('.config-page-layout') || e.target.closest('.accordion-content') || e.target.closest('.accordion-content-sub') || e.target.closest('.settings-list') || e.target.closest('.accordion-content-sub-teams') || e.target.closest('.accordion-content-sub-full-width') || e.target.closest('#scheduling-page') || e.target.closest('.scheduling-container') || e.target.closest('.tab-content') || e.target.closest('.schedule-modal') || e.target.closest('.schedule-modal-content')) {
            return;
        }
        const startY = e.touches[0].clientY;
        if (startY <= 10 && window.scrollY === 0) {
            e.preventDefault();
        }
    }, { passive: false });

    document.body.addEventListener('touchmove', e => {
        // Se algum modal está ativo, permite o touchmove (permitir rolagem dentro do modal)
    const modalOpen = document.querySelector('.quick-settings-modal.active') || document.querySelector('.substitute-modal') || document.querySelector('.select-team-modal-container.modal-active') || document.querySelector('.confirmation-modal-overlay.active') || document.querySelector('.schedule-modal.active');
        if (modalOpen) return;

        // Permite scroll em elementos específicos:
        // - lista de jogadores / abas de categoria
        // - subárea da página de times (.teams-page-layout-sub)
        // - modal de substituição (conteúdo e lista de jogadores)
        // - página de configurações / acordeão e suas listas internas
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
            return; // permite o touchmove/scroll natural nesses elementos
        }
        e.preventDefault();
    }, { passive: false });

    loadAppVersion();
    registerServiceWorker();

    // Developer helper: visit the app with ?clearCache=1 to ask the service worker to clear caches and reload
    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('clearCache') === '1' && 'serviceWorker' in navigator) {
            if (navigator.serviceWorker.controller) {
                const messageChannel = new MessageChannel();
                messageChannel.port1.onmessage = (event) => {
                    if (event.data && event.data.success) {
                        // Log removido
                        window.location.reload(true);
                    } else {
                        // Log removido
                    }
                };
                navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' }, [messageChannel.port2]);
            } else {
                // no active controller; try unregistering and reloading as fallback
                navigator.serviceWorker.getRegistrations().then(regs => Promise.all(regs.map(r => r.unregister()))).then(() => window.location.reload(true));
            }
        }
    } catch (err) {
        // Log removido
    }
    
    // Inicializa sistema de lembretes diários
    initDailyReminders();
    
    // Configura salvamento automático de dados críticos
    setupAutoSave();

    if (Elements.sidebarOverlay()) {
        Elements.sidebarOverlay().addEventListener('click', () => {
            closeSidebar();
        });
    }
    
    // Tentar restaurar partida salva APÓS toda a configuração estar completa
    setTimeout(async () => {
        try {
            const restored = restoreSavedGameIfAny();
            if (restored) {
                // Log removido
            }
            await updateStartButtonText();
            // NOVO: Força atualização dos ícones
            forceUpdateIcons();
            
            // Inicializa botão PWA na tela de login
            if (window.pwaManager) {
                window.pwaManager.showLoginInstallButton();
            }
        } catch (e) {
            // Log removido
        }
    }, 100);
});

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
            // Log removido
            // Aqui você pode atualizar a UI com os jogadores em cache
        }
        
        // Carrega configurações do cache offline
        const cachedConfig = await offlineStorage.getConfig();
        if (cachedConfig && Object.keys(cachedConfig).length > 0) {
            // Log removido
            // Aplica configurações em cache
        }
        
        // Carrega histórico do cache offline
        const cachedHistory = await offlineStorage.getGameHistory();
        if (cachedHistory && cachedHistory.length > 0) {
            // Log removido
        }
        
    } catch (error) {
        // Log removido
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
            // Log removido
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
            // Log removido
        }
    });
}

// Função global para limpar cache (pode ser chamada das configurações)
window.clearOfflineCache = async () => {
    try {
        await offlineStorage.clearAll();
        
        // Limpa cache do service worker
        if (window.clearAppCache) {
            await window.clearAppCache();
        }
        
        displayMessage('Cache offline limpo com sucesso!', 'success');
        
        // Recarrega a página após limpar o cache
        setTimeout(() => {
            window.location.reload();
        }, 1000);
        
        return true;
    } catch (error) {
        // Log removido
        displayMessage('Erro ao limpar cache offline', 'error');
        return false;
    }
};

// Função para obter estatísticas de armazenamento
window.getStorageStats = async () => {
    try {
        const stats = await offlineStorage.getStorageStats();
        // Log removido
        return stats;
    } catch (error) {
        // Log removido
        return null;
    }
};
