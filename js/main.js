// js/main.js
// Ponto de entrada principal do seu aplicativo. Orquestra a inicialização e os módulos.

import { auth, initFirebaseApp } from './firebase/config.js';
import { loginWithGoogle, logout, setupAuthListener, signInAnonymouslyUser } from './firebase/auth.js';
import { loadPlayers, setupFirestorePlayersListener } from './data/players.js';
import { showPage, updatePlayerModificationAbility, setupSidebar, setupPageNavigation, setupAccordion, setupTeamSelectionModal, setupScoreInteractions } from './ui/pages.js';
import { setupConfigUI } from './ui/config-ui.js';
import { startGame, toggleTimer, swapTeams } from './game/logic.js'; // Removido generateTeams daqui
import { generateTeams } from './game/teams.js'; // Adicionado: Importa generateTeams de teams.js
import { loadAppVersion, registerServiceWorker } from './utils/app-info.js';
import { getPlayers } from './data/players.js';
import * as Elements from './ui/elements.js';
import { displayMessage } from './ui/messages.js'; // NOVO: Importa a função de exibição de mensagens

document.addEventListener('DOMContentLoaded', async () => {
    // Esconde todas as páginas inicialmente para garantir que apenas uma seja exibida
    Elements.pages.forEach(page => {
        page.classList.remove('app-page--active');
    });

    // CRÍTICO: Exibe a página de login imediatamente para evitar a "piscada"
    // Isso garante que o usuário sempre verá a tela de login como primeira coisa.
    showPage('login-page');

    // Inicializa o Firebase
    const { appId, firebaseConfig } = await initFirebaseApp();
    console.log("Firebase inicializado. App ID:", appId);

    // Atribui funções globalmente para facilitar o teste no console (opcional, mas útil para depuração)
    window.loginWithGoogle = loginWithGoogle;
    window.logout = logout;
    window.signInAnonymouslyUser = signInAnonymouslyUser; // Adicionado para depuração
    window.displayMessage = displayMessage; // Torna displayMessage acessível globalmente para depuração

    // Configura o observador de estado de autenticação.
    // Ele será responsável por exibir a página inicial correta após a autenticação.
    setupAuthListener(appId);

    // Configurações iniciais da UI
    setupSidebar();
    setupPageNavigation(startGame, getPlayers, logout);
    setupAccordion();
    setupTeamSelectionModal();
    setupScoreInteractions();
    setupConfigUI();

    // Configura o botão de login do Google
    if (Elements.googleLoginButton) {
        Elements.googleLoginButton.addEventListener('click', loginWithGoogle);
    }

    // Configura o botão de login anônimo
    const anonymousLoginButton = document.getElementById('anonymous-login-button');
    if (anonymousLoginButton) {
        anonymousLoginButton.addEventListener('click', signInAnonymouslyUser);
    }

    // Configura o botão de iniciar partida
    const startGameButton = document.getElementById('start-game-button');
    if (startGameButton) {
        startGameButton.addEventListener('click', () => startGame(appId));
    }

    // Configura o botão de gerar times
    const generateTeamsButton = document.getElementById('generate-teams-button');
    if (generateTeamsButton) {
        // CORREÇÃO: Chama generateTeams do módulo teams.js
        generateTeamsButton.addEventListener('click', () => generateTeams(appId));
    }

    // Configura o botão de trocar times
    const swapTeamsButton = document.getElementById('swap-teams-button');
    if (swapTeamsButton) {
        swapTeamsButton.addEventListener('click', swapTeams);
    }

    // Configura o botão de toggle do timer
    if (Elements.timerAndSetTimerWrapper) { // Usa o wrapper pai
        Elements.timerAndSetTimerWrapper.addEventListener('click', toggleTimer);
    }

    // Carrega a versão do aplicativo
    loadAppVersion();

    // Registra o Service Worker
    registerServiceWorker();
});
