// js/game/logic.js
// Contém a lógica principal do jogo: pontuação, timer e gerenciamento de estado.

import { updateScoreDisplay, updateTimerDisplay, updateSetTimerDisplay, renderScoringPagePlayers, updateTeamDisplayNamesAndColors, updateNavScoringButton } from '../ui/game-ui.js';
import { getPlayers } from '../data/players.js';
import { shuffleArray } from '../utils/helpers.js';
import { loadConfig } from '../ui/config-ui.js'; // Importa loadConfig para obter playersPerTeam

let team1Score = 0;
let team2Score = 0;
let timerInterval = null;
let timeElapsed = 0;
let isTimerRunning = false;
let setElapsedTime = 0;
let setTimerInterval = null;
let currentTeam1 = [];
let currentTeam2 = [];
let isGameInProgress = false;
let allGeneratedTeams = []; // Mover para cá, pois é estado do jogo

let activeTeam1Name = 'Time 1';
let activeTeam2Name = 'Time 2';
let activeTeam1Color = '#325fda';
let activeTeam2Color = '#f03737';

/**
 * Inicia uma nova partida.
 * @param {string} appId - O ID do aplicativo.
 */
export function startGame(appId) {
    isGameInProgress = true;
    team1Score = 0;
    team2Score = 0;
    timeElapsed = 0;
    setElapsedTime = 0;
    updateTimerDisplay(timeElapsed);
    updateSetTimerDisplay(setElapsedTime);
    toggleTimer(true); // Inicia o timer automaticamente

    // Gerar times se houver jogadores selecionados, ou usar times padrão
    const players = getPlayers(); // Obtém a lista atual de jogadores
    const selectedPlayerElements = document.querySelectorAll('#players-list-container .player-checkbox:checked');
    const selectedPlayerIds = Array.from(selectedPlayerElements).map(checkbox => checkbox.dataset.playerId);
    const selectedPlayersNames = players
        .filter(player => selectedPlayerIds.includes(player.id))
        .map(player => player.name);

    if (selectedPlayersNames.length >= 2) { // Se houver pelo menos 2 jogadores selecionados
        allGeneratedTeams = []; // Limpa times gerados anteriores
        const config = loadConfig(); // Carrega configurações para playersPerTeam
        const playersPerTeam = parseInt(config.playersPerTeam) || 4;

        const shuffledPlayers = [...selectedPlayersNames];
        shuffleArray(shuffledPlayers);

        let teamCount = 0;
        for (let i = 0; i < shuffledPlayers.length; i++) {
            if (i % playersPerTeam === 0) {
                allGeneratedTeams.push([]);
                teamCount++;
            }
            allGeneratedTeams[teamCount - 1].push(shuffledPlayers[i]);
        }
        currentTeam1 = allGeneratedTeams[0] || [];
        currentTeam2 = allGeneratedTeams[1] || [];
    } else {
        currentTeam1 = [];
        currentTeam2 = [];
        allGeneratedTeams = []; // Garante que esteja vazio se não há times gerados
    }

    const config = loadConfig();
    activeTeam1Name = config.customTeam1Name || 'Time 1';
    activeTeam2Name = config.customTeam2Name || 'Time 2';
    activeTeam1Color = config.customTeam1Color || '#325fda';
    activeTeam2Color = config.customTeam2Color || '#f03737';

    updateScoreDisplay(team1Score, team2Score); // Atualiza o placar inicial
    renderScoringPagePlayers(currentTeam1, currentTeam2);
    updateTeamDisplayNamesAndColors(activeTeam1Name, activeTeam2Name, activeTeam1Color, activeTeam2Color);

    // Mudar para a página de pontuação
    document.getElementById('scoring-page').classList.add('app-page--active');
    document.getElementById('scoring-page').style.display = 'flex';
    document.getElementById('start-page').classList.remove('app-page--active');
    document.getElementById('start-page').style.display = 'none';

    updateNavScoringButton(isGameInProgress);
}


/**
 * Alterna o estado do timer (iniciar/pausar).
 * @param {boolean} [forceStart=false] - Se true, força o timer a iniciar.
 */
