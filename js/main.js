// js/main.js
// Ponto de entrada principal do seu aplicativo. Orquestra a inicialização e os módulos.

import { initFirebaseApp, getAppId } from './firebase/config.js';
import { loginWithGoogle, logout, setupAuthListener, signInAnonymouslyUser, updateProfileMenuLoginState } from './firebase/auth.js'; // Imports updateProfileMenuLoginState
import { loadPlayersFromLocalStorage, setupFirestorePlayersListener, addPlayer, removePlayer } from './data/players.js';
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
            statusDot.classList.add('online');
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
        console.log("[main.js] Tela de carregamento oculta.");
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
            console.log("[main.js] Tempo limite de carregamento excedido. Forçando modo offline.");
            displayMessage("Não foi possível conectar. Modo offline ativado.", "info");
            showPage('start-page'); // Força a exibição da página inicial
            updateConnectionIndicator('offline'); // Força o indicador para offline (respeitará a config)
            hideLoadingOverlay();
        }
    }, 10000); // 10 segundos

    // Initializes the Firebase App and gets instances
    const { app, db, auth } = await initFirebaseApp();
    const appId = getAppId();

    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
            await signInWithCustomToken(auth, __initial_auth_token);
            console.log("User logged in with Canvas initial token.");
        } catch (error) {
            console.error("Error logging in with Canvas initial token:", error);
        }
    }

    // CARREGA JOGADORES DO LOCALSTORAGE ANTES DE CONFIGURAR O LISTENER DE AUTENTICAÇÃO
    loadPlayersFromLocalStorage();

    setupAuthListener(auth, db, appId);
    authListenerInitialized = true; // Marca que o listener de autenticação foi inicializado

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
        console.log("Application online again. Attempting to revalidate session...");
        displayMessage("Online novamente! Tentando reconectar...", "info");
        updateConnectionIndicator('reconnecting'); // Define estado "reconectando" imediatamente (respeitará a config)
        setTimeout(() => { // Pequeno delay antes de confirmar online para visual
            setupAuthListener(auth, db, appId); // Re-executa o listener para pegar o estado mais recente
            updateProfileMenuLoginState();
        }, 1500);
    });

    // NOVO: Listener para detectar quando o aplicativo fica offline
    window.addEventListener('offline', () => {
        console.log("Application offline.");
        displayMessage("Você está offline.", "error");
        if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = true;
        if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = true;
        updateProfileMenuLoginState();
        updateConnectionIndicator('offline'); // Define estado offline (respeitará a config)
    });

    // Define o estado inicial do indicador de conexão com base na configuração
    updateConnectionIndicator(navigator.onLine ? 'online' : 'offline');

    loadAppVersion();
    registerServiceWorker();

    if (Elements.sidebarOverlay()) {
        Elements.sidebarOverlay().addEventListener('click', () => {
            closeSidebar();
            console.log('Sidebar closed by clicking on overlay.');
        });
    }
});
