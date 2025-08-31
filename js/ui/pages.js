// js/ui/pages.js
// Gerencia a exibição de páginas e a navegação principal.

import * as Elements from './elements.js';
import { getIsGameInProgress, resetGameForNewMatch, getCurrentTeam1, getCurrentTeam2, getActiveTeam1Name, getActiveTeam2Name, getActiveTeam1Color, getActiveTeam2Color, incrementScore, decrementScore, getAllGeneratedTeams, setCurrentTeam1, setCurrentTeam2, setActiveTeam1Name, setActiveTeam2Name, setActiveTeam1Color, setActiveTeam2Color, getTeam1Score, getTeam2Score } from '../game/logic.js';
import { updateScoreDisplay, updateTimerDisplay, updateSetTimerDisplay, renderScoringPagePlayers, updateTeamDisplayNamesAndColors, updateNavScoringButton, renderTeams, renderTeamsInModal } from './game-ui.js';
import { loadConfig, saveConfig, setupConfigUI } from './config-ui.js';
import { renderPlayersList, updatePlayerCount, updateSelectAllToggle, savePlayerSelectionState } from './players-ui.js';
import { getCurrentUser, logout } from '../firebase/auth.js';
import { displayMessage } from './messages.js';
// Importa as funções de scheduling-ui.js que serão usadas nos callbacks do modal
import { cancelGame, deleteGame, setupSchedulingPage } from './scheduling-ui.js';
import * as SchedulingUI from './scheduling-ui.js'; // Adicione esta linha para importar tudo
import { addPlayer, removePlayer } from '../data/players.js'; // <-- ADICIONE ESTA LINHA

let touchStartY = 0;
const DRAG_THRESHOLD = 30; // Limite de movimento para diferenciar clique de arrastar
let touchStartedOnSwap = false; // Flag para evitar pontuar quando o toque começou no botão de inverter
let hasGameBeenStartedExplicitly = false;
let currentPageId = 'login-page';
let selectingTeamPanelId = null;

// Controle de overlay de orientação (mostra em paisagem exceto na tela de pontuação)




// Fullscreen helpers para tela de pontuação
function supportsFullscreen() {
    return document.fullscreenEnabled || document.webkitFullscreenEnabled || document.msFullscreenEnabled;
}
async function enterFullscreen() {
    const el = document.documentElement;
    if (!supportsFullscreen() || document.fullscreenElement || document.webkitFullscreenElement) return;
    try {
        if (el.requestFullscreen) { await el.requestFullscreen(); }
        else if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); }
        else if (el.msRequestFullscreen) { el.msRequestFullscreen(); }
    } catch (_) { /* ignore */ }
}
async function exitFullscreen() {
    try {
        if (document.exitFullscreen && document.fullscreenElement) { await document.exitFullscreen(); }
        else if (document.webkitExitFullscreen && document.webkitFullscreenElement) { document.webkitExitFullscreen(); }
        else if (document.msExitFullscreen) { document.msExitFullscreen(); }
    } catch (_) { /* ignore */ }
}



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
        // Fecha usando a classe correta que controla a transição
        sidebar.classList.remove('open');
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
    // Restaura scroll do body caso tenha sido bloqueado pelo handler moderno
    document.body.style.overflow = '';
    document.body.classList.remove('sidebar-open');
    const menuButtonEl = document.getElementById('menu-button');
    if (menuButtonEl) menuButtonEl.classList.remove('active');
}

/**
 * Exibe uma página específica e esconde as outras, com lógica para sobreposição da start-page.
 * @param {string} pageIdToShow - O ID da página a ser exibida.
 */