export function toggleTimer(forceStart = false) {
    const timerToggleButton = document.querySelector('.timer-toggle-button');
    const timerWrapper = document.querySelector('.timer-wrapper');

    if (isTimerRunning && !forceStart) { // Se estiver rodando e não for para forçar o início
        clearInterval(timerInterval);
        clearInterval(setTimerInterval);
        timerInterval = null;
        setTimerInterval = null;
        timerToggleButton.innerHTML = '<span class="material-icons">play_arrow</span>';
    } else if (!isTimerRunning) { // Se não estiver rodando
        timerInterval = setInterval(() => {
            timeElapsed++;
            updateTimerDisplay(timeElapsed);
        }, 1000);
        setTimerInterval = setInterval(() => {
            setElapsedTime++;
            updateSetTimerDisplay(setElapsedTime);
        }, 1000);
        timerToggleButton.innerHTML = '<span class="material-icons">pause</span>';
        if (timerWrapper) timerWrapper.style.display = 'flex'; // Garante que o timer esteja visível
    }
    isTimerRunning = !isTimerRunning;
    updateNavScoringButton(isGameInProgress);
}

/**
 * Incrementa a pontuação do time especificado.
 * @param {string} teamId - O ID do painel do time ('team1-panel' ou 'team2-panel').
 */
export function incrementScore(teamId) {
    if (teamId === 'team1-panel') {
        team1Score++;
    } else {
        team2Score++;
    }
    updateScoreDisplay(team1Score, team2Score);
}

/**
 * Decrementa a pontuação do time especificado (mínimo 0).
 * @param {string} teamId - O ID do painel do time ('team1-panel' ou 'team2-panel').
 */
export function decrementScore(teamId) {
    if (teamId === 'team1-panel' && team1Score > 0) {
        team1Score--;
    } else if (teamId === 'team2-panel' && team2Score > 0) {
        team2Score--;
    }
    updateScoreDisplay(team1Score, team2Score);
}

/**
 * Troca os times ativos e seus placares.
 */
export function swapTeams() {
    [team1Score, team2Score] = [team2Score, team1Score];
    updateScoreDisplay(team1Score, team2Score);

    [currentTeam1, currentTeam2] = [currentTeam2, currentTeam1];
    [activeTeam1Name, activeTeam2Name] = [activeTeam2Name, activeTeam1Name];
    [activeTeam1Color, activeTeam2Color] = [activeTeam2Color, activeTeam1Color];

    renderScoringPagePlayers(currentTeam1, currentTeam2);
    updateTeamDisplayNamesAndColors(activeTeam1Name, activeTeam2Name, activeTeam1Color, activeTeam2Color);
}

/**
 * Gera novos times com base nos jogadores selecionados.
 * @param {string} appId - O ID do aplicativo.
 */
export function generateTeams(appId) {
    const players = getPlayers(); // Obtém a lista atual de jogadores
    const selectedPlayerElements = document.querySelectorAll('#players-list-container .player-checkbox:checked');
    const selectedPlayerIds = Array.from(selectedPlayerElements).map(checkbox => checkbox.dataset.playerId);

    const selectedPlayersNames = players
        .filter(player => selectedPlayerIds.includes(player.id))
        .map(player => player.name);

    if (selectedPlayersNames.length < 1) {
        console.warn('Por favor, selecione pelo menos 1 jogador para gerar times.');
        return;
    }

    const shuffledPlayers = [...selectedPlayersNames];
    shuffleArray(shuffledPlayers);

    const config = loadConfig();
    const playersPerTeam = parseInt(config.playersPerTeam) || 4;

    allGeneratedTeams = [];
    let teamCount = 0;
    for (let i = 0; i < shuffledPlayers.length; i++) {
        if (i % playersPerTeam === 0) {
            allGeneratedTeams.push([]);
            teamCount++;
        }
        allGeneratedTeams[teamCount - 1].push(shuffledPlayers[i]);
    }

    currentTeam1 = allGeneratedTeams[0] || [];
    currentTeam2 = allGeneratedTeams[1] || [];

    const configLoaded = loadConfig();
    activeTeam1Name = configLoaded[`customTeam1Name`] || `Time 1`;
    activeTeam1Color = configLoaded[`customTeam1Color`] || '#325fda';
    activeTeam2Name = configLoaded[`customTeam2Name`] || `Time 2`;
    activeTeam2Color = configLoaded[`customTeam2Color`] || '#f03737';

    // Chama a função de UI para renderizar os times
    const teamsGridLayout = document.getElementById('teams-grid-layout');
    if (teamsGridLayout) {
        renderTeams(allGeneratedTeams, teamsGridLayout);
    }
    renderScoringPagePlayers(currentTeam1, currentTeam2);
    updateTeamDisplayNamesAndColors(activeTeam1Name, activeTeam2Name, activeTeam1Color, activeTeam2Color);
}

