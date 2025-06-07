// js/main.js
// Ponto de entrada principal do seu aplicativo. Orquestra a inicialização e os módulos.

import { initFirebaseApp, getAppId } from './firebase/config.js';
import { loginWithGoogle, logout, setupAuthListener, signInAnonymouslyUser } from './firebase/auth.js';
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
    // Inicializa o Firebase App e obtém as instâncias
    const { app, db, auth } = await initFirebaseApp();
    const appId = getAppId();

    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
            await signInWithCustomToken(auth, __initial_auth_token);
            console.log("Usuário logado com token inicial do Canvas.");
        } catch (error) {
            console.error("Erro ao logar com token inicial do Canvas:", error);
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

    // Listeners para os botões da página de times
    const generateTeamsButton = document.getElementById('generate-teams-button');
    console.log("Elemento 'generate-teams-button':", generateTeamsButton); // LOG DE DEPURACAO
    if (generateTeamsButton) {
        generateTeamsButton.addEventListener('click', () => {
            console.log("Botão 'Gerar Times' clicado."); // LOG DE DEPURACAO
            generateTeams(appId);
        });
    }

    // Listener para o botão de iniciar/parar o jogo (que agora inicia o jogo ou alterna o timer)
    const toggleTimerButton = document.getElementById('toggle-timer-button');
    console.log("Elemento 'toggle-timer-button':", toggleTimerButton); // LOG DE DEPURACAO
    if (toggleTimerButton) {
        toggleTimerButton.addEventListener('click', () => {
            console.log("Botão 'Alternar Timer' clicado."); // LOG DE DEPURACAO
            toggleTimer();
        });
    }

    // Listener para o botão de trocar times
    const swapTeamsButton = document.getElementById('swap-teams-button');
    console.log("Elemento 'swap-teams-button':", swapTeamsButton); // LOG DE DEPURACAO
    if (swapTeamsButton) {
        swapTeamsButton.addEventListener('click', () => {
            console.log("Botão 'Trocar Times' clicado."); // LOG DE DEPURACAO
            swapTeams();
        });
    }

    // Configura o botão de toggle do timer
    const timerAndSetTimerWrapperElement = Elements.timerAndSetTimerWrapper();
    console.log("Elemento 'Elements.timerAndSetTimerWrapper()':", timerAndSetTimerWrapperElement); // LOG DE DEPURACAO
    if (timerAndSetTimerWrapperElement) {
        timerAndSetTimerWrapperElement.addEventListener('click', () => {
            console.log("Wrapper do Timer clicado."); // LOG DE DEPURACAO
            toggleTimer();
        });
    }

    // Configura o botão de encerrar jogo
    const endGameButton = document.getElementById('end-game-button');
    console.log("Elemento 'end-game-button':", endGameButton); // LOG DE DEPURACAO
    if (endGameButton) {
        endGameButton.addEventListener('click', () => {
            console.log("Botão 'Encerrar Jogo' clicado."); // LOG DE DEPURACAO
            showConfirmationModal(
                'Tem certeza que deseja encerrar o jogo? O placar será salvo no histórico.',
                () => {
                    console.log("Confirmação de encerramento de jogo."); // LOG DE DEPURACAO
                    endGame();
                }
            );
        });
    }

    // CORRIGIDO: Adiciona event listeners para os botões de login com os IDs corretos do HTML
    const googleLoginButton = document.getElementById('google-login-button'); // ID corrigido
    console.log("Elemento 'google-login-button':", googleLoginButton);
    if (googleLoginButton) {
        googleLoginButton.addEventListener('click', () => {
            console.log("Botão 'Entrar com Google' clicado.");
            loginWithGoogle();
        });
    }

    const anonymousLoginButton = document.getElementById('anonymous-login-button'); // ID corrigido
    console.log("Elemento 'anonymous-login-button':", anonymousLoginButton);
    if (anonymousLoginButton) {
        anonymousLoginButton.addEventListener('click', () => {
            console.log("Botão 'Entrar como Anônimo' clicado.");
            signInAnonymouslyUser(appId); // Passa o appId para a função
        });
    }


    loadAppVersion();
    registerServiceWorker();

    if (Elements.sidebarOverlay()) {
        Elements.sidebarOverlay().addEventListener('click', () => {
            closeSidebar();
            console.log('Sidebar fechado por clique no overlay.');
        });
    }
});
