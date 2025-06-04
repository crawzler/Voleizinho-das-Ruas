// js/game/logic.js
// Contém a lógica principal do jogo: pontuação, timer e gerenciamento de estado.

// Importa funções de UI e dados.
import { updateScoreDisplay, updateTimerDisplay, updateSetTimerDisplay, renderScoringPagePlayers, updateTeamDisplayNamesAndColors, updateNavScoringButton, renderTeams } from '../ui/game-ui.js';
import { getPlayers } from '../data/players.js';
import { shuffleArray } from '../utils/helpers.js';
import { loadConfig } from '../ui/config-ui.js';
import { showPage, setGameStartedExplicitly } from '../ui/pages.js'; // Importa showPage e a nova função setGameStartedExplicitly
import * as Elements from '../ui/elements.js'; // Importa Elements para depuração
import { displayMessage } from '../ui/messages.js'; // Importa a função de exibição de mensagens

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
let allGeneratedTeams = []; // Array para armazenar os times gerados globalmente
let currentTeam1Index = 0; // NOVO: Índice do time selecionado para o Time 1
let currentTeam2Index = 1; // NOVO: Índice do time selecionado para o Time 2 (começa com o segundo time)


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
 * Atualiza o ícone do botão de play/pause do timer.
 */
function updateTimerButtonIcon() {
    const timerToggleButton = document.querySelector('.timer-toggle-button');
    if (timerToggleButton) {
        timerToggleButton.textContent = isTimerRunning ? 'pause' : 'play_arrow';
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
    } else {
        startTimer();
        startSetTimer();
    }
    updateTimerButtonIcon(); // Atualiza o ícone após a mudança de estado
}

/**
 * Verifica se um set terminou e o reinicia se necessário.
 * @param {number} pointsPerSet - Pontos necessários para vencer o set.
 */