/**
 * Retorna o estado de jogo atual.
 * @returns {boolean} True se o jogo estiver em progresso, false caso contrário.
 */
export function getIsGameInProgress() {
    return isGameInProgress;
}

/**
 * Define o estado de jogo.
 * @param {boolean} state - O novo estado do jogo.
 */
export function setIsGameInProgress(state) {
    isGameInProgress = state;
}

/**
 * Retorna os times gerados atualmente.
 * @returns {Array<Array<string>>} A lista de times gerados.
 */
export function getAllGeneratedTeams() {
    return allGeneratedTeams;
}

/**
 * Define os times gerados.
 * @param {Array<Array<string>>} teams - A nova lista de times gerados.
 */
export function setAllGeneratedTeams(teams) {
    allGeneratedTeams = teams;
}

/**
 * Retorna os jogadores do Time 1 atual.
 * @returns {Array<string>} A lista de jogadores do Time 1.
 */
export function getCurrentTeam1() {
    return currentTeam1;
}

/**
 * Retorna os jogadores do Time 2 atual.
 * @returns {Array<string>} A lista de jogadores do Time 2.
 */
export function getCurrentTeam2() {
    return currentTeam2;
}

/**
 * Retorna o nome do Time 1 ativo.
 * @returns {string} O nome do Time 1.
 */
export function getActiveTeam1Name() {
    return activeTeam1Name;
}

/**
 * Retorna o nome do Time 2 ativo.
 * @returns {string} O nome do Time 2.
 */
export function getActiveTeam2Name() {
    return activeTeam2Name;
}

/**
 * Retorna a cor do Time 1 ativo.
 * @returns {string} A cor do Time 1.
 */
export function getActiveTeam1Color() {
    return activeTeam1Color;
}

/**
 * Retorna a cor do Time 2 ativo.
 * @returns {string} A cor do Time 2.
 */
export function getActiveTeam2Color() {
    return activeTeam2Color;
}

/**
 * Reinicia o estado do jogo para um novo jogo.
 */
export function resetGameForNewMatch() {
    team1Score = 0;
    team2Score = 0;
    timeElapsed = 0;
    setElapsedTime = 0;
    clearInterval(timerInterval);
    clearInterval(setTimerInterval);
    timerInterval = null;
    setTimerInterval = null;
    isTimerRunning = false;
    isGameInProgress = false;
    currentTeam1 = [];
    currentTeam2 = [];
    allGeneratedTeams = []; // Limpa times gerados

    // Carrega nomes e cores padrão/configurados
    const config = loadConfig();
    activeTeam1Name = config.customTeam1Name || 'Time 1';
    activeTeam2Name = config.customTeam2Name || 'Time 2';
    activeTeam1Color = config.customTeam1Color || '#325fda';
    activeTeam2Color = config.customTeam2Color || '#f03737';

    updateScoreDisplay(team1Score, team2Score);
    updateTimerDisplay(timeElapsed);
    updateSetTimerDisplay(setElapsedTime);
    renderScoringPagePlayers(currentTeam1, currentTeam2);
    updateTeamDisplayNamesAndColors(activeTeam1Name, activeTeam2Name, activeTeam1Color, activeTeam2Color);
    document.querySelector('.timer-wrapper').style.display = 'none'; // Esconde o timer
    updateNavScoringButton(isGameInProgress);
}
