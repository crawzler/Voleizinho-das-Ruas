// js/ui/pages.js
// Gerencia a exibição de páginas e a navegação principal.

import * as Elements from './elements.js';
import { getIsGameInProgress, resetGameForNewMatch, getCurrentTeam1, getCurrentTeam2, getActiveTeam1Name, getActiveTeam2Name, getActiveTeam1Color, getActiveTeam2Color, incrementScore, decrementScore, getAllGeneratedTeams, setCurrentTeam1, setCurrentTeam2, setActiveTeam1Name, setActiveTeam2Name, setActiveTeam1Color, setActiveTeam2Color, getTeam1Score, getTeam2Score } from '../game/logic.js';
import { updateScoreDisplay, updateTimerDisplay, updateSetTimerDisplay, renderScoringPagePlayers, updateTeamDisplayNamesAndColors, updateNavScoringButton, renderTeams, renderTeamsInModal } from './game-ui.js';
import { loadConfig, saveConfig } from './config-ui.js';
import { renderPlayersList, updatePlayerCount, updateSelectAllToggle } from './players-ui.js';
import { getCurrentUser, logout } from '../firebase/auth.js'; // Importa a função logout
import { addPlayer, removePlayer } from '../data/players.js';
import { displayMessage } from './messages.js';

let touchStartY = 0;
const DRAG_THRESHOLD = 30; // Limite de movimento para diferenciar clique de arrastar
let hasGameBeenStartedExplicitly = false;
let currentPageId = 'login-page';
let selectingTeamPanelId = null;


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
export function closeSidebar() { // Tornada export para ser acessível do main.js
    console.log('[closeSidebar] Chamado.'); // NOVO: Log para depuração
    const sidebar = Elements.sidebar();
    const profileMenu = Elements.profileMenu();
    const userProfileHeader = Elements.userProfileHeader();
    const sidebarOverlay = Elements.sidebarOverlay(); // NOVO: Referência ao overlay

    if (sidebar) {
        sidebar.classList.remove('active');
    }
    // Garante que o mini-menu do perfil seja fechado ao fechar o sidebar
    if (profileMenu && profileMenu.classList.contains('active')) {
        profileMenu.classList.remove('active');
        if (userProfileHeader) {
            userProfileHeader.classList.remove('active');
        }
    }
    // NOVO: Oculta o overlay
    if (sidebarOverlay) {
        sidebarOverlay.classList.remove('active');
    }
}

/**
 * Exibe uma página específica e esconde as outras, com lógica para sobreposição da start-page.
 * @param {string} pageIdToShow - O ID da página a ser exibida.
 */
export function showPage(pageIdToShow) {
    console.log(`[showPage] Tentando exibir a página: ${pageIdToShow}`);

    if (pageIdToShow === 'scoring-page' && !hasGameBeenStartedExplicitly) {
        console.warn('[showPage] Tentativa de acessar a página de pontuação sem iniciar o jogo. Redirecionando para a página inicial.');
        pageIdToShow = 'start-page';
    }

    Elements.pages().forEach(page => {
        page.classList.remove('app-page--active');
    });

    const targetPage = document.getElementById(pageIdToShow);
    if (targetPage) {
        targetPage.classList.add('app-page--active');
        currentPageId = pageIdToShow;
    }

    if (pageIdToShow === 'start-page') {
        Elements.scoringPage().classList.add('app-page--active');
        // Ao exibir a start-page, oculte os quadros de jogadores
        renderScoringPagePlayers([], [], false); // Certifica que os jogadores são ocultados
    }

    closeSidebar(); // Garante que o sidebar esteja fechado ao mudar de página
    updateNavScoringButton(getIsGameInProgress(), currentPageId);

    if (pageIdToShow === 'players-page') {
        const currentUser = getCurrentUser();
        updatePlayerModificationAbility(!!currentUser);
        updatePlayerCount();
        updateSelectAllToggle();
    } else if (pageIdToShow === 'teams-page') {
        renderTeams(getAllGeneratedTeams());
    } else if (pageIdToShow === 'config-page') {
        loadConfig();
    } else if (pageIdToShow === 'scoring-page') {
        updateScoreDisplay(getTeam1Score(), getTeam2Score());
        updateTeamDisplayNamesAndColors(getActiveTeam1Name(), getActiveTeam2Name(), getActiveTeam1Color(), getActiveTeam2Color());
        
        const config = loadConfig();
        const displayPlayers = config.displayPlayers ?? true;
        const currentTeam1Players = getCurrentTeam1();
        const currentTeam2Players = getCurrentTeam2();
        
        // Renderiza os jogadores se a configuração permitir E se houver jogadores nos times
        const shouldDisplayPlayers = displayPlayers && (currentTeam1Players.length > 0 || currentTeam2Players.length > 0);
        renderScoringPagePlayers(currentTeam1Players, currentTeam2Players, shouldDisplayPlayers);
    } else if (pageIdToShow === 'start-page') {
        resetGameForNewMatch();
        setGameStartedExplicitly(false);
    }
}