export async function showPage(pageIdToShow) {
    // Não altera o hash da URL automaticamente
    Elements.pages().forEach(page => {
        page.style.display = 'none';
        page.classList.remove('app-page--active');
    });
    const targetPage = document.getElementById(pageIdToShow);
    if (targetPage) {
        console.log(`[DEBUG: pages.js] ${new Date().toISOString()} - Showing page: ${pageIdToShow}`);
        targetPage.style.display = 'flex';
        targetPage.classList.add('app-page--active');
        currentPageId = pageIdToShow;
    } else {
        console.log(`[DEBUG: pages.js] ${new Date().toISOString()} - Page not found: ${pageIdToShow}`);
    }

    

    // Update scheduling UI permissions/visibility on page change
    try { SchedulingUI.updateSchedulingPermissions(); } catch (e) { /* ignore */ }

    // NOVO: Gerencia classe CSS no body para ocultar elementos quando start-page está ativa
    if (pageIdToShow === 'start-page') {
        document.body.classList.add('start-page-active');
        Elements.scoringPage().classList.add('app-page--active');
        renderScoringPagePlayers([], [], false);
    } else {
        document.body.classList.remove('start-page-active');
    }

    closeSidebar();
    updateNavScoringButton(getIsGameInProgress(), currentPageId);

    // Atualiza item ativo do menu conforme a página atual
    try {
        const navItems = document.querySelectorAll('.sidebar-nav-item');
        navItems.forEach(i => i.classList.remove('active'));
        let navId = null;
        if (pageIdToShow === 'scoring-page' || pageIdToShow === 'start-page') {
            navId = 'nav-scoring';
        } else if (pageIdToShow && pageIdToShow.endsWith('-page')) {
            navId = 'nav-' + pageIdToShow.replace('-page', '');
        }
        if (navId) {
            const btn = document.getElementById(navId);
            if (btn) btn.classList.add('active');
        }
    } catch (_) { /* ignore */ }

    if (pageIdToShow === 'players-page') {
        let currentUser = null;
        try {
            currentUser = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
        } catch (e) {
            currentUser = null; // Evita erro de TDZ em import cíclico durante inicialização
        }
        updatePlayerModificationAbility(!!currentUser);
        updatePlayerCount();
        updateSelectAllToggle();    } else if (pageIdToShow === 'teams-page') {
        renderTeams(getAllGeneratedTeams());
        // Carregar valor atual da configuração no campo
        const playersPerTeamInput = document.getElementById('players-per-team-input');
        if (playersPerTeamInput) {
            const config = loadConfig();
            playersPerTeamInput.value = config.playersPerTeam || 4;
            
            // Adicionar listener para salvar automaticamente
            playersPerTeamInput.addEventListener('change', () => {
                const currentConfig = loadConfig();
                currentConfig.playersPerTeam = parseInt(playersPerTeamInput.value) || 4;
                localStorage.setItem('volleyballConfig', JSON.stringify(currentConfig));
            });
        }
        // Atualizar contador de jogadores selecionados
        updateSelectedPlayersCount();
    } else if (pageIdToShow === 'config-page') {
        setupConfigUI(); // Isso já chama loadConfig() internamente
    }

    else if (pageIdToShow === 'scoring-page') {
        updateScoreDisplay(getTeam1Score(), getTeam2Score());
        updateTeamDisplayNamesAndColors(getActiveTeam1Name(), getActiveTeam2Name(), getActiveTeam1Color(), getActiveTeam2Color());
        
        const config = loadConfig();
        const displayPlayers = config.displayPlayers ?? true;
        const currentTeam1Players = getCurrentTeam1();
        const currentTeam2Players = getCurrentTeam2();
        
        const shouldDisplayPlayers = displayPlayers;
        renderScoringPagePlayers(currentTeam1Players, currentTeam2Players, shouldDisplayPlayers);
        
        // Respeita a configuração de exibir timer ao entrar na tela
        try {
            const wrapper = document.getElementById('timer-and-set-timer-wrapper') || Elements.timerAndSetTimerWrapper?.();
            if (wrapper) {
                wrapper.style.display = (config.displayTimer ?? true) ? 'flex' : 'none';
            }
        } catch (_) { /* ignore */ }
        
        // NOVO: Força atualização dos ícones
        setTimeout(() => {
            const team1Btn = document.getElementById('team1-change-button');
            const team2Btn = document.getElementById('team2-change-button');
            if (team1Btn) {
                const icon1 = team1Btn.querySelector('.material-icons');
                if (icon1) icon1.textContent = 'cached';
            }
            if (team2Btn) {
                const icon2 = team2Btn.querySelector('.material-icons');
                if (icon2) icon2.textContent = 'cached';
            }
        }, 100);
    } else if (pageIdToShow === 'start-page') {
        // Não resetar o jogo automaticamente - apenas se não houver jogo em progresso
        if (!getIsGameInProgress()) {
            setGameStartedExplicitly(false);
        }
    } else if (pageIdToShow === 'scheduling-page') {
        // Força renderização instantânea ao entrar na tela de agendamentos
        if (typeof SchedulingUI.renderScheduledGames === 'function') {
            SchedulingUI.renderScheduledGames();
        }
        // Garante que o listener esteja ativo ao entrar na tela
        setupSchedulingPage();
        // NOVO: Escreve dados no modal de confirmação se vier de notificação
        if (sessionStorage.getItem('fromNotification') === 'true' && sessionStorage.getItem('lastRSVPData')) {
            try {
                const rsvpData = JSON.parse(sessionStorage.getItem('lastRSVPData'));
                let message = `Confirme sua presença para o jogo:`;
                if (rsvpData.data && rsvpData.data.location && rsvpData.data.startTime && rsvpData.data.date) {
                    message += `\n📅 ${rsvpData.data.date} às ${rsvpData.data.startTime}\n📍 ${rsvpData.data.location}`;
                }
                let resposta = rsvpData.action === 'going' ? 'Vou' : rsvpData.action === 'not_going' ? 'Não vou' : 'Talvez';
                if (rsvpData.playerName) {
                    message += `\n\nJogador: ${rsvpData.playerName}`;
                }
                message += `\nResposta: ${resposta}`;
                console.log('[DEBUG scheduling-page] Escrevendo no modal de confirmação:', {message, rsvpData});
                showConfirmationModal(message, () => {
                    displayMessage(`Confirmação registrada: ${resposta} para agendamento ${rsvpData.scheduleId}`, 'success');
                }, () => {
                    displayMessage('Confirmação cancelada.', 'info');
                });
            } catch(e) {
                console.error('[DEBUG scheduling-page] Erro ao processar RSVP:', e);
            }
        }
    }
}


