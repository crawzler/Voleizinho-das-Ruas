// js/game/logic.js
// Contém a lógica principal do jogo: pontuação, timer e gerenciamento de estado.

// Importa funções de UI e dados.
import { updateScoreDisplay, updateTimerDisplay, updateSetTimerDisplay, renderScoringPagePlayers, updateTeamDisplayNamesAndColors, updateNavScoringButton, renderTeams } from '../ui/game-ui.js';
import { getPlayers } from '../data/players.js';
import { shuffleArray } from '../utils/helpers.js';
import { loadConfig } from '../ui/config-ui.js';
import { showPage } from '../ui/pages.js';
import * as Elements from '../ui/elements.js'; // Importa Elements para depuração

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
let allGeneratedTeams = [];

let activeTeam1Name = 'Time 1';
let activeTeam2Name = 'Time 2';
let activeTeam1Color = '#325fda';
let activeTeam2Color = '#f03737';

/**
 * Retorna o estado atual do jogo (se está em andamento ou não).
 * @returns {boolean} True se o jogo estiver em andamento, false caso contrário.
 */
export function getIsGameInProgress() {
    return isGameInProgress;
}

/**
 * Incrementa a pontuação de um time.
 * @param {string} teamId - O ID do time ('team1' ou 'team2').
 */
export function incrementScore(teamId) {
    const config = loadConfig();
    const pointsPerSet = parseInt(config.pointsPerSet, 10);
    const vibrationEnabled = config.vibration ?? true;

    if (!isGameInProgress) {
        console.warn('Jogo não está em andamento. Não é possível pontuar.');
        return;
    }

    if (teamId === 'team1') {
        team1Score++;
        if (vibrationEnabled) navigator.vibrate(50);
    } else if (teamId === 'team2') {
        team2Score++;
        if (vibrationEnabled) navigator.vibrate(50);
    }
    updateScoreDisplay(team1Score, team2Score);
    checkSetEnd(pointsPerSet);
}

/**
 * Decrementa a pontuação de um time.
 * @param {string} teamId - O ID do time ('team1' ou 'team2').
 */
export function decrementScore(teamId) {
    if (!isGameInProgress) {
        console.warn('Jogo não está em andamento. Não é possível decrementar pontuação.');
        return;
    }

    if (teamId === 'team1' && team1Score > 0) {
        team1Score--;
    } else if (teamId === 'team2' && team2Score > 0) {
        team2Score--;
    }
    updateScoreDisplay(team1Score, team2Score);
}

/**
 * Inicia o timer geral do jogo.
 */
function startTimer() {
    if (!timerInterval) {
        timerInterval = setInterval(() => {
            timeElapsed++;
            updateTimerDisplay(timeElapsed);
        }, 1000);
        isTimerRunning = true;
    }
}

/**
 * Inicia o timer do set atual.
 */
function startSetTimer() {
    if (!setTimerInterval) {
        setTimerInterval = setInterval(() => {
            setElapsedTime++;
            updateSetTimerDisplay(setElapsedTime);
        }, 1000);
    }
}

/**
 * Alterna o estado do timer (iniciar/pausar).
 */
export function toggleTimer() {
    if (!isGameInProgress) {
        console.warn('Não é possível controlar o timer: jogo não está em andamento.');
        return;
    }

    if (isTimerRunning) {
        clearInterval(timerInterval);
        clearInterval(setTimerInterval);
        timerInterval = null;
        setTimerInterval = null;
        isTimerRunning = false;
        document.querySelector('.timer-toggle-button').textContent = 'play_arrow';
    } else {
        startTimer();
        startSetTimer();
        document.querySelector('.timer-toggle-button').textContent = 'pause';
    }
}

/**
 * Verifica se um set terminou e o reinicia se necessário.
 * @param {number} pointsPerSet - Pontos necessários para vencer o set.
 */
function checkSetEnd(pointsPerSet) {
    if (team1Score >= pointsPerSet && team1Score - team2Score >= 2) {
        console.log('Time 1 venceu o set!');
        resetSet();
    } else if (team2Score >= pointsPerSet && team2Score - team1Score >= 2) {
        console.log('Time 2 venceu o set!');
        resetSet();
    }
}

/**
 * Reinicia o placar e o timer do set.
 */
function resetSet() {
    team1Score = 0;
    team2Score = 0;
    setElapsedTime = 0;
    updateScoreDisplay(team1Score, team2Score);
    updateSetTimerDisplay(setElapsedTime);
    clearInterval(setTimerInterval);
    setTimerInterval = null;
    startSetTimer();
}

/**
 * Troca os times de posição no placar.
 */
export function swapTeams() {
    if (!isGameInProgress) {
        console.warn('Não é possível trocar os times: jogo não está em andamento.');
        return;
    }

    const tempTeam = currentTeam1;
    currentTeam1 = currentTeam2;
    currentTeam2 = tempTeam;

    const tempName = activeTeam1Name;
    activeTeam1Name = activeTeam2Name;
    activeTeam2Name = tempName;

    const tempColor = activeTeam1Color;
    activeTeam1Color = activeTeam2Color;
    activeTeam2Color = tempColor;

    updateTeamDisplayNamesAndColors(activeTeam1Name, activeTeam2Name, activeTeam1Color, activeTeam2Color);
    const config = loadConfig();
    if (config.displayPlayers) {
        renderScoringPagePlayers(currentTeam1, currentTeam2);
    }
    console.log('Times trocados!');
}

