// js/ui/game-ui.js
// Lógica de interface para a tela de jogo (placares, timer, times).

import * as Elements from './elements.js';
import { formatTime } from '../utils/helpers.js';
import { getIsGameInProgress } from '../game/logic.js';
import { loadConfig } from './config-ui.js'; // Importa loadConfig para obter nomes e cores personalizados

/**
 * Atualiza o placar exibido na tela.
 * @param {number} team1Score - Pontuação do Time 1.
 * @param {number} team2Score - Pontuação do Time 2.
 */
export function updateScoreDisplay(team1Score, team2Score) {
    if (Elements.team1ScoreDisplay()) Elements.team1ScoreDisplay().textContent = team1Score;
    if (Elements.team2ScoreDisplay()) Elements.team2ScoreDisplay().textContent = team2Score;
}

/**
 * Atualiza o display do timer geral.
 * @param {number} timeElapsed - Tempo total decorrido em segundos.
 */
export function updateTimerDisplay(timeElapsed) {
    if (Elements.timerText()) Elements.timerText().textContent = formatTime(timeElapsed);
}

/**
 * Atualiza o display do timer do set.
 * @param {number} setElapsedTime - Tempo decorrido no set atual em segundos.
 */
export function updateSetTimerDisplay(setElapsedTime) {
    if (Elements.setTimerText()) Elements.setTimerText().textContent = formatTime(setElapsedTime);
}

/**
 * Renderiza os nomes dos jogadores para os times na página de pontuação.
 * @param {Array<string>} team1Players - Nomes dos jogadores do Time 1.
 * @param {Array<string>} team2Players - Nomes dos jogadores do Time 2.
 * @param {boolean} shouldDisplayPlayers - Se os jogadores devem ser exibidos.
 */
export function renderScoringPagePlayers(team1Players, team2Players, shouldDisplayPlayers) {
    const team1Column = Elements.team1PlayersColumn();
    const team2Column = Elements.team2PlayersColumn();

    if (!team1Column || !team2Column) {
        console.warn("Elementos de coluna de jogadores não encontrados.");
        return;
    }

    if (!shouldDisplayPlayers) {
        team1Column.innerHTML = '';
        team2Column.innerHTML = '';
        team1Column.style.display = 'none'; // Oculta a coluna inteira
        team2Column.style.display = 'none'; // Oculta a coluna inteira
        return;
    }

    // Se deve exibir, garante que as colunas estejam visíveis
    team1Column.style.display = 'block'; // Ou 'flex', dependendo do layout original
    team2Column.style.display = 'block'; // Ou 'flex'

    const renderPlayers = (columnElement, playersArray) => {
        columnElement.innerHTML = ''; // Limpa antes de renderizar
        const ul = document.createElement('ul');
        playersArray.forEach(player => {
            const li = document.createElement('li');
            li.textContent = player;
            ul.appendChild(li);
        });
        columnElement.appendChild(ul);
    };

    renderPlayers(team1Column, team1Players);
    renderPlayers(team2Column, team2Players);
}

/**
 * Atualiza os nomes e as cores dos times exibidos na UI.
 * @param {string} team1Name - Nome a ser exibido para o Time 1.
 * @param {string} team2Name - Nome a ser exibido para o Time 2.
 * @param {string} team1Color - Cor a ser exibida para o Time 1 (hex).
 * @param {string} team2Color - Cor a ser exibida para o Time 2 (hex).
 */
export function updateTeamDisplayNamesAndColors(team1Name, team2Name, team1Color, team2Color) {
    console.log(`[updateTeamDisplayNamesAndColors] Received: Team1 Name: ${team1Name}, Color: ${team1Color} | Team2 Name: ${team2Name}, Color: ${team2Color}`);

    const team1NameElement = Elements.team1NameDisplay();
    const team2NameElement = Elements.team2NameDisplay();
    const team1PanelElement = Elements.team1Panel();
    const team2PanelElement = Elements.team2Panel();

    if (team1NameElement) {
        team1NameElement.textContent = team1Name;
        console.log(`[updateTeamDisplayNamesAndColors] Team1 Name Element found. Set to: ${team1NameElement.textContent}`);
    } else {
        console.warn("[updateTeamDisplayNamesAndColors] Team1 Name Element not found.");
    }

    if (team2NameElement) {
        team2NameElement.textContent = team2Name;
        console.log(`[updateTeamDisplayNamesAndColors] Team2 Name Element found. Set to: ${team2NameElement.textContent}`);
    } else {
        console.warn("[updateTeamDisplayNamesAndColors] Team2 Name Element not found.");
    }

    if (team1PanelElement) {
        team1PanelElement.style.backgroundColor = team1Color;
        console.log(`[updateTeamDisplayNamesAndColors] Team1 Panel Element found. Set background to: ${team1PanelElement.style.backgroundColor}`);
    } else {
        console.warn("[updateTeamDisplayNamesAndColors] Team1 Panel Element not found.");
    }

    if (team2PanelElement) {
        team2PanelElement.style.backgroundColor = team2Color;
        console.log(`[updateTeamDisplayNamesAndColors] Team2 Panel Element found. Set background to: ${team2PanelElement.style.backgroundColor}`);
    } else {
        console.warn("[updateTeamDisplayNamesAndColors] Team2 Panel Element not found.");
    }
}

