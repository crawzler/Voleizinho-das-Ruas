// js/main.js
// Ponto de entrada principal do seu aplicativo. Orquestra a inicialização e os módulos.

import { initFirebaseApp, getAppId } from './firebase/config.js';
import { logout, setupAuthListener, signInAnonymouslyUser, updateProfileMenuLoginState, getCurrentUser, loginWithGoogle } from './firebase/auth.js'; // Imports updateProfileMenuLoginState
import { setupFirestorePlayersListener } from './data/players.js';
import * as SchedulesData from './data/schedules.js';
import { showPage, updatePlayerModificationAbility, setupSidebar, setupPageNavigation, setupAccordion, setupScoreInteractions, setupTeamSelectionModal, closeSidebar, showConfirmationModal, hideConfirmationModal } from './ui/pages.js';
import { setupConfigUI, loadConfig } from './ui/config-ui.js'; // Importa loadConfig
import { startGame, toggleTimer, swapTeams, endGame } from './game/logic.js';
import { generateTeams } from './game/teams.js';
import { loadAppVersion, registerServiceWorker } from './utils/app-info.js';
import { getPlayers } from './data/players.js';
import * as Elements from './ui/elements.js';
import { displayMessage } from './ui/messages.js';
import { updatePlayerCount, updateSelectAllToggle } from './ui/players-ui.js';
import { setupHistoryPage } from './ui/history-ui.js';
import { setupSchedulingPage } from './ui/scheduling-ui.js';

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
export function updateConnectionIndicator(status) {
    const indicator = Elements.connectionIndicator();
    const statusDot = Elements.statusDot();
    const statusText = Elements.statusText();

    if (!indicator || !statusDot || !statusText) {
        // console.warn("Elementos do indicador de conexão não encontrados."); // Removido console.warn excessivo
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
    if (loadingOverlay && !loadingOverlay.classList.contains('hidden')) { // Verifica se já não está oculto
        loadingOverlay.classList.add('hidden');
        if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            loadingTimeout = null;
        }
        // Log essencial removido
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Exibe a tela de carregamento imediatamente
    const loadingOverlay = Elements.loadingOverlay();
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden'); // Garante que a tela de carregamento esteja visível
    }
    console.log("[main.js] DOMContentLoaded. Exibindo tela de carregamento. navigator.onLine:", navigator.onLine);

    // Inicia o timer para forçar o modo offline após 10 segundos, se necessário
    loadingTimeout = setTimeout(() => {
        if (!authListenerInitialized) {
            // Log essencial removido
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
            // Log essencial removido
        } catch (error) {}
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

    // Listeners for team page buttons
    const generateTeamsButton = document.getElementById('generate-teams-button');
    // console.log("Element 'generate-teams-button':", generateTeamsButton); // Removido console.log excessivo
    if (generateTeamsButton) {
        generateTeamsButton.addEventListener('click', () => {
            console.log("Button 'Generate Teams' clicked.");
            generateTeams(appId);
        });
    }

    // Listener for start/stop game button (which now starts the game or toggles the timer)
    const toggleTimerButton = document.getElementById('toggle-timer-button');
    // console.log("Element 'toggle-timer-button':", toggleTimerButton); // Removido console.log excessivo
    if (toggleTimerButton) {
        toggleTimerButton.addEventListener('click', () => {
            console.log("Button 'Toggle Timer' clicked.");
            toggleTimer();
        });
    }

    // Listener for swap teams button
    const swapTeamsButton = document.getElementById('swap-teams-button');
    // console.log("Element 'swap-teams-button':", swapTeamsButton); // Removido console.log excessivo
    if (swapTeamsButton) {
        swapTeamsButton.addEventListener('click', () => {
            console.log("Button 'Swap Teams' clicked.");
            swapTeams();
        });
    }

    // Sets up the timer toggle button
    const timerAndSetTimerWrapperElement = Elements.timerAndSetTimerWrapper();
    // console.log("Element 'Elements.timerAndSetTimerWrapper()':", timerAndSetTimerWrapperElement); // Removido console.log excessivo
    if (timerAndSetTimerWrapperElement) {
        timerAndSetTimerWrapperElement.addEventListener('click', () => {
            console.log("Timer Wrapper clicked.");
            toggleTimer();
        });
    }

    // Sets up the end game button
    const endGameButton = document.getElementById('end-game-button');
    // console.log("Element 'end-game-button':", endGameButton); // Removido console.log excessivo
    if (endGameButton) {
        endGameButton.addEventListener('click', () => {
            console.log("Button 'End Game' clicked.");
            showConfirmationModal(
                'Are you sure you want to end the game? The score will be saved to history.',
                () => {
                    console.log("Game end confirmation.");
                    endGame();
                }
            );
        });
    }

    // FIXED: Adds event listeners for login buttons with correct HTML IDs
    const googleLoginButton = document.getElementById('google-login-button');
    // console.log("Element 'google-login-button':", googleLoginButton); // Removido console.log excessivo
    if (googleLoginButton) {
        googleLoginButton.addEventListener('click', () => {
            console.log("Button 'Sign in with Google' clicked.");
            loginWithGoogle();
        });
    }

    const anonymousLoginButton = document.getElementById('anonymous-login-button');
    // console.log("Element 'anonymous-login-button':", anonymousLoginButton); // Removido console.log excessivo
    if (anonymousLoginButton) {
        anonymousLoginButton.addEventListener('click', () => {
            console.log("Button 'Sign in anonymously' clicked.");
            signInAnonymouslyUser(appId);
        });
    }

    // NOVO: Listener para detectar quando o aplicativo volta a ficar online
    window.addEventListener('online', () => {
        // Log essencial removido
        displayMessage("Online novamente! Tentando reconectar...", "info");
        updateConnectionIndicator('reconnecting');
        setTimeout(() => {
            setupAuthListener(auth, db, appId);
            updateProfileMenuLoginState();
        }, 1500);
    });

    window.addEventListener('offline', () => {
        // Log essencial removido
        displayMessage("Você está offline.", "error");
        if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = true;
        if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = true;
        updateProfileMenuLoginState();
        updateConnectionIndicator('offline');
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

    // Define o estado inicial do indicador de conexão com base na configuração
    updateConnectionIndicator(navigator.onLine ? 'online' : 'offline');

    loadAppVersion();
    registerServiceWorker();

    if (Elements.sidebarOverlay()) {
        Elements.sidebarOverlay().addEventListener('click', () => {
            closeSidebar();
            // Log essencial removido
        });    }
});
