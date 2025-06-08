// js/main.js
// Ponto de entrada principal do seu aplicativo. Orquestra a inicialização e os módulos.

import { initFirebaseApp, getAppId } from './firebase/config.js';
import { loginWithGoogle, logout, setupAuthListener, signInAnonymouslyUser, updateProfileMenuLoginState } from './firebase/auth.js'; // Imports updateProfileMenuLoginState
import { loadPlayersFromLocalStorage, setupFirestorePlayersListener, addPlayer, removePlayer } from './data/players.js';
import { showPage, updatePlayerModificationAbility, setupSidebar, setupPageNavigation, setupAccordion, setupScoreInteractions, setupTeamSelectionModal, closeSidebar, showConfirmationModal, hideConfirmationModal } from './ui/pages.js';
import { setupConfigUI } from './ui/config-ui.js';
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
 * Updates the connection indicator in the UI.
 * @param {'online' | 'offline' | 'reconnecting'} status - The connection status.
 */
export function updateConnectionIndicator(status) { // NOVO: Exporta a função
    const statusDot = Elements.statusDot();
    const statusText = Elements.statusText();

    if (statusDot && statusText) {
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
}

/**
 * Hides the loading overlay.
 */
export function hideLoadingOverlay() { // NOVO: Função para esconder o overlay
    const loadingOverlay = Elements.loadingOverlay();
    if (loadingOverlay) {
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
    console.log("[main.js] DOMContentLoaded. Exibindo tela de carregamento. navigator.onLine:", navigator.onLine);

    // Inicia o timer para forçar o modo offline após 10 segundos, se necessário
    loadingTimeout = setTimeout(() => {
        if (!authListenerInitialized) {
            console.log("[main.js] Tempo limite de carregamento excedido. Forçando modo offline.");
            displayMessage("Não foi possível conectar. Modo offline ativado.", "info");
            showPage('start-page'); // Força a exibição da página inicial
            updateConnectionIndicator(navigator.onLine ? 'online' : 'offline'); // Garante que o indicador seja atualizado
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
    setupSchedulingPage();

    // Listeners for team page buttons
    const generateTeamsButton = document.getElementById('generate-teams-button');
    console.log("Element 'generate-teams-button':", generateTeamsButton); // DEBUG LOG
    if (generateTeamsButton) {
        generateTeamsButton.addEventListener('click', () => {
            console.log("Button 'Generate Teams' clicked."); // DEBUG LOG
            generateTeams(appId);
        });
    }

    // Listener for start/stop game button (which now starts the game or toggles the timer)
    const toggleTimerButton = document.getElementById('toggle-timer-button');
    console.log("Element 'toggle-timer-button':", toggleTimerButton); // DEBUG LOG
    if (toggleTimerButton) {
        toggleTimerButton.addEventListener('click', () => {
            console.log("Button 'Toggle Timer' clicked."); // DEBUG LOG
            toggleTimer();
        });
    }

    // Listener for swap teams button
    const swapTeamsButton = document.getElementById('swap-teams-button');
    console.log("Element 'swap-teams-button':", swapTeamsButton); // DEBUG LOG
    if (swapTeamsButton) {
        swapTeamsButton.addEventListener('click', () => {
            console.log("Button 'Swap Teams' clicked."); // DEBUG LOG
            swapTeams();
        });
    }

    // Sets up the timer toggle button
    const timerAndSetTimerWrapperElement = Elements.timerAndSetTimerWrapper();
    console.log("Element 'Elements.timerAndSetTimerWrapper()':", timerAndSetTimerWrapperElement); // DEBUG LOG
    if (timerAndSetTimerWrapperElement) {
        timerAndSetTimerWrapperElement.addEventListener('click', () => {
            console.log("Timer Wrapper clicked."); // DEBUG LOG
            toggleTimer();
        });
    }

    // Sets up the end game button
    const endGameButton = document.getElementById('end-game-button');
    console.log("Element 'end-game-button':", endGameButton); // DEBUG LOG
    if (endGameButton) {
        endGameButton.addEventListener('click', () => {
            console.log("Button 'End Game' clicked."); // DEBUG LOG
            showConfirmationModal(
                'Are you sure you want to end the game? The score will be saved to history.',
                () => {
                    console.log("Game end confirmation."); // DEBUG LOG
                    endGame();
                }
            );
        });
    }

    // FIXED: Adds event listeners for login buttons with correct HTML IDs
    const googleLoginButton = document.getElementById('google-login-button'); // Corrected ID
    console.log("Element 'google-login-button':", googleLoginButton);
    if (googleLoginButton) {
        googleLoginButton.addEventListener('click', () => {
            console.log("Button 'Sign in with Google' clicked.");
            loginWithGoogle();
        });
    }

    const anonymousLoginButton = document.getElementById('anonymous-login-button'); // Corrected ID
    console.log("Element 'anonymous-login-button':", anonymousLoginButton);
    if (anonymousLoginButton) {
        anonymousLoginButton.addEventListener('click', () => {
            console.log("Button 'Sign in anonymously' clicked.");
            signInAnonymouslyUser(appId); // Passes appId to the function
        });
    }

    // NEW: Listener to detect when the application goes online again
    window.addEventListener('online', () => {
        console.log("Application online again. Attempting to revalidate session...");
        displayMessage("Online novamente! Tentando reconectar...", "info");
        // updateConnectionIndicator('reconnecting'); // REMOVIDO: auth.js agora gerencia
        setTimeout(() => {
            setupAuthListener(auth, db, appId); 
            updateProfileMenuLoginState();
            // updateConnectionIndicator('online'); // REMOVIDO: auth.js agora gerencia
        }, 1500);
    });

    // NEW: Listener to detect when the application goes offline
    window.addEventListener('offline', () => {
        console.log("Application offline.");
        displayMessage("Você está offline.", "error");
        // Disables login buttons and the logout button
        if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = true;
        if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = true;
        updateProfileMenuLoginState(); // UPDATED: Ensures the logout is disabled
        // updateConnectionIndicator('offline'); // REMOVIDO: auth.js agora gerencia
    });

    // Defines the initial state of the connection indicator
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