/**
 * Atualiza o estado do botão de navegação "Pontuação" (Novo Jogo vs. Pontuação).
 * @param {boolean} isGameInProgress - Se um jogo está em andamento.
 * @param {string} currentPageId - O ID da página atualmente ativa.
 */
export function updateNavScoringButton(isGameInProgress, currentPageId) {
    const navScoringButtonElement = Elements.navScoringButton();
    if (navScoringButtonElement) {
        const iconSpan = navScoringButtonElement.querySelector('.material-icons');
        if (iconSpan) {
            if (isGameInProgress && currentPageId !== 'scoring-page') {
                navScoringButtonElement.innerHTML = `<span class="material-icons sidebar-nav-icon">sports_volleyball</span> Pontuação`;
            } else if (isGameInProgress && currentPageId === 'scoring-page') {
                navScoringButtonElement.innerHTML = `<span class="material-icons sidebar-nav-icon">add_box</span> Novo Jogo`;
            } else {
                navScoringButtonElement.innerHTML = `<span class="material-icons sidebar-nav-icon">sports_volleyball</span> Pontuação`;
            }
        }
    }
}

/**
 * Renderiza os times gerados na grade de times.
 * @param {Array<Object>} teams - Array de objetos de time.
 */
export function renderTeams(teams) {
    const teamsGridLayoutElement = Elements.teamsGridLayout();
    if (!teamsGridLayoutElement) return;

    teamsGridLayoutElement.innerHTML = '';

    const config = loadConfig();
    const defaultColors = ['#325fda', '#f03737', '#28a745', '#ffc107', '#6f42c1', '#17a2b8'];

    teams.forEach((team, index) => {
        const teamCard = document.createElement('div');
        teamCard.className = 'team-card';

        const teamNameKey = `customTeam${index + 1}Name`;
        const teamColorKey = `customTeam${index + 1}Color`;
        const defaultTeamName = `Time ${index + 1}`;
        const teamDisplayName = config[teamNameKey] || defaultTeamName;
        const teamDisplayColor = config[teamColorKey] || defaultColors[index] || '#6c757d';

        teamCard.style.borderLeft = `0.25rem solid ${teamDisplayColor}`;

        const teamTitle = document.createElement('h3');
        teamTitle.className = 'team-card-title';
        teamTitle.textContent = teamDisplayName;
        teamCard.appendChild(teamTitle);

        const teamList = document.createElement('ul');
        teamList.className = 'team-card-list';
        team.players.forEach(player => {
            const playerItem = document.createElement('li');
            playerItem.textContent = player;
            teamList.appendChild(playerItem); 
        });
        teamCard.appendChild(teamList);

        teamsGridLayoutElement.appendChild(teamCard);
    });
}

/**
 * Renderiza os times no modal de seleção.
 * @param {Array<Object>} teams - Array de objetos de time.
 * @param {string} panelId - O ID do painel de time ('team1' ou 'team2') que acionou o modal.
 * @param {function} selectTeamCallback - Função de callback a ser chamada quando um time é selecionado no modal.
 */
export function renderTeamsInModal(teams, panelId, selectTeamCallback) {
    const modalTeamListElement = Elements.modalTeamList();
    if (!modalTeamListElement) {
        console.error("Elemento '#modal-team-list' não encontrado no DOM.");
        return;
    }

    modalTeamListElement.innerHTML = '';

    const config = loadConfig();
    const defaultColors = ['#325fda', '#f03737', '#28a745', '#ffc107', '#6f42c1', '#17a2b8'];

    if (teams.length === 0) {
        const noTeamsMessage = document.createElement('p');
        noTeamsMessage.textContent = "Nenhum time gerado ainda. Vá para a página 'Times' para gerar alguns!";
        noTeamsMessage.style.color = '#D1D5DB';
        noTeamsMessage.style.textAlign = 'center';
        modalTeamListElement.appendChild(noTeamsMessage);
        return;
    }

    teams.forEach((team, index) => {
        const teamModalItem = document.createElement('div');
        teamModalItem.className = 'select-team-list-item';
        teamModalItem.dataset.teamIndex = index;

        const teamNameKey = `customTeam${index + 1}Name`;
        const teamColorKey = `customTeam${index + 1}Color`;
        const defaultTeamName = `Time ${index + 1}`;
        const teamDisplayName = config[teamNameKey] || defaultTeamName;
        const teamDisplayColor = config[teamColorKey] || defaultColors[index] || '#6c757d';

        const colorSpan = document.createElement('span');
        colorSpan.className = 'select-team-color-box';
        colorSpan.style.backgroundColor = teamDisplayColor;
        teamModalItem.appendChild(colorSpan);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'select-team-name';
        nameSpan.textContent = teamDisplayName;
        teamModalItem.appendChild(nameSpan);

        teamModalItem.addEventListener('click', () => {
            selectTeamCallback(index, panelId);
        });

        modalTeamListElement.appendChild(teamModalItem);
    });
}
