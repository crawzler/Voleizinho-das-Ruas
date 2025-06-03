// js/ui/pages.js
// Gerencia a exibição de páginas e a navegação principal.

import * as Elements from './elements.js';
import { getIsGameInProgress, resetGameForNewMatch, getCurrentTeam1, getCurrentTeam2, getActiveTeam1Name, getActiveTeam2Name, getActiveTeam1Color, getActiveTeam2Color, incrementScore, decrementScore } from '../game/logic.js';
import { updateScoreDisplay, updateTimerDisplay, updateSetTimerDisplay, renderScoringPagePlayers, updateTeamDisplayNamesAndColors, updateNavScoringButton, renderTeams } from './game-ui.js';
import { loadConfig, saveConfig } from './config-ui.js';
import { renderPlayersList, updatePlayerCount, updateSelectAllToggle } from './players-ui.js';
import { getCurrentUser } from '../firebase/auth.js';
import { addPlayer, removePlayer } from '../data/players.js';
import { openTeamSelectionModal, closeTeamSelectionModal } from '../game/teams.js';


let selectingTeamPanelId = null;
let touchStartY = 0;
const DRAG_THRESHOLD = 30;

/**
 * Exibe uma página específica e esconde as outras.
 * @param {string} pageIdToShow - O ID da página a ser exibida.
 */
export function showPage(pageIdToShow) {
    console.log(`[showPage] Tentando exibir a página: ${pageIdToShow}`); // Log para depuração
    Elements.pages.forEach(page => {
        if (page.id === pageIdToShow) {
            page.classList.add('app-page--active');
            console.log(`[showPage] Página '${pageIdToShow}' ativada.`); // Log de sucesso
        } else {
            page.classList.remove('app-page--active');
        }
    });

    const pageToShow = document.getElementById(pageIdToShow);
    if (pageToShow) {
        window.scrollTo(0, 0); // Volta para o topo da página
    } else {
        console.warn(`[showPage] Página com ID '${pageIdToShow}' não encontrada.`); // Log de aviso
    }

    // Atualiza o estado do botão de navegação da página de pontuação
    updateNavScoringButton(pageIdToShow === 'scoring-page');

    // Fecha o sidebar ao navegar
    Elements.sidebar.classList.remove('active');
}

/**
 * Configura os event listeners para o sidebar.
 */
export function setupSidebar() {
    if (Elements.menuButton) {
        Elements.menuButton.addEventListener('click', () => {
            Elements.sidebar.classList.add('active');
        });
    }

    if (Elements.closeSidebarButton) {
        Elements.closeSidebarButton.addEventListener('click', () => {
            Elements.sidebar.classList.remove('active');
        });
    }
}

/**
 * Configura a navegação entre as páginas do aplicativo.
 * @param {Function} startGameCallback - Callback para iniciar o jogo.
 * @param {Function} getPlayersCallback - Callback para obter a lista de jogadores.
 * @param {Function} logoutCallback - Callback para fazer logout.
 */
export function setupPageNavigation(startGameCallback, getPlayersCallback, logoutCallback) {
    Elements.sidebarNavItems.forEach(item => {
        item.addEventListener('click', async () => {
            const pageId = item.id.replace('nav-', ''); // Ex: 'nav-scoring' -> 'scoring'
            console.log(`[setupPageNavigation] Botão clicado: ${item.id}, pageId: ${pageId}`);

            const currentUser = getCurrentUser();
            console.log(`[setupPageNavigation] Usuário atual: ${currentUser ? currentUser.uid : 'Nenhum'}, Anônimo: ${currentUser ? currentUser.isAnonymous : 'N/A'}`);


            // Lógica específica para o botão de logout
            if (pageId === 'logout') {
                logoutCallback();
                return; // Sai da função após o logout
            }

            // Se o usuário NÃO estiver logado (ou for anônimo) e tentar acessar uma página
            // que não seja a de login ou configurações ou início, redireciona para a página de login.
            if (!currentUser || currentUser.isAnonymous) {
                if (pageId !== 'login' && pageId !== 'config' && pageId !== 'start') {
                    console.warn(`[setupPageNavigation] Acesso negado para usuário anônimo à página '${pageId}'. Redirecionando para login.`);
                    showPage('login-page');
                    return;
                }
            }

            // Lógica para carregar dados e renderizar UI específica de cada página
            switch (pageId) {
                case 'scoring':
                    if (!getIsGameInProgress()) {
                        resetGameForNewMatch(); // Reseta o jogo apenas se não houver um em progresso
                    }
                    // Garante que os nomes e cores dos times estejam atualizados no placar
                    updateTeamDisplayNamesAndColors(getActiveTeam1Name(), getActiveTeam2Name(), getActiveTeam1Color(), getActiveTeam2Color());
                    renderScoringPagePlayers(getCurrentTeam1(), getCurrentTeam2());
                    updateScoreDisplay(0, 0); // Garante que o placar seja 0-0 ao iniciar
                    updateTimerDisplay(0);
                    updateSetTimerDisplay(0);
                    break;
                case 'teams':
                    const players = getPlayersCallback(); // Obtém a lista de jogadores
                    const config = loadConfig();
                    renderTeams([], players, config); // Renderiza times vazios ou previamente gerados
                    break;
                case 'players':
                    // A lista de jogadores é carregada e renderizada via listener do Firestore em auth.js/players.js
                    // Apenas garante que a UI de jogadores esteja pronta
                    updatePlayerModificationAbility(currentUser ? currentUser.isAnonymous : true); // Atualiza o estado dos botões
                    break;
                case 'config':
                    loadConfig(); // Carrega as configurações para preencher os inputs
                    break;
                case 'history':
                    // Lógica para carregar histórico
                    break;
                case 'scheduling':
                    // Lógica para agendamentos
                    break;
                case 'stats':
                    // Lógica para estatísticas
                    break;
                case 'start':
                    // Nada específico, apenas mostra a página
                    break;
            }
            showPage(`${pageId}-page`);
        });
    });
}