/**
 * Atualiza a capacidade de modificação de jogadores com base no tipo de usuário.
 * @param {boolean} canModify - True se o usuário pode modificar jogadores, false caso contrário.
 */
export function updatePlayerModificationAbility(canModify) {
    console.log(`[updatePlayerModificationAbility] canModify: ${canModify}`);

    const newPlayerNameInput = Elements.newPlayerNameInput();
    const addPlayerButton = Elements.addPlayerButton();
    const removeButtons = document.querySelectorAll('#players-list-container .remove-button');
    const selectAllToggle = Elements.selectAllPlayersToggle();

    if (newPlayerNameInput) newPlayerNameInput.disabled = !canModify;
    if (addPlayerButton) addPlayerButton.disabled = !canModify;
    if (selectAllToggle) selectAllToggle.disabled = !canModify;

    removeButtons.forEach(button => {
        button.disabled = !canModify;
        button.style.pointerEvents = canModify ? 'auto' : 'none';
        button.style.opacity = canModify ? '1' : '0.5';
    });

    if (!canModify && selectAllToggle) {
        selectAllToggle.checked = false;
        const checkboxes = document.querySelectorAll('#players-list-container .player-checkbox');
        checkboxes.forEach(cb => cb.checked = false);
        updatePlayerCount();
    }

    const addPlayerSection = document.getElementById('players-page-layout-add');
    if (addPlayerSection) {
        addPlayerSection.style.display = 'flex';
    }

    const playerListControls = document.querySelector('.player-list-controls');
    if (playerListControls) {
        playerListControls.style.display = 'flex';
    }
}


/**
 * Configura os event listeners para os botões da barra lateral e mini-menu.
 * @param {Function} startGameHandler - Função para iniciar o jogo.
 * @param {Function} getPlayersHandler - Função para obter os jogadores.
 * @param {Function} logoutHandler - Função para logout.
 */
export function setupSidebar(startGameHandler, getPlayersHandler, logoutHandler) {
    Elements.menuButton().addEventListener('click', (event) => {
        event.stopPropagation(); // Evita que o clique no botão de menu feche o sidebar imediatamente
        const sidebar = Elements.sidebar();
        const sidebarOverlay = Elements.sidebarOverlay(); // NOVO: Referência ao overlay

        if (sidebar) {
            sidebar.classList.add('active');
        }
        if (sidebarOverlay) { // NOVO: Mostra o overlay quando o sidebar é aberto
            sidebarOverlay.classList.add('active');
        }
    });

    // REMOVIDO: Listener para o botão de fechar (o X)
    // Elements.closeSidebarButton().addEventListener('click', () => {
    //     closeSidebar();
    // });

    Elements.sidebarNavItems().forEach(item => {
        item.addEventListener('click', () => {
            const pageId = item.id.replace('nav-', '');
            const targetPageId = pageId + '-page';

            if (targetPageId === 'scoring-page') {
                if (getIsGameInProgress() && getCurrentPageId() === 'scoring-page') {
                    resetGameForNewMatch();
                    showPage('start-page');
                } else {
                    showPage(targetPageId);
                }
            } else {
                showPage(targetPageId);
            }
            closeSidebar(); // Fecha o sidebar ao navegar para uma página
        });
    });

    // Listener para abrir/fechar o mini-menu do perfil
    if (Elements.userProfileHeader()) {
        Elements.userProfileHeader().addEventListener('click', (event) => {
            event.stopPropagation(); // Evita que o clique no header feche o sidebar imediatamente
            const profileMenu = Elements.profileMenu();
            const userProfileHeader = Elements.userProfileHeader();
            if (profileMenu && userProfileHeader) {
                profileMenu.classList.toggle('active');
                userProfileHeader.classList.toggle('active'); // Para rotacionar a seta
            }
        });
    }

    // Listener para o botão "Sair" dentro do mini-menu
    if (Elements.profileLogoutButton()) {
        Elements.profileLogoutButton().addEventListener('click', () => {
            logoutHandler(); // Usa o logoutHandler passado como parâmetro
            closeSidebar(); // Fecha o sidebar e o mini-menu
        });
    }

    // Listener para o botão "Configurações" dentro do mini-menu
    if (Elements.profileSettingsButton()) {
        Elements.profileSettingsButton().addEventListener('click', () => {
            showPage('config-page');
            closeSidebar(); // Fecha o sidebar e o mini-menu
        });
    }
}


