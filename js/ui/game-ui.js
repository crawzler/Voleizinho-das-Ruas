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
 * @param {Array<string>} team1Players - Nomes dos jogadores do Time 1.
 * @param {Array<string>} team2Players - Nomes dos jogadores do Time 2.
 */
export function renderScoringPagePlayers(team1Players, team2Players) {
    const team1Column = document.getElementById('team1-players-column');
    const team2Column = document.getElementById('team2-players-column');
    const config = loadConfig(); // Carrega a configuração para verificar displayPlayers

    if (!team1Column || !team2Column) {
        console.warn('[renderScoringPagePlayers] Elementos de coluna de jogadores não encontrados.');
        return;
    }

    // Se ambas as listas de jogadores estiverem vazias, oculta as colunas completamente.
    if (team1Players.length === 0 && team2Players.length === 0) {
        team1Column.innerHTML = '';
        team2Column.innerHTML = '';
        team1Column.style.display = 'none';
        team2Column.style.display = 'none';
        console.log('[renderScoringPagePlayers] Times vazios, colunas de jogadores ocultas.');
        return; // Sai da função, pois não há jogadores para renderizar
    }

    // Caso contrário, renderiza os jogadores com base na configuração 'displayPlayers'
    if (config.displayPlayers) {
        team1Column.innerHTML = `<ul>${team1Players.map(p => `<li>${p}</li>`).join('')}</ul>`;
        team2Column.innerHTML = `<ul>${team2Players.map(p => `<li>${p}</li>`).join('')}</ul>`;
        team1Column.style.display = 'block'; // Mostra a coluna
        team2Column.style.display = 'block'; // Mostra a coluna
        console.log('[renderScoringPagePlayers] Colunas de jogadores definidas como "block".');
    } else {
        // Se a configuração displayPlayers estiver desativada, esconde as colunas
        team1Column.innerHTML = '';
        team2Column.innerHTML = '';
        team1Column.style.display = 'none';
        team2Column.style.display = 'none';
        console.log('[renderScoringPagePlayers] Colunas de jogadores definidas como "none" (configuração desativada).');
    }
}

/**
 * Atualiza os nomes e cores dos times exibidos no placar.
 * @param {string} team1Name - Nome do Time 1.
 * @param {string} team2Name - Nome do Time 2.
 * @param {string} team1Color - Cor do Time 1 (hex).
 * @param {string} team2Color - Cor do Time 2 (hex).
 */
export function updateTeamDisplayNamesAndColors(team1Name, team2Name, team1Color, team2Color) {
    if (Elements.team1NameDisplay) Elements.team1NameDisplay.textContent = team1Name;
    if (Elements.team2NameDisplay) Elements.team2NameDisplay.textContent = team2Name;

    if (Elements.team1Panel) Elements.team1Panel.style.backgroundColor = team1Color;
    if (Elements.team2Panel) Elements.team2Panel.style.backgroundColor = team2Color;
}

/**
 * Atualiza o estado do botão de navegação para a página de pontuação
 * e a visibilidade do timer.
 * @param {boolean} isGameInProgress - Se o jogo está em andamento.
 * @param {string} currentPageId - O ID da página atualmente ativa.
 */
export function updateNavScoringButton(isGameInProgress, currentPageId) {
    if (Elements.navScoringButton) {
        if (isGameInProgress && currentPageId === 'scoring-page') {
            Elements.navScoringButton.classList.add('active-game'); // Adiciona uma classe para indicar jogo em andamento
            // Atualiza o texto e o ícone do botão para "Novo Jogo"
            Elements.navScoringButton.innerHTML = '<span class="material-icons sidebar-nav-icon">refresh</span> Novo Jogo';
        } else {
            Elements.navScoringButton.classList.remove('active-game');
            // Reverte o texto e o ícone do botão para "Pontuação"
            Elements.navScoringButton.innerHTML = '<span class="material-icons sidebar-nav-icon">sports_volleyball</span> Pontuação';
        }
    }
    // Controla a visibilidade do wrapper do timer
    updateTimerWrapperVisibility(isGameInProgress);
}

/**
 * Controla a visibilidade do wrapper do timer.
 * @param {boolean} isVisible - True para mostrar, false para esconder.
 */
function updateTimerWrapperVisibility(isVisible) {
    console.log('DEBUG: updateTimerWrapperVisibility chamada com isVisible:', isVisible);
    // Garante que o elemento seja selecionado novamente para ter a referência mais atualizada
    const timerWrapper = document.querySelector('.timer-and-set-timer-wrapper');
    if (timerWrapper) {
        timerWrapper.style.display = isVisible ? 'flex' : 'none';
        console.log('DEBUG: timerAndSetTimerWrapper display set to:', timerWrapper.style.display);
    } else {
        console.log('DEBUG: Elements.timerAndSetTimerWrapper é nulo ou indefinido.');
    }
}

/**
 * Renderiza os times gerados na página de times.
 * @param {Array<Object>} generatedTeams - Array de objetos de time.
 */
export function renderTeams(generatedTeams) {
    if (!Elements.teamsGridLayout) return;

    Elements.teamsGridLayout.innerHTML = ''; // Limpa o layout existente

    if (generatedTeams.length === 0) {
        Elements.teamsGridLayout.innerHTML = '<p class="text-gray-400 text-center">Nenhum time gerado ainda. Selecione jogadores e clique em "Gerar Times".</p>';
        return;
    }

    const config = loadConfig(); // Carrega a configuração para nomes e cores personalizados

    generatedTeams.forEach((team, index) => {
        const teamCard = document.createElement('div');
        teamCard.className = 'team-card';

        // Pega nomes e cores personalizados das configurações, ou usa padrões
        const teamNameKey = `customTeam${index + 1}Name`;
        const teamColorKey = `customTeam${index + 1}Color`;
        const defaultTeamName = `Time ${index + 1}`;
        // Cores padrão para os primeiros times, se não configuradas
        const defaultColors = ['#325fda', '#f03737', '#28a745', '#ffc107', '#6f42c1', '#17a2b8'];
        const defaultTeamColor = defaultColors[index] || '#6c757d'; // Cor padrão genérica se exceder 6 times

        const teamDisplayName = config[teamNameKey] || defaultTeamName;
        const teamDisplayColor = config[teamColorKey] || defaultTeamColor;

        // Aplica a cor da borda esquerda do card
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

        Elements.teamsGridLayout.appendChild(teamCard);
    });
}
