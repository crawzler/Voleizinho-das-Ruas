// js/ui/pages.js
// Gerencia a exibição de páginas e a navegação principal.

import * as Elements from './elements.js';
import { getIsGameInProgress, resetGameForNewMatch, getCurrentTeam1, getCurrentTeam2, getActiveTeam1Name, getActiveTeam2Name, getActiveTeam1Color, getActiveTeam2Color, incrementScore, decrementScore } from '../game/logic.js';
import { updateScoreDisplay, updateTimerDisplay, updateSetTimerDisplay, renderScoringPagePlayers, updateTeamDisplayNamesAndColors, updateNavScoringButton, renderTeams } from './game-ui.js';
import { loadConfig, saveConfig } from './config-ui.js';
import { renderPlayersList, updatePlayerCount, updateSelectAllToggle } from './players-ui.js';
import { getCurrentUser } from '../firebase/auth.js';
import { addPlayer, removePlayer } from '../data/players.js';
import { openTeamSelectionModal, closeTeamSelectionModal, selectTeamForPanel } from '../game/teams.js';
import { displayMessage } from './messages.js'; // Importa a função de exibição de mensagens

let selectingTeamPanelId = null;
let touchStartY = 0; // Declaração única da variável touchStartY
const DRAG_THRESHOLD = 30; // Limite para diferenciar toque de deslize
let hasGameBeenStartedExplicitly = false; // Controla se o jogo foi iniciado via botão "Começar Jogo"
let currentPageId = 'login-page'; // Variável para rastrear a página atualmente ativa

/**
 * Define o estado se o jogo foi iniciado explicitamente.
 * @param {boolean} status - True se o jogo foi iniciado explicitamente, false caso contrário.
 */
export function setGameStartedExplicitly(status) {
    hasGameBeenStartedExplicitly = status;
    console.log(`[setGameStartedExplicitly] hasGameBeenStartedExplicitly set to: ${hasGameBeenStartedExplicitly}`);
}

/**
 * Retorna o ID da página atualmente ativa.
 * @returns {string} O ID da página ativa.
 */
export function getCurrentPageId() {
    return currentPageId;
}

/**
 * Fecha o sidebar.
 */
function closeSidebar() {
    Elements.sidebar.classList.remove('active');
}

/**
 * Exibe uma página específica e esconde as outras, com lógica para sobreposição da start-page.
 * @param {string} pageIdToShow - O ID da página a ser exibida.
 */
export function showPage(pageIdToShow) {
    console.log(`[showPage] Tentando exibir a página: ${pageIdToShow}`);

    // Lógica de redirecionamento para a página inicial se tentar ir para o placar sem iniciar o jogo
    if (pageIdToShow === 'scoring-page' && !hasGameBeenStartedExplicitly) {
        console.warn('[showPage] Tentativa de acessar a página de pontuação sem iniciar o jogo. Redirecionando para a página inicial.');
        pageIdToShow = 'start-page'; // Redireciona para a página inicial
    }

    // Primeiro, desativa todas as páginas
    Elements.pages.forEach(page => {
        page.classList.remove('app-page--active');
    });

    // Ativa a página alvo
    const targetPage = document.getElementById(pageIdToShow);
    if (targetPage) {
        targetPage.classList.add('app-page--active');
        currentPageId = pageIdToShow; // Atualiza a página ativa
    }

    // Lógica especial: Se a 'start-page' está sendo mostrada,
    // a 'scoring-page' também deve estar ativa por baixo.
    // A ordem de z-index no CSS garante a sobreposição correta.
    if (pageIdToShow === 'start-page') {
        Elements.scoringPage.classList.add('app-page--active');
        // NOVO: Quando a start-page é exibida, garanta que os jogadores na scoring-page estejam ocultos.
        renderScoringPagePlayers([], []);
    }

    closeSidebar(); // Fecha a sidebar ao navegar
    // Passa o estado atual do jogo E o ID da página atual para updateNavScoringButton
    updateNavScoringButton(getIsGameInProgress(), currentPageId);
}


/**
 * Atualiza a capacidade de modificação de jogadores com base no tipo de usuário.
 * @param {boolean} canModify - True se o usuário pode modificar jogadores, false caso contrário.
 */