/**
 * Configura a navegação entre as páginas e os listeners relacionados à gestão de jogadores.
 * @param {Function} startGameHandler - Função para iniciar o jogo.
 * @param {Function} getPlayersHandler - Função para obter os jogadores.
 * @param {string} appId - O ID do aplicativo, necessário para addPlayer/removePlayer.
 */
export function setupPageNavigation(startGameHandler, getPlayersHandler, appId) {
    const startGameButton = document.getElementById('start-game-button');
    if (startGameButton) {
        startGameButton.addEventListener('click', () => {
            if (getIsGameInProgress()) {
                console.log("Jogo já está em andamento. Redirecionando para placar.");
                showPage('scoring-page');
            } else {
                console.log("Iniciando novo jogo.");
                startGameHandler();
            }
        });
    }

    const addPlayerButton = Elements.addPlayerButton();
    if (addPlayerButton) {
        addPlayerButton.addEventListener('click', async () => {
            const playerNameInput = Elements.newPlayerNameInput();
            const playerName = playerNameInput ? playerNameInput.value.trim() : '';
            
            if (playerName) {
                const currentUser = getCurrentUser();
                await addPlayer(playerName, currentUser ? currentUser.uid : null, appId); 
                if (playerNameInput) {
                    playerNameInput.value = '';
                }
            } else {
                console.warn("O nome do jogador não pode estar vazio.");
            }
        });
    }

    if (Elements.selectAllPlayersToggle()) {
        Elements.selectAllPlayersToggle().addEventListener('change', (event) => {
            const isChecked = event.target.checked;
            const checkboxes = document.querySelectorAll('#players-list-container .player-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = isChecked;
            });
            updatePlayerCount();
            updateSelectAllToggle();
        });
    }

    if (Elements.playersListContainer()) {
        Elements.playersListContainer().addEventListener('click', async (event) => {
            if (event.target.closest('.remove-button')) {
                const button = event.target.closest('.remove-button');
                const playerIdToRemove = button.dataset.playerId;
                if (playerIdToRemove) {
                    const currentUser = getCurrentUser();
                    await removePlayer(playerIdToRemove, currentUser ? currentUser.uid : null, appId); 
                }
            }
        });

        if (Elements.playersListContainer()) {
            Elements.playersListContainer().addEventListener('change', (event) => {
                if (event.target.classList.contains('player-checkbox')) {
                    updatePlayerCount();
                    updateSelectAllToggle();
                }
            });
        }
    }

    loadConfig();
}


/**
 * Configura os accordions na página de configurações.
 */
