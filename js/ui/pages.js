// js/ui/pages.js
// Gerencia a exibição de páginas e a navegação principal.

import * as Elements from './elements.js';
import { getIsGameInProgress, resetGameForNewMatch, getCurrentTeam1, getCurrentTeam2, getActiveTeam1Name, getActiveTeam2Name, getActiveTeam1Color, getActiveTeam2Color, incrementScore, decrementScore, getAllGeneratedTeams, setCurrentTeam1, setCurrentTeam2, setActiveTeam1Name, setActiveTeam2Name, setActiveTeam1Color, setActiveTeam2Color, getTeam1Score, getTeam2Score } from '../game/logic.js';
import { updateScoreDisplay, updateTimerDisplay, updateSetTimerDisplay, renderScoringPagePlayers, updateTeamDisplayNamesAndColors, updateNavScoringButton, renderTeams, renderTeamsInModal } from './game-ui.js';
import { loadConfig, saveConfig, setupConfigUI } from './config-ui.js';
import { renderPlayersList, updatePlayerCount, updateSelectAllToggle } from './players-ui.js';
import { getCurrentUser, logout } from '../firebase/auth.js';
import { displayMessage } from './messages.js';
// Importa as funções de scheduling-ui.js que serão usadas nos callbacks do modal
import { cancelGame, deleteGame, setupSchedulingPage } from './scheduling-ui.js';
import * as SchedulingUI from './scheduling-ui.js'; // Adicione esta linha para importar tudo
import { addPlayer } from '../data/players.js'; // <-- ADICIONE ESTA LINHA

let touchStartY = 0;
const DRAG_THRESHOLD = 30; // Limite de movimento para diferenciar clique de arrastar
let hasGameBeenStartedExplicitly = false;
let currentPageId = 'login-page';
let selectingTeamPanelId = null;

// Callbacks para o modal de confirmação
let onConfirmCallback = null;
let onCancelCallback = null;


/**
 * Define o estado se o jogo foi iniciado explicitamente.
 * @param {boolean} status - True se o jogo foi iniciado explicitamente, false caso contrário.
 */
