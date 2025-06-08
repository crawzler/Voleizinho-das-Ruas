// js/main.js
// Main entry point of your application. Orchestrates initialization and modules.

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

document.addEventListener('DOMContentLoaded', async () => {
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

    setupAuthListener(auth, db, appId);

    loadPlayersFromLocalStorage();

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
        displayMessage("Online again! Attempting to reconnect...", "info");
        // Forces a re-evaluation of Firebase authentication state.
        // onAuthStateChanged (configured in auth.js) will be triggered and will try
        // to renew the session or log the user in if possible.
        setupAuthListener(auth, db, appId); 
        updateProfileMenuLoginState(); // UPDATED: Ensures the logout button is enabled
    });

    // NEW: Listener to detect when the application goes offline
    window.addEventListener('offline', () => {
        console.log("Application offline.");
        displayMessage("You are offline.", "error");
        // Disables login buttons and the logout button
        if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = true;
        if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = true;
        updateProfileMenuLoginState(); // UPDATED: Ensures the logout button is disabled
    });


    loadAppVersion();
    registerServiceWorker();

    if (Elements.sidebarOverlay()) {
        Elements.sidebarOverlay().addEventListener('click', () => {
            closeSidebar();
            console.log('Sidebar closed by clicking on overlay.');
        });
    }
});