export function setupAccordion() {
    Elements.accordionHeaders().forEach(header => {
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
 * Abre o modal de seleção de time.
 * @param {string} panelId - O ID do painel de time ('team1' ou 'team2') que acionou o modal.
 */
export function openTeamSelectionModal(panelId) {
    console.log(`[openTeamSelectionModal] Tentando abrir modal para: ${panelId}`); // NOVO: Log
    if (!Elements.teamSelectionModal()) {
        console.error("Elemento do modal de seleção de time não encontrado.");
        displayMessage("Erro: Modal de seleção de time não encontrado.", "error");
        return;
    }
    selectingTeamPanelId = panelId;
    const allTeams = getAllGeneratedTeams();
    renderTeamsInModal(allTeams, panelId, selectTeamFromModal);
    Elements.teamSelectionModal().classList.add('modal-active');
}

/**
 * Fecha o modal de seleção de time.
 */
export function closeTeamSelectionModal() {
    if (Elements.teamSelectionModal()) {
        Elements.teamSelectionModal().classList.remove('modal-active');
        selectingTeamPanelId = null;
    }
}

/**
 * Função de callback para selecionar um time do modal e atualizar a interface.
 * @param {number} teamIndex - O índice do time selecionado no array de times gerados.
 * @param {string} panelId - O ID do painel de time ('team1' ou 'team2') a ser atualizado.
 */
export function selectTeamFromModal(teamIndex, panelId) {
    console.log(`[selectTeamFromModal] Time selecionado: ${teamIndex} para painel: ${panelId}`); // NOVO: Log
    const allTeams = getAllGeneratedTeams();
    const selectedTeam = allTeams[teamIndex];
    const config = loadConfig();
    const defaultColors = ['#325fda', '#f03737', '#28a745', '#ffc107', '#6f42c1', '#17a2b8'];

    if (!selectedTeam) {
        console.error("Time selecionado no modal não encontrado.");
        displayMessage("Erro ao selecionar o time.", "error");
        return;
    }

    const teamNumberForConfig = teamIndex + 1;

    const teamConfigNameKey = `customTeam${teamNumberForConfig}Name`;
    const teamConfigColorKey = `customTeam${teamNumberForConfig}Color`;

    const teamDisplayName = config[teamConfigNameKey] || selectedTeam.name || `Time ${teamNumberForConfig}`;
    const teamDisplayColor = config[teamConfigColorKey] || defaultColors[teamIndex] || '#6c757d';

    if (panelId === 'team1') {
        setCurrentTeam1(selectedTeam.players);
        setActiveTeam1Name(teamDisplayName);
        setActiveTeam1Color(teamDisplayColor);
    } else if (panelId === 'team2') {
        setCurrentTeam2(selectedTeam.players);
        setActiveTeam2Name(teamDisplayName);
        setActiveTeam2Color(teamDisplayColor);
    }

    updateTeamDisplayNamesAndColors(getActiveTeam1Name(), getActiveTeam2Name(), getActiveTeam1Color(), getActiveTeam2Color());
    // Condição para exibir jogadores: config.displayPlayers E (time1 ou time2 tem jogadores)
    const shouldDisplayPlayers = (config.displayPlayers ?? true) && (getCurrentTeam1().length > 0 || getCurrentTeam2().length > 0);
    renderScoringPagePlayers(getCurrentTeam1(), getCurrentTeam2(), shouldDisplayPlayers);
    displayMessage(`Time ${panelId === 'team1' ? 1 : 2} atualizado para: ${teamDisplayName}`, "success");
    closeTeamSelectionModal();
}

/**
 * Configura os event listeners para o modal de seleção de time.
 */
export function setupTeamSelectionModal() {
    if (Elements.closeModalButton()) {
        Elements.closeModalButton().addEventListener('click', closeTeamSelectionModal);
    }
}

/**
 * Função para configurar as interações de clique e arrastar na página de pontuação.
 */
export function setupScoreInteractions() {
    console.log('[setupScoreInteractions] Configurando interações de placar e modal.'); // NOVO: Log de inicialização

    // Listeners para os painéis de pontuação (para pontuar)
    // ATENÇÃO: Os cliques diretos nos painéis (team1-panel, team2-panel)
    // são para INCREMENTAR o placar.
    if (Elements.team1Panel()) {
        Elements.team1Panel().addEventListener('touchstart', (event) => handleScoreTouch(event, 'team1'));
        Elements.team1Panel().addEventListener('touchend', (event) => handleScoreTouch(event, 'team1'));
        Elements.team1Panel().addEventListener('click', (event) => handleScoreClick(event, 'team1'));
    }
    if (Elements.team2Panel()) {
        Elements.team2Panel().addEventListener('touchstart', (event) => handleScoreTouch(event, 'team2'));
        Elements.team2Panel().addEventListener('touchend', (event) => handleScoreTouch(event, 'team2'));
        Elements.team2Panel().addEventListener('click', (event) => handleScoreClick(event, 'team2'));
    }

    // Listeners para os nomes dos times (para ABRIR o modal de seleção)
    // E para as colunas de jogadores.
    const team1NameDisplay = Elements.team1NameDisplay();
    const team2NameDisplay = Elements.team2NameDisplay();
    const team1PlayersColumn = Elements.team1PlayersColumn();
    const team2PlayersColumn = Elements.team2PlayersColumn();

    // Função auxiliar para adicionar listeners aos elementos de abertura do modal
    const addModalOpenListeners = (element, teamId) => {
        if (element) {
            console.log(`[addModalOpenListeners] Elemento encontrado para ${teamId}:`, element.id); // NOVO: Log de elemento encontrado
            element.addEventListener('click', (event) => {
                console.log(`[setupScoreInteractions] Clique em ${teamId} - Elemento:`, event.target); // NOVO: Log
                event.stopPropagation(); // Impede que o clique seja propagado para o painel de pontuação e incremente o placar
                openTeamSelectionModal(teamId);
            });
            // Opcional: Adicionar touchstart/touchend se quiser que o toque abra o modal de forma mais direta,
            // mas isso pode conflitar com o comportamento de arrastar para pontuar se os painéis tiverem a mesma área.
            // Para mobile, o clique já simula o toque na maioria dos casos.
        } else {
            console.warn(`[addModalOpenListeners] Elemento para ${teamId} não encontrado.`); // NOVO: Log de elemento não encontrado
        }
    };

    addModalOpenListeners(team1NameDisplay, 'team1');
    addModalOpenListeners(team2NameDisplay, 'team2');
    addModalOpenListeners(team1PlayersColumn, 'team1');
    addModalOpenListeners(team2PlayersColumn, 'team2');
}

function handleScoreTouch(event, teamId) {
    console.log(`[handleScoreTouch] Evento de toque (${event.type}) no ${teamId}. Target:`, event.target); // NOVO: Log
    if (event.type === 'touchstart') {
        touchStartY = event.touches[0].clientY;
        // REMOVIDO: event.preventDefault(); - Isso era a principal causa de conflitos com cliques.
        return;
    }

    if (event.type === 'touchend') {
        const touchEndY = event.changedTouches[0].clientY;
        const deltaY = touchEndY - touchStartY;

        const targetElement = event.target;
        // Verifica se o toque foi em um dos elementos que abrem o modal de seleção
        // Se foi, não faça nada aqui, pois o listener de clique no element.addEventListener('click')
        // ou um futuro listener de toque específico para o modal cuidará disso.
        if (targetElement.closest('.team-name') || targetElement.closest('.team-players-column')) {
            console.log(`[handleScoreTouch] Toque no ${teamId} foi em elemento de seleção de time. Abortando incremento/decremento.`); // NOVO: Log
            return; 
        }

        if (Math.abs(deltaY) > DRAG_THRESHOLD) {
            console.log(`[handleScoreTouch] Toque no ${teamId} foi interpretado como arrasto (deltaY: ${deltaY}).`); // NOVO: Log
            if (deltaY > 0) {
                decrementScore(teamId);
            } else {
                incrementScore(teamId);
            }
        } else {
            console.log(`[handleScoreTouch] Toque no ${teamId} foi interpretado como clique. Incrementando placar.`); // NOVO: Log
            incrementScore(teamId);
        }
    }
}

function handleScoreClick(event, teamId) {
    console.log(`[handleScoreClick] Evento de clique no ${teamId}. Target:`, event.target); // NOVO: Log
    const targetElement = event.target;
    // Verifica se o clique foi em um dos elementos que abrem o modal de seleção
    if (targetElement.closest('.team-name') || targetElement.closest('.team-players-column')) {
        console.log(`[handleScoreClick] Clique no ${teamId} foi em elemento de seleção de time. Abortando incremento.`); // NOVO: Log
        return; 
    }
    incrementScore(teamId);
    console.log(`[handleScoreClick] Placar do ${teamId} incrementado.`); // NOVO: Log
}