/**
 * Habilita ou desabilita a capacidade de modificar jogadores (adicionar/remover/selecionar).
 * Isso é usado para restringir usuários anônimos.
 * @param {boolean} disable - Se true, desabilita a modificação; se false, habilita.
 */
export function updatePlayerModificationAbility(disable) {
    if (Elements.addPlayerButton) Elements.addPlayerButton.disabled = disable;
    if (Elements.newPlayerNameInput) Elements.newPlayerNameInput.disabled = disable;
    if (Elements.selectAllPlayersToggle) Elements.selectAllPlayersToggle.disabled = disable;

    const removeButtons = document.querySelectorAll('.remove-player-button');
    removeButtons.forEach(button => {
        button.disabled = disable;
    });

    const checkboxes = document.querySelectorAll('.player-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.disabled = disable;
    });
}


/**
 * Configura os event listeners para os acordeões na página de configurações.
 */
export function setupAccordion() {
    Elements.accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const accordionItem = header.closest('.accordion-item');
            if (accordionItem) {
                accordionItem.classList.toggle('active');
            }
        });
    });
}

/**
 * Configura os event listeners para o modal de seleção de time.
 */
export function setupTeamSelectionModal() {
    if (Elements.closeModalButton) {
        Elements.closeModalButton.addEventListener('click', closeTeamSelectionModal);
    }

    if (Elements.selectTeam1Button) {
        Elements.selectTeam1Button.addEventListener('click', () => openTeamSelectionModal('team1-players-column'));
    }

    if (Elements.selectTeam2Button) {
        Elements.selectTeam2Button.addEventListener('click', () => openTeamSelectionModal('team2-players-column'));
    }
}

let scoreClickTimeout;
let touchCount = 0;
let lastTouchTime = 0;

/**
 * Configura as interações de pontuação (clique e deslize) nos painéis dos times.
 */
export function setupScoreInteractions() {
    if (Elements.team1Panel) {
        Elements.team1Panel.addEventListener('click', (event) => handleScoreInteraction(event, 'team1-panel'));
        Elements.team1Panel.addEventListener('touchstart', (event) => handleScoreInteraction(event, 'team1-panel'), { passive: false });
        Elements.team1Panel.addEventListener('touchend', (event) => handleScoreInteraction(event, 'team1-panel'), { passive: false });
    }

    if (Elements.team2Panel) {
        Elements.team2Panel.addEventListener('click', (event) => handleScoreInteraction(event, 'team2-panel'));
        Elements.team2Panel.addEventListener('touchstart', (event) => handleScoreInteraction(event, 'team2-panel'), { passive: false });
        Elements.team2Panel.addEventListener('touchend', (event) => handleScoreInteraction(event, 'team2-panel'), { passive: false });
    }
}

/**
 * Lida com as interações de clique/toque para pontuação.
 * @param {Event} event - O evento de clique ou toque.
 * @param {string} teamId - O ID do painel do time.
 */
function handleScoreInteraction(event, teamId) {
    event.stopPropagation();

    if (event.type === 'touchstart') {
        touchStartY = event.touches[0].clientY;
        event.preventDefault();
        return;
    }

    if (event.type === 'touchend') {
        const touchEndY = event.changedTouches[0].clientY;
        const deltaY = touchEndY - touchStartY;

        if (Math.abs(deltaY) > DRAG_THRESHOLD) {
            if (deltaY > 0) { // Deslize para baixo
                decrementScore(teamId);
            } else { // Deslize para cima
                incrementScore(teamId);
            }
        } else { // Toque (tap)
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTouchTime;

            if (tapLength < 300 && tapLength > 0) { // Double tap
                clearTimeout(scoreClickTimeout);
                decrementScore(teamId);
                touchCount = 0;
                lastTouchTime = 0;
            } else { // Single tap
                touchCount = 1;
                lastTouchTime = currentTime;
                scoreClickTimeout = setTimeout(() => {
                    if (touchCount === 1) {
                        incrementScore(teamId);
                    }
                    touchCount = 0;
                    lastTouchTime = 0;
                }, 300);
            }
        }
    } else if (event.type === 'click') {
        // Para cliques normais (mouse), apenas incrementa.
        // A lógica de double click para decremento é tratada no touchend para consistência.
        incrementScore(teamId);
    }
}
