// js/ui/game-ui.js
// Lógica de interface para a tela de jogo (placares, timer, times).

import * as Elements from './elements.js';
import { formatTime } from '../utils/helpers.js';
import { getIsGameInProgress } from '../game/logic.js';

/**
 * Atualiza o placar exibido na tela.
 * @param {number} team1Score - Pontuação do Time 1.
 * @param {number} team2Score - Pontuação do Time 2.
 */
export function updateScoreDisplay(team1Score, team2Score) {
    if (Elements.team1ScoreDisplay) Elements.team1ScoreDisplay.textContent = team1Score;
    if (Elements.team2ScoreDisplay) Elements.team2ScoreDisplay.textContent = team2Score;
}

/**
 * Atualiza o display do timer geral.
 * @param {number} timeElapsed - Tempo total decorrido em segundos.
 */
export function updateTimerDisplay(timeElapsed) {
    if (Elements.timerText) Elements.timerText.textContent = formatTime(timeElapsed);
}

/**
 * Atualiza o display do timer do set.
 * @param {number} setElapsedTime - Tempo decorrido no set atual em segundos.
 */
export function updateSetTimerDisplay(setElapsedTime) {
    if (Elements.setTimerText) Elements.setTimerText.textContent = formatTime(setElapsedTime);
}

/**
 * Renderiza os jogadores nas colunas da tela de pontuação.
 * @param {Array<string>} team1 - Nomes dos jogadores do Time 1.
 * @param {Array<string>} team2 - Nomes dos jogadores do Time 2.
 */
export function renderScoringPagePlayers(team1, team2) {
    if (Elements.team1PlayersScoringTop) {
        Elements.team1PlayersScoringTop.innerHTML = '';
        team1.forEach(player => {
            const li = document.createElement('li');
            li.textContent = player;
            Elements.team1PlayersScoringTop.appendChild(li);
        });
    }

    if (Elements.team2PlayersScoringTop) {
        Elements.team2PlayersScoringTop.innerHTML = '';
        team2.forEach(player => {
            const li = document.createElement('li');
            li.textContent = player;
            Elements.team2PlayersScoringTop.appendChild(li);
        });
    }

    const shouldDisplayPlayers = Elements.displayPlayersToggle ? Elements.displayPlayersToggle.checked : true;

    if (Elements.teamPlayersColumnGroup) {
        if ((team1.length > 0 || team2.length > 0) && shouldDisplayPlayers) {
            Elements.teamPlayersColumnGroup.style.display = 'flex';
        } else {
            Elements.teamPlayersColumnGroup.style.display = 'none';
        }
    }
    if (Elements.team1PlayersColumn) Elements.team1PlayersColumn.style.display = 'block';
    if (Elements.team2PlayersColumn) Elements.team2PlayersColumn.style.display = 'block';
}

/**
 * Atualiza os nomes e cores dos times exibidos na tela de pontuação.
 * @param {string} team1Name - Nome do Time 1.
 * @param {string} team2Name - Nome do Time 2.
 * @param {string} team1Color - Cor do Time 1.
 * @param {string} team2Color - Cor do Time 2.
 */
export function updateTeamDisplayNamesAndColors(team1Name, team2Name, team1Color, team2Color) {
    if (Elements.team1NameDisplay) Elements.team1NameDisplay.textContent = team1Name;
    if (Elements.team2NameDisplay) Elements.team2NameDisplay.textContent = team2Name;

    if (Elements.team1Panel) Elements.team1Panel.style.backgroundColor = team1Color;
    if (Elements.team2Panel) Elements.team2Panel.style.backgroundColor = team2Color;
}

/**
 * Atualiza o texto do botão de navegação "Pontuação" para "Novo Jogo" se o jogo estiver em progresso.
 * @param {boolean} isGameInProgress - Indica se o jogo está em progresso.
 */
export function updateNavScoringButton(isGameInProgress) {
    const isScoringPageActive = Elements.scoringPage.classList.contains('app-page--active');
    if (isGameInProgress && isScoringPageActive) {
        Elements.navScoringButton.innerHTML = '<span class="material-icons sidebar-nav-icon">add_circle</span> Novo Jogo';
    } else {
        Elements.navScoringButton.innerHTML = '<span class="material-icons sidebar-nav-icon">sports_volleyball</span> Pontuação';
    }
}

/**
 * Renderiza os times na grade de layout de times.
 * @param {Array<Array<string>>} teams - Array de arrays de nomes de jogadores, representando os times.
 * @param {HTMLElement} teamsGridLayout - O elemento DOM onde os times serão renderizados.
 */
export function renderTeams(teams, teamsGridLayout) {
    if (!teamsGridLayout) return;
    teamsGridLayout.innerHTML = '';

    const config = JSON.parse(localStorage.getItem('volleyballConfig')) || {};

    teams.forEach((team, index) => {
        const teamCard = document.createElement('div');
        teamCard.className = 'team-card';

        const teamNameKey = `customTeam${index + 1}Name`;
        const teamColorKey = `customTeam${index + 1}Color`;
        const defaultTeamName = `Time ${index + 1}`;
        const defaultTeamColor = (index % 2 === 0) ? '#325fda' : '#f03737';

        const teamDisplayName = config[teamNameKey] || defaultTeamName;
        const teamDisplayColor = config[teamColorKey] || defaultTeamColor;

        if (index === 0) {
            teamCard.classList.add('team-card--blue-border');
        } else if (index === 1) {
            teamCard.classList.add('team-card--red-border');
        } else {
            teamCard.style.borderLeft = `0.25rem solid ${teamDisplayColor}`;
        }
        teamCard.style.borderLeftColor = teamDisplayColor;


        const teamTitle = document.createElement('h3');
        teamTitle.className = 'team-card-title';
        teamTitle.textContent = teamDisplayName;
        teamCard.appendChild(teamTitle);

        const teamList = document.createElement('ul');
        teamList.className = 'team-card-list';
        team.forEach(player => {
            const li = document.createElement('li');
            li.textContent = player;
            teamList.appendChild(li);
        });
        teamCard.appendChild(teamList);

        teamsGridLayout.appendChild(teamCard);
    });
}
