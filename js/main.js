// js/main.js
// Ponto de entrada principal do seu aplicativo. Orquestra a inicialização e os módulos.

import { auth, initFirebaseApp, getAppId } from './firebase/config.js'; // Importa getAppId
import { loginWithGoogle, logout, setupAuthListener, signInAnonymouslyUser } from './firebase/auth.js';
import { loadPlayers, setupFirestorePlayersListener, addPlayer, removePlayer } from './data/players.js'; // Importa addPlayer e removePlayer
import { showPage, updatePlayerModificationAbility, setupSidebar, setupPageNavigation, setupAccordion, setupScoreInteractions } from './ui/pages.js';
import { setupConfigUI } from './ui/config-ui.js';
import { startGame, toggleTimer, swapTeams, endGame } from './game/logic.js'; // Adicionado endGame
import { generateTeams } from './game/teams.js';
import { loadAppVersion, registerServiceWorker } from './utils/app-info.js';
import { getPlayers } from './data/players.js';
import * as Elements from './ui/elements.js';
import { displayMessage } from './ui/messages.js';
import { updatePlayerCount, updateSelectAllToggle } from './ui/players-ui.js'; // Importa as funções para a UI de jogadores

document.addEventListener('DOMContentLoaded', async () => {
    // Esconde todas as páginas inicialmente para garantir que apenas uma seja exibida
    Elements.pages.forEach(page => {
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
    setupSidebar();
    // Passa o appId para setupPageNavigation, pois é necessário para addPlayer/removePlayer
    setupPageNavigation(startGame, getPlayers, appId); // Passa startGame e getPlayers como handlers
    setupAccordion();
    setupConfigUI();
    setupScoreInteractions();
    // REMOVIDO: setupTeamSelectionModal(); // Não é mais necessário, pois o modal foi removido

    // Removido: Configuração do botão de adicionar jogador (movido para pages.js/setupPageNavigation)
    // Removido: Configuração do toggle "Selecionar Todos" (movido para pages.js/setupPageNavigation)
    // Removido: Listeners para remover jogador e checkboxes (movido para pages.js/setupPageNavigation)

    // Configura o botão de login com Google
    if (Elements.googleLoginButton) {
        Elements.googleLoginButton.addEventListener('click', loginWithGoogle);
    }

    // Configura o botão de login anônimo
    const anonymousLoginButton = document.getElementById('anonymous-login-button');
    if (anonymousLoginButton) {
        anonymousLoginButton.addEventListener('click', () => signInAnonymouslyUser(appId)); // Passa appId
    }

    // Configura o botão de iniciar partida
    const startGameButton = document.getElementById('start-game-button');
    if (startGameButton) {
        startGameButton.addEventListener('click', () => startGame(appId));
    }

    // Configura o botão de gerar times
    const generateTeamsButton = document.getElementById('generate-teams-button');
    if (generateTeamsButton) {
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

    // Configura o botão de encerrar jogo
    const endGameButton = document.getElementById('end-game-button');
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
});