function checkSetEnd(pointsPerSet) {
    if (team1Score >= pointsPerSet && team1Score - team2Score >= 2) {
        console.log('Time 1 venceu o set!');
        displayMessage(`${activeTeam1Name} venceu o set!`, 'success');
        resetSet();
    } else if (team2Score >= pointsPerSet && team2Score - team1Score >= 2) {
        console.log('Time 2 venceu o set!');
        displayMessage(`${activeTeam2Name} venceu o set!`, 'success');
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

    console.log('--- Antes da troca (swapTeams) ---');
    console.log('team1Score:', team1Score, 'team2Score:', team2Score);
    console.log('activeTeam1Name:', activeTeam1Name, 'activeTeam2Name:', activeTeam2Name);
    console.log('activeTeam1Color:', activeTeam1Color, 'activeTeam2Color:', activeTeam2Color);
    console.log('currentTeam1:', currentTeam1, 'currentTeam2:', currentTeam2);
    console.log('currentTeam1Index:', currentTeam1Index, 'currentTeam2Index:', currentTeam2Index);


    // Troca as pontuações
    const tempScore = team1Score;
    team1Score = team2Score;
    team2Score = tempScore;

    // Troca os jogadores
    const tempTeam = currentTeam1;
    currentTeam1 = currentTeam2;
    currentTeam2 = tempTeam;

    // Troca os nomes dos times
    const tempName = activeTeam1Name;
    activeTeam1Name = activeTeam2Name;
    activeTeam2Name = tempName;

    // Troca as cores dos times
    const tempColor = activeTeam1Color;
    activeTeam1Color = activeTeam2Color;
    activeTeam2Color = tempColor;

    // Troca os índices dos times selecionados
    const tempIndex = currentTeam1Index;
    currentTeam1Index = currentTeam2Index;
    currentTeam2Index = tempIndex;

    console.log('--- Depois da troca (swapTeams) ---');
    console.log('team1Score:', team1Score, 'team2Score:', team2Score);
    console.log('activeTeam1Name:', activeTeam1Name, 'activeTeam2Name:', activeTeam2Name);
    console.log('activeTeam1Color:', activeTeam1Color, 'activeTeam2Color:', activeTeam2Color);
    console.log('currentTeam1:', currentTeam1, 'currentTeam2:', currentTeam2);
    console.log('currentTeam1Index:', currentTeam1Index, 'currentTeam2Index:', currentTeam2Index);


    // Atualiza a exibição na UI
    updateScoreDisplay(team1Score, team2Score);
    updateTeamDisplayNamesAndColors(activeTeam1Name, activeTeam2Name, activeTeam1Color, activeTeam2Color);
    const config = loadConfig();
    console.log('Config displayPlayers:', config.displayPlayers);
    if (config.displayPlayers) {
        renderScoringPagePlayers(currentTeam1, currentTeam2);
    }
    displayMessage('Times trocados!', 'info');
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

    setGameStartedExplicitly(true); // Define que o jogo foi explicitamente iniciado

    // Inicializa os times com os dois primeiros times gerados, se existirem
    if (allGeneratedTeams && allGeneratedTeams.length >= 2) {
        console.log('[startGame] Usando times gerados para a partida.');
        currentTeam1Index = 0;
        currentTeam2Index = 1;
        
        currentTeam1 = allGeneratedTeams[currentTeam1Index].players;
        currentTeam2 = allGeneratedTeams[currentTeam2Index].players;

        const team1ConfigName = config[`customTeam${currentTeam1Index + 1}Name`];
        const team2ConfigName = config[`customTeam${currentTeam2Index + 1}Name`];
        const team1ConfigColor = config[`customTeam${currentTeam1Index + 1}Color`];
        const team2ConfigColor = config[`customTeam${currentTeam2Index + 1}Color`];

        activeTeam1Name = team1ConfigName || allGeneratedTeams[currentTeam1Index].name || 'Time 1';
        activeTeam2Name = team2ConfigName || allGeneratedTeams[currentTeam2Index].name || 'Time 2';
        activeTeam1Color = team1ConfigColor || '#325fda';
        activeTeam2Color = team2ConfigColor || '#f03737';

    } else {
        // Se não houver times gerados suficientes, inicia a partida sem jogadores visíveis.
        console.log('[startGame] Nenhum time gerado suficiente. Iniciando partida sem jogadores visíveis.');
        currentTeam1 = []; // Define times como vazios
        currentTeam2 = []; // Define times como vazios
        currentTeam1Index = -1; // Indica que nenhum time gerado está selecionado
        currentTeam2Index = -1; // Indica que nenhum time gerado está selecionado

        activeTeam1Name = config.customTeam1Name || 'Time 1';
        activeTeam2Name = config.customTeam2Name || 'Time 2';
        activeTeam1Color = config.customTeam1Color || '#325fda';
        activeTeam2Color = config.customTeam2Color || '#f03737';
    }

    console.log('[startGame] currentTeam1 (final):', currentTeam1);
    console.log('[startGame] currentTeam2 (final):', currentTeam2);

    updateTeamDisplayNamesAndColors(activeTeam1Name, activeTeam2Name, activeTeam1Color, activeTeam2Color);
    renderScoringPagePlayers(currentTeam1, currentTeam2);

    isGameInProgress = true;
    console.log('DEBUG: Chamando updateNavScoringButton(true) em startGame.');
    updateNavScoringButton(true, 'scoring-page');
    console.log('DEBUG: Elements.timerAndSetTimerWrapper no startGame:', Elements.timerAndSetTimerWrapper);
    if (Elements.timerAndSetTimerWrapper) {
        console.log('DEBUG: Current display style of timerAndSetTimerWrapper:', Elements.timerAndSetTimerWrapper.style.display);
    }
    showPage('scoring-page');
    startTimer();
    startSetTimer();
    updateTimerButtonIcon(); // Atualiza o ícone do botão para 'pause' ao iniciar o jogo
    displayMessage('Partida iniciada!', 'success');
    console.log('Partida iniciada!');
}

/**
 * Cicla para o próximo time gerado para o painel especificado.
 * @param {string} teamPanel - 'team1' ou 'team2'.
 */
export function cycleTeam(teamPanel) {
    if (!allGeneratedTeams || allGeneratedTeams.length === 0) {
        displayMessage("Nenhum time gerado. Gere times na página 'Times' primeiro.", "info");
        return;
    }

    const config = loadConfig();
    const defaultColors = ['#325fda', '#f03737', '#28a745', '#ffc107', '#6f42c1', '#17a2b8'];

    if (teamPanel === 'team1') {
        currentTeam1Index = (currentTeam1Index + 1) % allGeneratedTeams.length;
        const selectedTeam = allGeneratedTeams[currentTeam1Index];
        currentTeam1 = selectedTeam.players;
        activeTeam1Name = config[`customTeam${currentTeam1Index + 1}Name`] || selectedTeam.name;
        activeTeam1Color = config[`customTeam${currentTeam1Index + 1}Color`] || defaultColors[currentTeam1Index] || '#325fda';
        displayMessage(`Time 1: ${activeTeam1Name}`, 'info');
    } else if (teamPanel === 'team2') {
        currentTeam2Index = (currentTeam2Index + 1) % allGeneratedTeams.length;
        const selectedTeam = allGeneratedTeams[currentTeam2Index];
        currentTeam2 = selectedTeam.players;
        activeTeam2Name = config[`customTeam${currentTeam2Index + 1}Name`] || selectedTeam.name;
        activeTeam2Color = config[`customTeam${currentTeam2Index + 1}Color`] || defaultColors[currentTeam2Index] || '#f03737';
        displayMessage(`Time 2: ${activeTeam2Name}`, 'info');
    }

    updateTeamDisplayNamesAndColors(activeTeam1Name, activeTeam2Name, activeTeam1Color, activeTeam2Color);
    renderScoringPagePlayers(currentTeam1, currentTeam2);
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
 * @param {Array<Object>} teams - Array de objetos de time gerados.
 */
export function setAllGeneratedTeams(teams) {
    allGeneratedTeams = teams;
    console.log('[setAllGeneratedTeams] Times gerados definidos:', allGeneratedTeams);
}

/**
 * Retorna todos os times gerados.
 * @returns {Array<Object>} Todos os times gerados.
 */
export function getAllGeneratedTeams() {
    return allGeneratedTeams;
}

// NOVO: Funções setter para atualizar os times e suas propriedades
export function setCurrentTeam1(players) {
    currentTeam1 = players;
}

export function setCurrentTeam2(players) {
    currentTeam2 = players;
}

export function setActiveTeam1Name(name) {
    activeTeam1Name = name;
}

export function setActiveTeam2Name(name) {
    activeTeam2Name = name;
}

export function setActiveTeam1Color(color) {
    activeTeam1Color = color;
}

export function setActiveTeam2Color(color) {
    activeTeam2Color = color;
}

/**
 * Encerra o jogo atual.
 */
export function endGame() { // EXPORTADO: Função endGame
    if (!isGameInProgress) {
        displayMessage("Nenhum jogo em andamento para encerrar.", "info");
        return;
    }

    clearInterval(timerInterval);
    clearInterval(setTimerInterval);
    timerInterval = null;
    setTimerInterval = null;
    isTimerRunning = false;
    isGameInProgress = false;
    setGameStartedExplicitly(false); // Define que o jogo não está mais explicitamente iniciado
    displayMessage("Jogo encerrado!", "info");
    showPage('start-page'); // Volta para a página inicial
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
    isTimerRunning = false; // Garante que o timer está parado
    isGameInProgress = false;
    currentTeam1 = [];
    currentTeam2 = [];
    currentTeam1Index = 0; // Reseta o índice do time 1
    currentTeam2Index = 1; // Reseta o índice do time 2

    // allGeneratedTeams = []; // Não limpa allGeneratedTeams aqui para que possam ser usados na próxima partida

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
    updateNavScoringButton(false, '');
    setGameStartedExplicitly(false); // Reseta a flag de jogo iniciado explicitamente
    updateTimerButtonIcon(); // Atualiza o ícone do botão para 'play_arrow' ao resetar o jogo
    displayMessage('Jogo resetado. Pronto para uma nova partida!', 'success');
}
