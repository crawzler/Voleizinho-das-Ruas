// js/main.js
// Ponto de entrada principal do seu aplicativo. Orquestra a inicialização e os módulos.

import { auth, initFirebaseApp, getAppId } from './firebase/config.js'; // Importa getAppId
import { loginWithGoogle, logout, setupAuthListener, signInAnonymouslyUser } from './firebase/auth.js';
import { loadPlayers, setupFirestorePlayersListener, addPlayer, removePlayer } from './data/players.js'; // Importa addPlayer e removePlayer
import { showPage, updatePlayerModificationAbility, setupSidebar, setupPageNavigation, setupAccordion, setupScoreInteractions, setupTeamSelectionModal, closeSidebar } from './ui/pages.js'; // Importa setupTeamSelectionModal e closeSidebar
import { setupConfigUI } from './ui/config-ui.js';
import { startGame, toggleTimer, swapTeams, endGame } from './game/logic.js'; // Adicionado endGame
import { generateTeams } from './game/teams.js';
import { loadAppVersion, registerServiceWorker } from './utils/app-info.js';
import { getPlayers } from './data/players.js';
import * as Elements from './ui/elements.js';
import { displayMessage } from './ui/messages.js';
import { updatePlayerCount, updateSelectAllToggle } from './ui/players-ui.js'; // Importa as funções para a UI de jogadores

document.addEventListener('DOMContentLoaded', async () => {

    
    // NOVO: Desativa o pull-to-refresh para mobile
    let lastTouchY = 0;
    window.addEventListener('touchstart', (e) => {
        lastTouchY = e.touches[0].clientY;
    });

    window.addEventListener('touchmove', (e) => {
        const currentTouchY = e.touches[0].clientY;
        // Se a tela está no topo (scrollY === 0) e o usuário está arrastando para baixo
        if (window.scrollY === 0 && currentTouchY > lastTouchY) {
            e.preventDefault();
        }
    }, { passive: false }); // 'passive: false' é crucial para que preventDefault funcione

    
    
    // Esconde todas as páginas inicialmente para garantir que apenas uma seja exibida
    Elements.pages().forEach(page => { // Chamada da função Elements.pages()
        page.classList.remove('app-page--active');
    });

    // CRÍTICO: Exibe a página de login imediatamente para evitar a "piscada" de conteúdo
    showPage('login-page');

    // Inicializa o Firebase e obtém o appId
    await initFirebaseApp();
    const appId = getAppId();
    console.log("App ID obtido em main.js:", appId);

    // Configura o listener de autenticação do Firebase
    setupAuthListener(appId);

    // Carrega os jogadores do localStorage e/ou Firestore
    loadPlayers(appId);

    // Configura os event listeners da UI
    // Passa a função logout para setupSidebar
    setupSidebar(startGame, getPlayers, logout);
    // Passa o appId para setupPageNavigation, pois é necessário para addPlayer/removePlayer
    setupPageNavigation(startGame, getPlayers, appId); // Passa startGame e getPlayers como handlers
    setupAccordion();
    setupConfigUI();
    setupScoreInteractions();
    setupTeamSelectionModal(); // Configura o modal de seleção de time


    // Configura o botão de login com Google
    if (Elements.googleLoginButton()) { // Chamada da função Elements.googleLoginButton()
        Elements.googleLoginButton().addEventListener('click', loginWithGoogle);
    }

    // Configura o botão de login anônimo
    const anonymousLoginButton = Elements.anonymousLoginButton(); // Chamada da função Elements.anonymousLoginButton()
    if (anonymousLoginButton) {
        anonymousLoginButton.addEventListener('click', () => signInAnonymouslyUser(appId)); // Passa appId
    }

    // Configura o botão de iniciar partida
    const startGameButton = document.getElementById('start-game-button'); // Este não é do elements.js
    if (startGameButton) {
        startGameButton.addEventListener('click', () => startGame(appId));
    }

    // Configura o botão de gerar times
    const generateTeamsButton = Elements.generateTeamsButton(); // Chamada da função Elements.generateTeamsButton()
    if (generateTeamsButton) {
        generateTeamsButton.addEventListener('click', () => generateTeams(appId));
    }

    // Configura o botão de trocar times
    const swapTeamsButton = document.getElementById('swap-teams-button'); // Este não é do elements.js
    if (swapTeamsButton) {
        swapTeamsButton.addEventListener('click', swapTeams);
    }

    // Configura o botão de toggle do timer
    if (Elements.timerAndSetTimerWrapper()) { // Chamada da função Elements.timerAndSetTimerWrapper()
        Elements.timerAndSetTimerWrapper().addEventListener('click', toggleTimer);
    }

    // Configura o botão de encerrar jogo
    const endGameButton = document.getElementById('end-game-button'); // Este não é do elements.js
    if (endGameButton) {
        endGameButton.addEventListener('click', () => {
            // Substituído window.confirm por displayMessage para consistência
            displayMessage("Tem certeza que deseja encerrar o jogo? (Esta mensagem é apenas um placeholder, implemente um modal de confirmação real)", "info", 5000);
            endGame(); // Chama a função endGame
        });
    }

    // Carrega a versão do aplicativo
    loadAppVersion();

    // Registra o Service Worker
    registerServiceWorker();

    // NOVO: Adiciona um listener de clique ao overlay para fechar o sidebar
    if (Elements.sidebarOverlay()) {
        Elements.sidebarOverlay().addEventListener('click', () => {
            closeSidebar();
            console.log('Sidebar fechado por clique no overlay.');
        });
    }
    // REMOVIDO: O listener de clique global no document.body
});
