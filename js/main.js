// js/main.js
// Ponto de entrada principal do seu aplicativo. Orquestra a inicialização e os módulos.

import { auth, initFirebaseApp } from './firebase/config.js';
import { loginWithGoogle, logout, setupAuthListener } from './firebase/auth.js';
import { loadPlayers, setupFirestorePlayersListener } from './data/players.js';
import { showPage, updatePlayerModificationAbility, setupSidebar, setupPageNavigation, setupAccordion, setupTeamSelectionModal, setupScoreInteractions } from './ui/pages.js';
import { setupConfigUI } from './ui/config-ui.js';
import { startGame, toggleTimer, swapTeams, generateTeams } from './game/logic.js';
import { loadAppVersion, registerServiceWorker } from './utils/app-info.js';
import { getPlayers } from './data/players.js'; // Importa a função para obter a lista de jogadores
import * as Elements from './ui/elements.js'; // Importa todos os elementos

document.addEventListener('DOMContentLoaded', async () => {
    // Esconde todas as páginas inicialmente para garantir que apenas uma seja exibida
    Elements.pages.forEach(page => {
        page.classList.remove('app-page--active');
    });

    // Inicializa o Firebase
    const { appId, firebaseConfig } = await initFirebaseApp();
    console.log("Firebase inicializado. App ID:", appId);

    // Atribui funções globalmente para facilitar o teste no console (opcional, mas útil para depuração)
    window.loginWithGoogle = loginWithGoogle;
    window.logout = logout;

    // Configura o observador de estado de autenticação.
    // Ele será responsável por exibir a página inicial correta após a autenticação.
    setupAuthListener(appId); // Passa appId para players.js

    // Configurações iniciais da UI
    setupSidebar();
    setupPageNavigation(startGame, getPlayers, logout); // Passa startGame, getPlayers e logout para o handler de navegação
    setupAccordion();
    setupTeamSelectionModal();
    setupScoreInteractions();
    setupConfigUI(); // Chamada da função de setup de configurações

    // Configura o botão de login do Google
    if (Elements.googleLoginButton) {
        Elements.googleLoginButton.addEventListener('click', loginWithGoogle);
    }

    // Configura o botão de iniciar partida
    const startGameButton = document.getElementById('start-game-button');
    if (startGameButton) {
        startGameButton.addEventListener('click', () => startGame(appId)); // Passa appId para startGame
    }

    // Configura o botão de gerar times
    const generateTeamsButton = document.getElementById('generate-teams-button');
    if (generateTeamsButton) {
        generateTeamsButton.addEventListener('click', () => generateTeams(appId)); // Passa appId para generateTeams
    }

    // Configura o botão de trocar times
    const swapTeamsButton = document.getElementById('swap-teams-button');
    if (swapTeamsButton) {
        swapTeamsButton.addEventListener('click', swapTeams);
    }

    // Configura o botão de toggle do timer
    const timerWrapper = document.querySelector('.timer-wrapper');
    if (timerWrapper) {
        timerWrapper.addEventListener('click', toggleTimer);
    }

    // Carrega a versão do aplicativo
    loadAppVersion();

    // Registra o Service Worker
    registerServiceWorker();
});