export function setGameStartedExplicitly(status) {
    hasGameBeenStartedExplicitly = status;
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
export function closeSidebar() {
    const sidebar = Elements.sidebar();
    const profileMenu = Elements.profileMenu();
    const userProfileHeader = Elements.userProfileHeader();
    const sidebarOverlay = Elements.sidebarOverlay();

    if (sidebar) {
        sidebar.classList.remove('active');
    }
    if (profileMenu && profileMenu.classList.contains('active')) {
        profileMenu.classList.remove('active');
        if (userProfileHeader) {
            userProfileHeader.classList.remove('active');
        }
    }
    if (sidebarOverlay) {
        sidebarOverlay.classList.add('hidden');
        sidebarOverlay.classList.remove('active');
    }
}

/**
 * Exibe uma página específica e esconde as outras, com lógica para sobreposição da start-page.
 * @param {string} pageIdToShow - O ID da página a ser exibida.
 */
export async function showPage(pageIdToShow) {
    if (pageIdToShow === 'scoring-page' && !hasGameBeenStartedExplicitly) {
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
        renderScoringPagePlayers([], [], false);
    }

    closeSidebar();
    updateNavScoringButton(getIsGameInProgress(), currentPageId);

    if (pageIdToShow === 'players-page') {
        const currentUser = getCurrentUser();
        updatePlayerModificationAbility(!!currentUser);
        updatePlayerCount();
        updateSelectAllToggle();    } else if (pageIdToShow === 'teams-page') {
        renderTeams(getAllGeneratedTeams());
    } else if (pageIdToShow === 'config-page') {
        setupConfigUI(); // Isso já chama loadConfig() internamente
    }
    // REMOVIDO: Importação assíncrona e chamada de setupSchedulingPage aqui.
    // Ela será chamada uma única vez no main.js.
    else if (pageIdToShow === 'scoring-page') {
        updateScoreDisplay(getTeam1Score(), getTeam2Score());
        updateTeamDisplayNamesAndColors(getActiveTeam1Name(), getActiveTeam2Name(), getActiveTeam1Color(), getActiveTeam2Color());
        
        const config = loadConfig();
        const displayPlayers = config.displayPlayers ?? true;
        const currentTeam1Players = getCurrentTeam1();
        const currentTeam2Players = getCurrentTeam2();
        
        const shouldDisplayPlayers = displayPlayers && (currentTeam1Players.length > 0 || currentTeam2Players.length > 0);
        renderScoringPagePlayers(currentTeam1Players, currentTeam2Players, shouldDisplayPlayers);
    } else if (pageIdToShow === 'start-page') {
        resetGameForNewMatch();
        setGameStartedExplicitly(false);
    } else if (pageIdToShow === 'scheduling-page') {
        // Força renderização instantânea ao entrar na tela de agendamentos
        if (typeof SchedulingUI.renderScheduledGames === 'function') {
            SchedulingUI.renderScheduledGames();
        }
        // Garante que o listener esteja ativo ao entrar na tela
        setupSchedulingPage();
    }
}


/**
 * Atualiza a capacidade de modificação de jogadores com base no tipo de usuário.
 * @param {boolean} canModify - True se o usuário pode modificar jogadores, false caso contrário.
 */
export function updatePlayerModificationAbility(canModify) {
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
 * NOVO: Atualiza o texto e a ação do botão de login/logout no mini-menu do perfil.
 */
export function updateProfileMenuLoginState() {
    const profileLogoutButton = Elements.profileLogoutButton();
    const currentUser = getCurrentUser();

    if (profileLogoutButton) {
        const iconSpan = profileLogoutButton.querySelector('.material-icons');
        const textSpan = profileLogoutButton;

        if (currentUser && currentUser.isAnonymous) {
            if (iconSpan) iconSpan.textContent = 'login';
            textSpan.innerHTML = `<span class="material-icons">login</span> Logar`;
        } else {
            if (iconSpan) iconSpan.textContent = 'logout';
            textSpan.innerHTML = `<span class="material-icons">logout</span> Sair`;
        }
    }
}


/**
 * Atualiza o nome do usuário exibido no sidebar.
 * @param {string} playerName - nome do jogador salvo no Firestore
 */
export function updateSidebarUserName(playerName) {
    if (Elements.userDisplayName()) {
        Elements.userDisplayName().textContent = playerName || "Visitante";
    }
}

/**
 * Configura os event listeners para os botões da barra lateral e mini-menu.
 * @param {Function} startGameHandler - Função para iniciar o jogo.
 * @param {Function} getPlayersHandler - Função para obter os jogadores.
 */
export function setupSidebar(startGameHandler, getPlayersHandler) {
    Elements.menuButton().addEventListener('click', (event) => {
        event.stopPropagation();
        const sidebar = Elements.sidebar();
        const sidebarOverlay = Elements.sidebarOverlay();

        if (sidebar) {
            sidebar.classList.add('active');
        }
        if (sidebarOverlay) {
            sidebarOverlay.classList.add('active'); // Agora o overlay aparece ao abrir
            sidebarOverlay.classList.remove('hidden'); // Remove a classe 'hidden' se estiver lá
        }
    });

    Elements.sidebarNavItems().forEach(item => {
        item.addEventListener('click', () => {
            const pageId = item.id.replace('nav-', '');
            const targetPageId = pageId + '-page';

            showPage(targetPageId);
            closeSidebar();
        });
    });

    // Listener para abrir/fechar o mini-menu do perfil
    if (Elements.userProfileHeader()) {
        Elements.userProfileHeader().addEventListener('click', (event) => {
            event.stopPropagation();
            const profileMenu = Elements.profileMenu();
            const userProfileHeader = Elements.userProfileHeader();
            if (profileMenu && userProfileHeader) {
                profileMenu.classList.toggle('active');
                userProfileHeader.classList.toggle('active');
            }
        });
    }

    // REMOVIDO: Lógica para adicionar botão de alterar nome de exibição
    if (Elements.profileMenu()) {
        const logoutBtn = Elements.profileLogoutButton();
        if (logoutBtn) {
            logoutBtn.parentNode.removeChild(logoutBtn);
        }
    }

    // Listener para o botão "Sair" (agora dinâmico "Logar"/"Sair") dentro do mini-menu
    if (Elements.profileLogoutButton()) {
        Elements.profileLogoutButton().addEventListener('click', () => {
            const user = getCurrentUser();
            if (user && user.isAnonymous) {
                loginWithGoogle();
            } else {
                logout();
            }
            closeSidebar();
        });
    }

    // REMOVIDO: Listener para o botão "Configurações" dentro do mini-menu, movido para o sidebar principal
    // if (Elements.profileSettingsButton()) {
    //     Elements.profileSettingsButton().addEventListener('click', () => {
    //         showPage('config-page'); // Navega para a página de configurações
    //         closeSidebar();
    //     });
    // }
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
                showPage('scoring-page');
            } else {
                startGameHandler();
            }
        });
    }

    const addPlayerButton = Elements.addPlayerButton();
    if (addPlayerButton) {
        addPlayerButton.addEventListener('click', async () => {
            const playerNameInput = Elements.newPlayerNameInput();
            const playerName = playerNameInput ? playerNameInput.value.trim() : '';
            const { getFirestoreDb } = await import('../firebase/config.js');
            const db = getFirestoreDb();
            if (playerName) {
                const currentUser = getCurrentUser();
                await addPlayer(db, appId, playerName, currentUser ? currentUser.uid : null);
                if (playerNameInput) {
                    playerNameInput.value = '';
                }
            } else {
                // console.warn("O nome do jogador não pode estar vazio.");
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
        // Substitua o listener abaixo para só remover após confirmação
        Elements.playersListContainer().addEventListener('click', async (event) => {
            if (event.target.closest('.remove-button')) {
                const button = event.target.closest('.remove-button');
                const playerIdToRemove = button.dataset.playerId;
                if (playerIdToRemove) { // <-- Corrigido: estava faltando parênteses
                    // Mostra confirmação ANTES de remover
                    showConfirmationModal(
                        'Tem certeza que deseja excluir este jogador?',
                        async () => {
                            const currentUser = getCurrentUser();
                            await removePlayer(playerIdToRemove, currentUser ? currentUser.uid : null, appId);
                        }
                    );
                }
            }
        });

        Elements.playersListContainer().addEventListener('change', (event) => {
            if (event.target.classList.contains('player-checkbox')) {
                updatePlayerCount();
                updateSelectAllToggle();
            }
        });
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
            const content = header.nextElementSibling;
            const isActive = accordionItem.classList.contains('active');

            if (isActive) {
                accordionItem.classList.remove('active');
                content.style.maxHeight = null;
            } else {
                accordionItem.classList.add('active');
                content.style.maxHeight = content.scrollHeight + 'px';
            }
        });
    });

    // REMOVIDO: Bloco redundante que estava causando o bug do accordion na tela de agendamentos.
    // O loop acima já lida com todos os cabeçalhos de accordion, incluindo o de "Jogos Passados".
}