export function updatePlayerModificationAbility(canModify) {
    console.log(`[updatePlayerModificationAbility] canModify: ${canModify}`);

    const addPlayerSection = document.getElementById('players-page-layout-add');
    const removeButtons = document.querySelectorAll('#players-list-container .remove-button'); // Seleciona apenas botões dentro do container
    const selectAllToggle = document.getElementById('select-all-players-toggle');

    if (addPlayerSection) {
        addPlayerSection.style.display = canModify ? 'flex' : 'none';
        console.log(`[updatePlayerModificationAbility] addPlayerSection display: ${addPlayerSection.style.display}`);
    } else {
        console.warn('[updatePlayerModificationAbility] addPlayerSection não encontrado.');
    }

    removeButtons.forEach(button => {
        button.style.display = canModify ? 'block' : 'none';
        console.log(`[updatePlayerModificationAbility] removeButton (${button.dataset.playerId}) display: ${button.style.display}`);
    });
    if (removeButtons.length === 0) {
        console.log('[updatePlayerModificationAbility] Nenhum botão de remover encontrado no DOM.');
    }


    if (selectAllToggle) {
        const parentControls = selectAllToggle.closest('.player-list-controls');
        if (parentControls) {
            parentControls.style.display = canModify ? 'flex' : 'none';
            console.log(`[updatePlayerModificationAbility] selectAllToggle parentControls display: ${parentControls.style.display}`);
        } else {
            console.warn('[updatePlayerModificationAbility] Parent controls para selectAllToggle não encontrados.');
        }
    } else {
        console.warn('[updatePlayerModificationAbility] selectAllToggle não encontrado.');
    }
}


/**
 * Configura os event listeners para os botões da barra lateral.
 * @param {Function} startGameHandler - Função para iniciar o jogo.
 * @param {Function} getPlayersHandler - Função para obter os jogadores.
 * @param {Function} logoutHandler - Função para logout.
 */
export function setupSidebar(startGameHandler, getPlayersHandler, logoutHandler) {
    Elements.menuButton.addEventListener('click', () => {
        Elements.sidebar.classList.add('active');
    });

    Elements.closeSidebarButton.addEventListener('click', () => {
        Elements.sidebar.classList.remove('active');
    });

    Elements.sidebarNavItems.forEach(item => {
        item.addEventListener('click', () => {
            const pageId = item.id.replace('nav-', ''); // Obtém o ID da página a partir do ID do botão
            const targetPageId = pageId + '-page';

            if (targetPageId === 'scoring-page') {
                // Se o item clicado é o da página de pontuação (que pode ser "Novo Jogo")
                if (getIsGameInProgress() && getCurrentPageId() === 'scoring-page') {
                    // Cenário: Jogo está em andamento E o usuário está atualmente na página de pontuação.
                    // Isso significa que o botão no menu é "Novo Jogo" e o usuário quer resetar.
                    resetGameForNewMatch(); // Reseta o jogo
                    showPage('start-page'); // Vai para a tela inicial
                } else {
                    // Cenário: Jogo NÃO está em andamento, OU jogo ESTÁ em andamento mas o usuário está em outra página.
                    // Em ambos os casos, simplesmente navega para a página de pontuação.
                    // A função showPage já lida com o redirecionamento para a start-page se !hasGameBeenStartedExplicitly.
                    showPage(targetPageId);
                }
            } else {
                // Para qualquer outro item de navegação, simplesmente mostra a página.
                showPage(targetPageId);
            }
            Elements.sidebar.classList.remove('active'); // Fecha a sidebar
        });
    });

    // Listener para o botão de logout
    if (Elements.navLogoutButton) {
        Elements.navLogoutButton.addEventListener('click', logoutHandler);
    }
}


/**
 * Configura a navegação entre as páginas.
 * @param {Function} startGameHandler - Função para iniciar o jogo.
 * @param {Function} getPlayersHandler - Função para obter os jogadores.
 */