/**
 * Atualiza a capacidade de modificação de jogadores com base no tipo de usuário.
 * @param {boolean} canModify - True se o usuário pode modificar jogadores, false caso contrário.
 */
export function updatePlayerModificationAbility(canModify) {
    const playerInput = Elements.playerInput();
    const addPlayerButton = Elements.addPlayerButton();
    const removeButtons = document.querySelectorAll('#players-list-container .remove-button');
    const selectAllToggle = Elements.selectAllPlayersToggle();

    if (playerInput) playerInput.disabled = !canModify;
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
        // Deixe o handler moderno (sidebar-ui.js) controlar abertura/fechamento
        // Evita conflito de toggles duplicados
    });

    Elements.sidebarNavItems().forEach(item => {
        item.addEventListener('click', () => {
            const pageId = item.id.replace('nav-', '');
            const targetPageId = pageId + '-page';
            
            if (pageId === 'scoring') {
                if (getIsGameInProgress()) {
                    // Se já está na tela de pontuação e há jogo em andamento, perguntar se deseja iniciar um novo
                    if (getCurrentPageId() === 'scoring-page') {
                        showConfirmationModal(
                            'Deseja iniciar uma nova partida? A partida atual será perdida.',
                            () => {
                                // Se confirmar, verificar se há jogadores na partida atual
                                import('../game/logic.js').then(({ endGame, startGame, getCurrentTeam1, getCurrentTeam2, resetGameForNewMatch }) => {
                                    const team1HasPlayers = getCurrentTeam1() && getCurrentTeam1().length > 0;
                                    const team2HasPlayers = getCurrentTeam2() && getCurrentTeam2().length > 0;
                                    
                                    // Só pergunta se quer salvar se tiver jogadores em ambos os times
                                    if (team1HasPlayers && team2HasPlayers) {
                                        showConfirmationModal(
                                            'Deseja salvar a partida atual no histórico?',
                                            () => {
                                                // Se confirmar, salva a partida atual
                                                endGame({ auto: true }); // salvar silenciosamente e encerrar
                                                // Mostra a tela inicial em vez de iniciar nova partida
                                                showPage('start-page');
                                            },
                                            () => {
                                                // Se não confirmar, apenas reseta e mostra a tela inicial
                                                resetGameForNewMatch();
                                                showPage('start-page');
                                            }
                                        );
                                    } else {
                                        // Se não tiver jogadores, apenas reseta e mostra a tela inicial
                                        resetGameForNewMatch();
                                        showPage('start-page');
                                    }
                                });
                            },
                            () => {
                                // Se não confirmar, apenas mostra a página de pontuação atual
                                showPage(targetPageId);
                            }
                        );
                    } else {
                        // Se não está na tela de pontuação, apenas vai para a tela de pontuação
                        showPage(targetPageId);
                    }
                } else {
                    // Se não houver jogo em andamento, mostra a tela inicial
                    showPage('start-page');
                }
            } else {
                showPage(targetPageId);
            }
            
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
                // Cria dinamicamente o botão de login/logout se não existir
                let logoutBtn = Elements.profileLogoutButton();
                if (!logoutBtn) {
                    logoutBtn = document.createElement('button');
                    logoutBtn.id = 'profile-logout-button';
                    logoutBtn.className = 'profile-menu-item';
                    profileMenu.appendChild(logoutBtn);
                }
                // Atualiza o conteúdo do menu
                const currentUser = getCurrentUser();
                const isGoogleUser = currentUser && !currentUser.isAnonymous;
                const isAnonymousUser = currentUser && currentUser.isAnonymous;
                
                if (isAnonymousUser) {
                    // Para usuário anônimo, mostra opção de logar
                    profileMenu.innerHTML = `
                        <button class="profile-menu-item" id="profile-login-button">
                            <span class="material-icons">login</span>
                            Logar
                        </button>
                    `;
                    // Adiciona event listener para o botão de login
                    const loginBtn = document.getElementById('profile-login-button');
                    if (loginBtn) {
                        loginBtn.addEventListener('click', async () => {
                            closeSidebar();
                            const { loginWithGoogle } = await import('../firebase/auth.js');
                            loginWithGoogle();
                        });
                    }
                } else {
                    // Para usuário Google ou não logado, mostra opções normais
                    profileMenu.innerHTML = `
                        ${isGoogleUser ? `
                        <button class="profile-menu-item" onclick="changeProfilePhoto()">
                            <span class="material-icons">photo_camera</span>
                            Alterar Foto
                        </button>
                        ` : ''}
                        <button class="profile-menu-item" onclick="logout()">
                            <span class="material-icons">logout</span>
                            Sair
                        </button>
                    `;
                }
                // Event listeners são adicionados via onclick no HTML
                profileMenu.classList.toggle('active');
                userProfileHeader.classList.toggle('active');
            }
        });
    }

    if (Elements.profileMenu()) {
        const logoutBtn = Elements.profileLogoutButton();
        if (logoutBtn) {
            logoutBtn.parentNode.removeChild(logoutBtn);
        }
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
                showPage('scoring-page');
            } else {
                startGameHandler();
            }
        });
    }

    const addPlayerButton = Elements.addPlayerButton();
    if (addPlayerButton) {
        addPlayerButton.addEventListener('click', async () => {
            const playerInput = document.getElementById('player-input');
            const playerName = playerInput ? playerInput.value.trim() : '';
            
            if (playerName) {
                // Mostra modal de seleção de categoria
                showCategorySelectionModal(playerName, appId);
                if (playerInput) {
                    playerInput.value = '';
                }
            }
        });
    }

    if (Elements.selectAllPlayersToggle()) {
        Elements.selectAllPlayersToggle().addEventListener('change', (event) => {
            const isChecked = event.target.checked;
            const actionText = isChecked ? 'marcar' : 'desmarcar';

            showConfirmationModal(
                `Deseja ${actionText} todos os jogadores visíveis?`,
                () => {
                    const checkboxes = document.querySelectorAll('#players-list-container .player-checkbox');
                    checkboxes.forEach(checkbox => {
                        checkbox.checked = isChecked;
                    });
                    // Persiste a seleção por categoria
                    try { savePlayerSelectionState(); } catch (_) {}
                    updatePlayerCount();
                    updateSelectAllToggle();
                },
                () => {
                    // Reverte o estado do toggle se cancelar
                    event.target.checked = !isChecked;
                    updateSelectAllToggle();
                }
            );
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


}

/**
 * Abre o modal de seleção de time.
 * @param {string} panelId - O ID do painel de time ('team1' ou 'team2') que acionou o modal.
 */
export function openTeamSelectionModal(panelId) {
    if (!Elements.teamSelectionModal()) {
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
        // Log removido
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
    const shouldDisplayPlayers = config.displayPlayers ?? true;
    renderScoringPagePlayers(getCurrentTeam1(), getCurrentTeam2(), shouldDisplayPlayers);
    
    // Fecha o modal
    Elements.teamSelectionModal().classList.remove('modal-active');
    displayMessage(`Time ${panelId === 'team1' ? 1 : 2} atualizado para: ${teamDisplayName}`, "success");
}


/**
 * Configura os event listeners para o modal de seleção de time.
 */
export function setupTeamSelectionModal() {
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

    // Adiciona listeners apenas nos botões discretos
    const team1ChangeButton = document.getElementById('team1-change-button');
    const team2ChangeButton = document.getElementById('team2-change-button');
    
    // NOVO: Força atualização dos ícones
    if (team1ChangeButton) {
        const icon1 = team1ChangeButton.querySelector('.material-icons');
        if (icon1) icon1.textContent = 'cached';
    }
    if (team2ChangeButton) {
        const icon2 = team2ChangeButton.querySelector('.material-icons');
        if (icon2) icon2.textContent = 'cached';
    }
    
    // NOVO: Adiciona stopPropagation para evitar pontuação
    if (team1ChangeButton) {
        team1ChangeButton.addEventListener('click', (event) => {
            event.stopPropagation();
            event.preventDefault();
            openTeamSelectionModal('team1');
        });
        team1ChangeButton.addEventListener('touchend', (event) => {
            event.stopPropagation();
            event.preventDefault();
        });
    }
    
    if (team2ChangeButton) {
        team2ChangeButton.addEventListener('click', (event) => {
            event.stopPropagation();
            event.preventDefault();
            openTeamSelectionModal('team2');
        });
        team2ChangeButton.addEventListener('touchend', (event) => {
            event.stopPropagation();
            event.preventDefault();
        });
    }

    }

function handleScoreTouch(event, teamId) {
    if (event.type === 'touchstart') {
        touchStartY = event.touches[0].clientY;
        // Marca se o toque iniciou no botão de inverter lados
        const targetEl = event.target;
        touchStartedOnSwap = !!(targetEl && targetEl.closest && targetEl.closest('#swap-teams-button'));
        return;
    }

    if (event.type === 'touchend') {
        const touchEndY = event.changedTouches[0].clientY;
        const deltaY = touchEndY - touchStartY;

        const targetElement = event.target;
        // Se o toque começou no botão de inverter, não pontua
        if (touchStartedOnSwap) {
            touchStartedOnSwap = false;
            return;
        }
        // NOVO: Evita pontuação quando clicar em elementos interativos (exceto o nome do time)
        if (
            targetElement.closest('.team-players-column') ||
            targetElement.closest('.team-change-button') ||
            targetElement.closest('#team1-change-button') ||
            targetElement.closest('#team2-change-button') ||
            targetElement.closest('#swap-teams-button')
        ) {
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
            // Log removido
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



// Função para atualizar contador de jogadores selecionados na tela de times
export function updateSelectedPlayersCount() {
    const selectedPlayersCountElement = document.getElementById('selected-players-count');
    if (selectedPlayersCountElement) {
        // Obter dados dos jogadores do localStorage
        const players = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
        const totalCount = players.length;
        
        // Contar jogadores selecionados de todas as categorias
        let selectedCount = 0;
        ['principais', 'esporadicos', 'random'].forEach(category => {
            const categorySelections = localStorage.getItem(`selectedPlayers_${category}`);
            if (categorySelections) {
                const ids = JSON.parse(categorySelections);
                selectedCount += ids.length;
            }
        });
        
        selectedPlayersCountElement.textContent = `${selectedCount}/${totalCount}`;
    }
}

// Função para mostrar modal de seleção de categoria
function showCategorySelectionModal(playerName, appId) {
    const modal = document.getElementById('category-selection-modal');
    const messageElement = document.getElementById('category-selection-message');
    
    if (!modal || !messageElement) return;
    
    messageElement.textContent = `Em qual categoria deseja adicionar "${playerName}"?`;
    modal.classList.add('active');
    
    // Remove listeners antigos
    const buttons = modal.querySelectorAll('.category-selection-buttons .button');
    buttons.forEach(btn => {
        btn.replaceWith(btn.cloneNode(true));
    });
    
    // Adiciona novos listeners
    document.getElementById('category-principais-btn').addEventListener('click', () => {
        addPlayerWithCategory(playerName, 'principais', appId);
        hideCategorySelectionModal();
    });
    
    document.getElementById('category-esporadicos-btn').addEventListener('click', () => {
        addPlayerWithCategory(playerName, 'esporadicos', appId);
        hideCategorySelectionModal();
    });
    
    document.getElementById('category-random-btn').addEventListener('click', () => {
        addPlayerWithCategory(playerName, 'random', appId);
        hideCategorySelectionModal();
    });
}

// Função para esconder modal de seleção de categoria
function hideCategorySelectionModal() {
    const modal = document.getElementById('category-selection-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Função para adicionar jogador com categoria
async function addPlayerWithCategory(playerName, category, appId) {
    try {
        let db = null;
        if (navigator.onLine) {
            const { getFirestoreDb } = await import('../firebase/config.js');
            db = getFirestoreDb();
        }
        
        await addPlayer(db, appId, playerName, null, true, category);
        displayMessage(`Jogador "${playerName}" adicionado em ${getCategoryDisplayName(category)}!`, "success");
    } catch (error) {
        // Log removido
        displayMessage("Erro ao adicionar jogador. Tente novamente.", "error");
    }
}

// Função para obter nome de exibição da categoria
function getCategoryDisplayName(category) {
    const categoryNames = {
        'principais': 'Principais',
        'esporadicos': 'Esporádicos', 
        'random': 'Random'
    };
    return categoryNames[category] || category;
}

// NOVO: Função para forçar atualização dos ícones
export function forceUpdateIcons() {
    const team1Btn = document.getElementById('team1-change-button');
    const team2Btn = document.getElementById('team2-change-button');
    
    if (team1Btn) {
        const icon1 = team1Btn.querySelector('.material-icons');
        if (icon1) {
            icon1.textContent = 'cached';
            icon1.style.fontFamily = 'Material Icons';
        }
    }
    
    if (team2Btn) {
        const icon2 = team2Btn.querySelector('.material-icons');
        if (icon2) {
            icon2.textContent = 'cached';
            icon2.style.fontFamily = 'Material Icons';
        }
    }
    
    // Log removido
}

// NOVO: Proteção contra toasts duplicados de RSVP
let lastRSVPToastAt = 0;

// Listener para eventos de RSVP vindos das notificações push
window.addEventListener('schedule-rsvp', async (event) => {
    const now = Date.now();
    if (now - lastRSVPToastAt < 800) {
        return; // Evita duplicar toast se outro listener já mostrou recentemente
    }

    const { action, scheduleId, data, playerName } = event.detail;

    // Construir resposta textual
    const resposta = action === 'going' ? 'Vou' : action === 'not_going' ? 'Não vou' : 'Talvez';

    // Construir mensagem amigável
    let detalhes = '';
    if (data && (data.location || data.startTime || data.date)) {
        const partes = [];
        if (data.date) partes.push(`📅 ${data.date}`);
        if (data.startTime) partes.push(`às ${data.startTime}`);
        if (data.location) partes.push(`📍 ${data.location}`);
        detalhes = partes.length ? ` — ${partes.join(' ')}` : '';
    }
    const jogador = playerName ? ` • Jogador: ${playerName}` : '';

    displayMessage(`Resposta registrada: ${resposta}${detalhes}${jogador}`, 'success');
    lastRSVPToastAt = now;

    // Persistir últimos dados de RSVP para possíveis reusos
    try {
        const user = (typeof getCurrentUser === 'function') ? getCurrentUser() : null;
        const storedPlayer = user && user.displayName ? user.displayName : (user && user.email ? user.email : null);
        const rsvpData = {
            action,
            scheduleId,
            data,
            playerName: playerName || storedPlayer
        };
        sessionStorage.setItem('lastRSVPData', JSON.stringify(rsvpData));
        //console.log('[DEBUG RSVP] RSVP salvo em sessionStorage:', rsvpData);
    } catch(e) {
        //console.error('[DEBUG RSVP] Erro ao salvar RSVP:', e);
    }
});


window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
        showPage(hash);
    }
});

// Executa na inicialização para respeitar o hash inicial
const initialHash = window.location.hash.replace('#', '');
if (initialHash) {
    showPage(initialHash);
}