/**
 * Esta função não deve ser chamada diretamente. A geração de times é gerenciada em teams.js.
 * @param {string} appId - O ID do aplicativo.
 */
export function generateTeams(appId) {
    console.warn("A função logic.js/generateTeams não deve ser chamada diretamente. Use teams.js/generateTeams.");
}

/**
 * Inicia uma nova partida.
 * @param {string} appId - O ID do aplicativo.
 */
export function startGame(appId) {
    if (isGameInProgress) {
        console.warn('Jogo já está em andamento!');
        return;
    }

    const config = loadConfig();
    const playersPerTeam = parseInt(config.playersPerTeam, 10);
    const displayPlayers = config.displayPlayers ?? true;

    const players = getPlayers();
    const selectedPlayerElements = document.querySelectorAll('#players-list-container .player-checkbox:checked');
    const selectedPlayerIds = Array.from(selectedPlayerElements).map(checkbox => checkbox.dataset.playerId);

    const selectedPlayersNames = players
        .filter(player => selectedPlayerIds.includes(player.id))
        .map(player => player.name);

    if (selectedPlayersNames.length < (playersPerTeam * 2)) {
        console.warn(`Selecione pelo menos ${playersPerTeam * 2} jogadores para iniciar a partida.`);
        return;
    }

    resetGameForNewMatch(); // Reseta o jogo antes de iniciar um novo

    const shuffledPlayers = [...selectedPlayersNames];
    shuffleArray(shuffledPlayers);

    currentTeam1 = shuffledPlayers.slice(0, playersPerTeam);
    currentTeam2 = shuffledPlayers.slice(playersPerTeam, playersPerTeam * 2);

    const team1Name = config.customTeam1Name || 'Time 1';
    const team2Name = config.customTeam2Name || 'Time 2';
    const team1Color = config.customTeam1Color || '#325fda';
    const team2Color = config.customTeam2Color || '#f03737';

    updateTeamDisplayNamesAndColors(team1Name, team2Name, team1Color, team2Color);

    if (displayPlayers) {
        renderScoringPagePlayers(currentTeam1, currentTeam2);
    } else {
        renderScoringPagePlayers([], []);
    }

    isGameInProgress = true;
    console.log('DEBUG: Chamando updateNavScoringButton(true) em startGame.');
    updateNavScoringButton(true); // Atualiza o botão de navegação e MOSTRA o timer
    console.log('DEBUG: Elements.timerAndSetTimerWrapper no startGame:', Elements.timerAndSetTimerWrapper);
    if (Elements.timerAndSetTimerWrapper) {
        console.log('DEBUG: Current display style of timerAndSetTimerWrapper:', Elements.timerAndSetTimerWrapper.style.display);
    }
    showPage('scoring-page');
    startTimer();
    startSetTimer();
    console.log('Partida iniciada!');
}

/**
 * Retorna os jogadores do Time 1 atualmente em jogo.
 * @returns {Array<string>} Array de nomes de jogadores do Time 1.
 */
export function getCurrentTeam1() {
    return currentTeam1;
}

/**
 * Retorna os jogadores do Time 2 atualmente em jogo.
 * @returns {Array<string>} Array de nomes de jogadores do Time 2.
 */
export function getCurrentTeam2() {
    return currentTeam2;
}

/**
 * Retorna o nome ativo do Time 1.
 * @returns {string} Nome do Time 1.
 */
export function getActiveTeam1Name() {
    return activeTeam1Name;
}

/**
 * Retorna o nome ativo do Time 2.
 * @returns {string} Nome do Time 2.
 */
export function getActiveTeam2Name() {
    return activeTeam2Name;
}

/**
 * Retorna a cor ativa do Time 1.
 * @returns {string} Cor do Time 1 (hex).
 */
export function getActiveTeam1Color() {
    return activeTeam1Color;
}

/**
 * Retorna a cor ativa do Time 2.
 * @returns {string} Cor do Time 2 (hex).
 */
export function getActiveTeam2Color() {
    return activeTeam2Color;
}

/**
 * Define todos os times gerados.
 * @param {Array<Array<string>>} teams - Array de todos os times gerados.
 */
export function setAllGeneratedTeams(teams) {
    allGeneratedTeams = teams;
}

/**
 * Retorna todos os times gerados.
 * @returns {Array<Array<string>>} Todos os times gerados.
 */
export function getAllGeneratedTeams() {
    return allGeneratedTeams;
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
    updateTeamDisplayNamesAndColors(activeTeam1Name, activeTeam2Name, activeTeam1Color, activeTeam2Color);
    console.log('DEBUG: Chamando updateNavScoringButton(false) em resetGameForNewMatch.');
    updateNavScoringButton(false); // Atualiza o botão de navegação e ESCONDE o timer
}