export function setupPageNavigation(startGameHandler, getPlayersHandler) {
    // Listener para o botão "Começar Jogo" na tela inicial
    const startGameButton = document.getElementById('start-game-button');
    if (startGameButton) {
        startGameButton.addEventListener('click', () => {
            if (getIsGameInProgress()) {
                console.log("Jogo já está em andamento. Redirecionando para placar.");
                showPage('scoring-page');
            } else {
                console.log("Iniciando novo jogo.");
                startGameHandler(); // Chama a função startGame de logic.js
                // showPage('scoring-page'); // showPage já é chamado dentro de startGame
            }
        });
    }

    // Listener para o botão "Adicionar Jogador" na players-page
    const addPlayerButton = document.getElementById('add-player-button');
    if (addPlayerButton) {
        addPlayerButton.addEventListener('click', async () => {
            // Usa Elements.newPlayerNameInput que é importado de elements.js
            const playerNameInput = Elements.newPlayerNameInput;
            const playerName = playerNameInput ? playerNameInput.value.trim() : ''; // Acesso seguro
            
            if (playerName) {
                const currentUser = getCurrentUser();
                await addPlayer(playerName, currentUser ? currentUser.uid : null); // O userId é usado internamente em players.js para decidir se salva no Firestore
                if (playerNameInput) {
                    playerNameInput.value = ''; // Limpa o input se ele existe
                }
            } else {
                console.warn("O nome do jogador não pode estar vazio.");
            }
        });
    }

    // Listener para o toggle 'Selecionar Todos'
    if (Elements.selectAllPlayersToggle) {
        Elements.selectAllPlayersToggle.addEventListener('change', (event) => {
            const isChecked = event.target.checked;
            const checkboxes = document.querySelectorAll('#players-list-container .player-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = isChecked;
            });
            updatePlayerCount();
        });
    }

    // Adiciona listener de evento de clique delegado para os botões de remover jogadores
    if (Elements.playersListContainer) {
        Elements.playersListContainer.addEventListener('click', async (event) => {
            if (event.target.closest('.remove-button')) {
                const button = event.target.closest('.remove-button');
                const playerIdToRemove = button.dataset.playerId;
                if (playerIdToRemove) {
                    const currentUser = getCurrentUser();
                    await removePlayer(playerIdToRemove, currentUser ? currentUser.uid : null); // O userId é usado internamente em players.js para decidir se remove do Firestore
                }
            }
        });
    }

    // Carrega e aplica as configurações ao iniciar
    loadConfig();
}


/**
 * Configura os accordions na página de configurações.
 */
export function setupAccordion() {
    Elements.accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const accordionItem = header.parentElement;
            accordionItem.classList.toggle('active');
            const content = header.nextElementSibling;
            if (accordionItem.classList.contains('active')) {
                content.style.maxHeight = content.scrollHeight + 'px';
            } else {
                content.style.maxHeight = null;
            }
        });
    });
}


/**
 * Configura o modal de seleção de time.
 */
export function setupTeamSelectionModal() {
    // Fechar modal
    if (Elements.closeModalButton) {
        Elements.closeModalButton.addEventListener('click', closeTeamSelectionModal);
    }
    // Seleção de time no modal (listener delegado para a lista)
    if (Elements.modalTeamList) {
        Elements.modalTeamList.addEventListener('click', (event) => {
            const teamItem = event.target.closest('.team-list-item');
            if (teamItem) {
                const teamIndex = parseInt(teamItem.dataset.teamIndex);
                if (!isNaN(teamIndex)) {
                    selectTeamForPanel(selectingTeamPanelId, teamIndex);
                }
            }
        });
    }
}

/**
 * Função para configurar as interações de clique e arrastar na página de pontuação.
 */
export function setupScoreInteractions() {
    // Adiciona listeners para os painéis de pontuação
    if (Elements.team1Panel) {
        Elements.team1Panel.addEventListener('touchstart', (event) => handleScoreTouch(event, 'team1'));
        Elements.team1Panel.addEventListener('touchend', (event) => handleScoreTouch(event, 'team1'));
        Elements.team1Panel.addEventListener('click', (event) => handleScoreClick(event, 'team1'));
    }
    if (Elements.team2Panel) {
        Elements.team2Panel.addEventListener('touchstart', (event) => handleScoreTouch(event, 'team2'));
        Elements.team2Panel.addEventListener('touchend', (event) => handleScoreTouch(event, 'team2'));
        Elements.team2Panel.addEventListener('click', (event) => handleScoreClick(event, 'team2'));
    }
}

function handleScoreTouch(event, teamId) {
    if (event.type === 'touchstart') {
        touchStartY = event.touches[0].clientY; // Atribuição, não declaração
        event.preventDefault(); // Evita rolagem da página ao arrastar no painel
        return;
    }

    if (event.type === 'touchend') {
        const touchEndY = event.changedTouches[0].clientY;
        const deltaY = touchEndY - touchStartY;

        if (Math.abs(deltaY) > DRAG_THRESHOLD) {
            // É um deslize (drag)
            if (deltaY > 0) { // Deslize para baixo
                decrementScore(teamId);
            } else { // Deslize para cima
                incrementScore(teamId);
            }
        } else {
            // É um toque (tap) - Incrementa imediatamente, removendo o delay e a lógica de double-tap
            incrementScore(teamId);
        }
    }
}

function handleScoreClick(event, teamId) {
    // Para cliques normais (mouse), apenas incrementa.
    // A lógica de toque já cobre incrementos e decrementos para mobile.
    incrementScore(teamId);
}