/**
 * Abre o modal de seleção de time.
 * @param {string} panelId - O ID do painel de time ('team1' ou 'team2') que acionou o modal.
 */
export function openTeamSelectionModal(panelId) {
    if (!Elements.teamSelectionModal()) {
        // Removido: console.error("Elemento do modal de seleção de time não encontrado.");
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

    // CORREÇÃO AQUI: Garante que as chaves de configuração sejam construídas corretamente
    const teamConfigNameKey = `customTeam${teamNumberForConfig}Name`;
    const teamConfigColorKey = `customTeam${teamNumberForConfig}Color`;

    // Acessa as configurações usando as chaves corretas
    const teamDisplayName = config[teamConfigNameKey] || selectedTeam.name || `Time ${teamNumberForConfig}`;
    const teamDisplayColor = config[teamConfigColorKey] || defaultColors[teamIndex] || '#6c757d'; // Usa teamConfigColorKey aqui

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
    const shouldDisplayPlayers = (config.displayPlayers ?? true) && (getCurrentTeam1().length > 0 || getCurrentTeam2().length > 0);
    renderScoringPagePlayers(getCurrentTeam1(), getCurrentTeam2(), shouldDisplayPlayers);
    
    // Fecha o modal
    Elements.teamSelectionModal().classList.remove('modal-active');
    displayMessage(`Time ${panelId === 'team1' ? 1 : 2} atualizado para: ${teamDisplayName}`, "success");
}


/**
 * Configura os event listeners para o modal de seleção de time.
 */
export function setupTeamSelectionModal() {
    if (Elements.closeModalButton()) {
        Elements.closeModalButton().addEventListener('click', closeTeamSelectionModal);
    }
    if (Elements.closeModalButtonTopRight()) {
        Elements.closeModalButtonTopRight().addEventListener('click', closeTeamSelectionModal);
    }

    if (Elements.teamSelectionModal()) {
        Elements.teamSelectionModal().addEventListener('click', (event) => {
            if (event.target === Elements.teamSelectionModal()) {
                closeTeamSelectionModal();
            }
        });
    }
}

/**
 * Função para configurar as interações de clique e arrastar na página de pontuação.
 */
export function setupScoreInteractions() {
    if (Elements.team1Panel()) {
        Elements.team1Panel().addEventListener('touchstart', (event) => handleScoreTouch(event, 'team1'));
        Elements.team1Panel().addEventListener('touchend', (event) => handleScoreTouch(event, 'team1'));
    }
    if (Elements.team2Panel()) {
        Elements.team2Panel().addEventListener('touchstart', (event) => handleScoreTouch(event, 'team2'));
        Elements.team2Panel().addEventListener('touchend', (event) => handleScoreTouch(event, 'team2'));
    }

    const team1NameDisplay = Elements.team1NameDisplay();
    const team2NameDisplay = Elements.team2NameDisplay();
    const team1PlayersColumn = Elements.team1PlayersColumn();
    const team2PlayersColumn = Elements.team2PlayersColumn();

    const addModalOpenListeners = (element, teamId) => {
        if (element) {
            element.addEventListener('click', (event) => {
                event.stopPropagation();
                openTeamSelectionModal(teamId);
            });
        }
    };

    addModalOpenListeners(team1NameDisplay, 'team1');
    addModalOpenListeners(team2NameDisplay, 'team2');
    addModalOpenListeners(team1PlayersColumn, 'team1');
    addModalOpenListeners(team2PlayersColumn, 'team2');
}

function handleScoreTouch(event, teamId) {
    if (event.type === 'touchstart') {
        touchStartY = event.touches[0].clientY;
        return;
    }

    if (event.type === 'touchend') {
        const touchEndY = event.changedTouches[0].clientY;
        const deltaY = touchEndY - touchStartY;

        const targetElement = event.target;
        if (targetElement.closest('.team-name') || targetElement.closest('.team-players-column')) {
            return; 
        }

        if (Math.abs(deltaY) > DRAG_THRESHOLD) {
            if (deltaY > 0) {
                decrementScore(teamId);
            } else {
                incrementScore(teamId);
            }
        } else {
            incrementScore(teamId);
        }
    }
}


/**
 * Exibe um modal de confirmação personalizado.
 * @param {string} message - A mensagem a ser exibida no modal.
 * @param {Function} onConfirm - Callback a ser executado se o usuário confirmar.
 * @param {Function} onCancel - Callback a ser executado se o usuário cancelar (opcional).
 */
export function showConfirmationModal(message, onConfirm, onCancel = null) {
    const modal = Elements.confirmationModal();
    const msgElement = Elements.confirmationMessage();
    const yesButton = Elements.confirmYesButton();
    const noButton = Elements.confirmNoButton();

    if (!modal || !msgElement || !yesButton || !noButton) {
        // Removido: console.error("Elementos do modal de confirmação não encontrados.");
        return;
    }

    msgElement.textContent = message;
    onConfirmCallback = onConfirm;
    onCancelCallback = onCancel;

    yesButton.onclick = null;
    noButton.onclick = null;

    yesButton.addEventListener('click', handleConfirmClick);
    noButton.addEventListener('click', handleCancelClick);

    modal.classList.add('active');
}

/**
 * Esconde o modal de confirmação.
 */
export function hideConfirmationModal() {
    const modal = Elements.confirmationModal();
    if (modal) {
        modal.classList.remove('active');
    }
}

function handleConfirmClick() {
    if (onConfirmCallback) {
        try {
            onConfirmCallback();
        } catch (error) {
            console.error('Erro ao executar a ação confirmada:', error);
            displayMessage('Erro ao executar a ação confirmada.', 'error');
        }
    }
    hideConfirmationModal();
    onConfirmCallback = null;
    onCancelCallback = null;
}

function handleCancelClick() {
    hideConfirmationModal();
    if (onCancelCallback) {
        onCancelCallback();
    }
    onConfirmCallback = null;
    onCancelCallback = null;
}

// Lista de páginas principais na ordem do menu lateral
const MAIN_PAGES = [
    'scoring-page',
    'teams-page',
    'players-page',
    'history-page',
    'scheduling-page',
    'stats-page',
    'config-page'
];

// Variáveis para swipe lateral
let swipeStartX = null;
let swipeStartY = null;
const SWIPE_X_THRESHOLD = 60; // Pixels mínimos para considerar swipe
const SWIPE_Y_MAX = 40; // Máximo de desvio vertical para considerar swipe lateral

function setupSwipeNavigation() {
    const mainContent = document.querySelector('.app-main-content');
    if (!mainContent) return;

    mainContent.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            swipeStartX = e.touches[0].clientX;
            swipeStartY = e.touches[0].clientY;
        }
    });

    mainContent.addEventListener('touchend', (e) => {
        if (swipeStartX === null || swipeStartY === null) return;
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const deltaX = endX - swipeStartX;
        const deltaY = endY - swipeStartY;

        // Só considera swipe lateral se o movimento for predominantemente horizontal
        if (Math.abs(deltaX) > SWIPE_X_THRESHOLD && Math.abs(deltaY) < SWIPE_Y_MAX) {
            handleSwipeNavigation(deltaX);
        }
        swipeStartX = null;
        swipeStartY = null;
    });
}

function handleSwipeNavigation(deltaX) {
    // Só permite swipe se estiver em uma das páginas principais
    const idx = MAIN_PAGES.indexOf(currentPageId);
    if (idx === -1) return;

    let nextIdx = null;
    if (deltaX < 0 && idx < MAIN_PAGES.length - 1) {
        // Swipe para a esquerda: próxima página
        nextIdx = idx + 1;
    } else if (deltaX > 0 && idx > 0) {
        // Swipe para a direita: página anterior
        nextIdx = idx - 1;
    }
    if (nextIdx !== null) {
        showPage(MAIN_PAGES[nextIdx]);
    }
}

// No final do arquivo (ou após setupScoreInteractions), chame a função para ativar o swipe:
setupSwipeNavigation();
