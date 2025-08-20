// js/game/logic.js
// Contém a lógica principal do jogo: pontuação, timer e gerenciamento de estado.

// Importa funções de UI e dados.
import { updateScoreDisplay, updateTimerDisplay, updateSetTimerDisplay, renderScoringPagePlayers, updateTeamDisplayNamesAndColors, updateNavScoringButton, renderTeams, updateSetsDisplay } from '../ui/game-ui.js';
import { getPlayers } from '../data/players.js';
import { shuffleArray, salvarEstado, carregarEstado, limparEstado, salvarTimesGerados, carregarTimesGerados } from '../utils/helpers.js';
import { loadConfig } from '../ui/config-ui.js';
import { showPage, setGameStartedExplicitly } from '../ui/pages.js';
import * as Elements from '../ui/elements.js';
import { displayMessage } from '../ui/messages.js';
import { saveGameToHistory } from '../data/history.js';
import { addMatchToHistory } from '../ui/history-ui.js';

let team1Score = 0;
let team2Score = 0;
let team1Sets = 0;
let team2Sets = 0;
let timerInterval = null;
let timeElapsed = 0;
let isTimerRunning = false;
let setElapsedTime = 0;
let setTimerInterval = null;
let currentTeam1 = [];
let currentTeam2 = [];
let isGameInProgress = false;
let allGeneratedTeams = [];
let currentTeam1Index = 0;
let currentTeam2Index = 1;
let setsHistory = [];
let autoSaveInterval = null;


let activeTeam1Name = 'Time 1';
let activeTeam2Name = 'Time 2';
let activeTeam1Color = '#325fda';
let activeTeam2Color = '#f03737';
// --- Persistência: captura e aplica estado do jogo ---
function getGameState() {
    return {
        team1Score,
        team2Score,
        team1Sets,
        team2Sets,
        timeElapsed,
        setElapsedTime,
        isTimerRunning,
        isGameInProgress,
        currentTeam1,
        currentTeam2,
        currentTeam1Index,
        currentTeam2Index,
        activeTeam1Name,
        activeTeam2Name,
        activeTeam1Color,
        activeTeam2Color,
        setsHistory,
        allGeneratedTeams
    };
}

export function setGameState(state, { resumeTimers = true } = {}) {
    if (!state) return;
    team1Score = state.team1Score ?? 0;
    team2Score = state.team2Score ?? 0;
    team1Sets = state.team1Sets ?? 0;
    team2Sets = state.team2Sets ?? 0;
    timeElapsed = state.timeElapsed ?? 0;
    setElapsedTime = state.setElapsedTime ?? 0;
    isTimerRunning = !!state.isTimerRunning;
    isGameInProgress = !!state.isGameInProgress;
    currentTeam1 = Array.isArray(state.currentTeam1) ? state.currentTeam1 : [];
    currentTeam2 = Array.isArray(state.currentTeam2) ? state.currentTeam2 : [];
    currentTeam1Index = Number.isInteger(state.currentTeam1Index) ? state.currentTeam1Index : 0;
    currentTeam2Index = Number.isInteger(state.currentTeam2Index) ? state.currentTeam2Index : 1;
    activeTeam1Name = state.activeTeam1Name || 'Time 1';
    activeTeam2Name = state.activeTeam2Name || 'Time 2';
    activeTeam1Color = state.activeTeam1Color || '#325fda';
    activeTeam2Color = state.activeTeam2Color || '#f03737';
    setsHistory = Array.isArray(state.setsHistory) ? state.setsHistory : [];
    if (Array.isArray(state.allGeneratedTeams)) {
        allGeneratedTeams = state.allGeneratedTeams;
    }

    // Atualiza UI
    updateScoreDisplay(team1Score, team2Score);
    updateSetsDisplay(team1Sets, team2Sets);
    updateTimerDisplay(timeElapsed);
    updateSetTimerDisplay(setElapsedTime);
    updateTeamDisplayNamesAndColors(activeTeam1Name, activeTeam2Name, activeTeam1Color, activeTeam2Color);
    const displayPlayers = true;
    const shouldDisplayPlayers = displayPlayers && (currentTeam1.length > 0 || currentTeam2.length > 0);
    renderScoringPagePlayers(currentTeam1, currentTeam2, shouldDisplayPlayers);
    updateNavScoringButton(isGameInProgress, isGameInProgress ? 'scoring-page' : '');

    // Retomar timers se estavam rodando
    if (resumeTimers && isGameInProgress) {
        if (isTimerRunning) {
            startTimer();
            startSetTimer();
        }
        // Sempre atualizar o ícone do timer, independente do estado
        updateTimerButtonIcon();
        if (Elements.timerAndSetTimerWrapper()) {
            Elements.timerAndSetTimerWrapper().style.display = 'flex';
        }
        
        // Iniciar salvamento automático se o jogo estiver em progresso
        if (autoSaveInterval) {
            clearInterval(autoSaveInterval);
        }
        autoSaveInterval = setInterval(() => {
            if (isGameInProgress) {
                try { 
                    salvarEstado(getGameState());
                } catch(e) {
                    console.error('[autoSave] Erro ao salvar estado:', e);
                }
            }
        }, 10000);
    }
}

export function restoreSavedGameIfAny() {
    try {
        const saved = carregarEstado();
        if (saved && saved.isGameInProgress) {
            console.log('[restoreSavedGameIfAny] Restaurando partida salva:', saved);
            setGameState(saved, { resumeTimers: true });
            setGameStartedExplicitly(true);
            showPage('scoring-page');
            return true;
        }
    } catch (e) {
        console.error('[restoreSavedGameIfAny] Erro ao restaurar partida:', e);
    }
    
    // Sempre tentar restaurar times gerados, mesmo sem partida ativa
    try {
        const savedTeams = carregarTimesGerados();
        if (savedTeams && savedTeams.length > 0) {
            console.log('[restoreSavedGameIfAny] Restaurando times gerados:', savedTeams);
            allGeneratedTeams = savedTeams;
        }
    } catch (e) {
        console.error('[restoreSavedGameIfAny] Erro ao restaurar times gerados:', e);
    }
    
    return false;
}


/**
 * Retorna o estado atual do jogo (se está em andamento ou não).
 * @returns {boolean} True se o jogo estiver em andamento, false caso contrário.
 */
export function getIsGameInProgress() {
    return isGameInProgress;
}

/**
 * Retorna a pontuação atual do Time 1.
 * @returns {number} Pontuação do Time 1.
 */
export function getTeam1Score() {
    return team1Score;
}

/**
 * Retorna a pontuação atual do Time 2.
 * @returns {number} Pontuação do Time 2.
 */
export function getTeam2Score() {
    return team2Score;
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
        return;
    }

    // Se o timer estiver pausado, inicia automaticamente
    if (!isTimerRunning) {
        startTimer();
        startSetTimer();
        updateTimerButtonIcon();
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
    // Persistir estado
    try { salvarEstado(getGameState()); } catch(e) {}

}

/**
 * Decrementa a pontuação de um time.
 * @param {string} teamId - O ID do time ('team1' ou 'team2').
 */
export function decrementScore(teamId) {
    if (!isGameInProgress) {
        return;
    }

    // Se o timer estiver pausado, inicia automaticamente
    if (!isTimerRunning) {
        startTimer();
        startSetTimer();
        updateTimerButtonIcon();
    }

    if (teamId === 'team1' && team1Score > 0) {
        team1Score--;
    } else if (teamId === 'team2' && team2Score > 0) {
        team2Score--;
    }
    updateScoreDisplay(team1Score, team2Score);
    // Persistir estado
    try { salvarEstado(getGameState()); } catch(e) {}
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
    updateTimerButtonIcon();
    // Persistir estado
    try { salvarEstado(getGameState()); } catch(e) {}
}

/**
 * Verifica se um set terminou e o reinicia se necessário.
 * @param {number} pointsPerSet - Pontos necessários para vencer o set.
 */
function checkSetEnd(pointsPerSet) {
    const config = loadConfig();
    const setsToWin = parseInt(config.numberOfSets, 10);

    let setWinner = null;

    if (team1Score >= pointsPerSet && team1Score - team2Score >= 2) {
        setWinner = 'team1';
        team1Sets++;
    } else if (team2Score >= pointsPerSet && team2Score - team1Score >= 2) {
        setWinner = 'team2';
        team2Sets++;
    }

    if (setWinner) {
        const setInfo = {
            team1Score: team1Score,
            team2Score: team2Score,
            duration: setElapsedTime,
            winner: setWinner
        };
        setsHistory.push(setInfo);

        updateSetsDisplay(team1Sets, team2Sets);
        if (checkMatchEnd(setsToWin)) {
            return;
        }
        resetSet();
    }
}

function checkMatchEnd(setsToWin) {
    let matchWinner = null;
    if (team1Sets >= setsToWin) {
        matchWinner = activeTeam1Name;
    } else if (team2Sets >= setsToWin) {
        matchWinner = activeTeam2Name;
    }

    if (matchWinner) {
        // Zerar pontos e sets quando a partida termina
        team1Score = 0;
        team2Score = 0;
        team1Sets = 0;
        team2Sets = 0;
        updateScoreDisplay(team1Score, team2Score);
        updateSetsDisplay(team1Sets, team2Sets);
        endGame();
        return true;
    }
    return false;
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
    // Persistir estado após resetar set
    try { salvarEstado(getGameState()); } catch(e) {}
}

/**
 * Troca os times de posição no placar.
 */
export function swapTeams() {
    if (!isGameInProgress) {
        return;
    }

    // Troca as pontuações
    const tempScore = team1Score;
    team1Score = team2Score;
    team2Score = tempScore;

    // Troca os sets
    const tempSets = team1Sets;
    team1Sets = team2Sets;
    team2Sets = tempSets;

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

    // Chama a animação de troca de times na UI
    import('../ui/game-ui.js').then(mod => {
        if (typeof mod.animateSwapTeams === 'function') {
            mod.animateSwapTeams();
        }
    });

    // Atualiza a exibição na UI
    updateScoreDisplay(team1Score, team2Score, true); // skipAnimation = true
    updateTeamDisplayNamesAndColors(activeTeam1Name, activeTeam2Name, activeTeam1Color, activeTeam2Color);
    updateSetsDisplay(team1Sets, team2Sets);
    const config = loadConfig();
    // Condição para exibir jogadores: config.displayPlayers E (time1 ou time2 tem jogadores)
    const shouldDisplayPlayers = (config.displayPlayers ?? true) && (currentTeam1.length > 0 || currentTeam2.length > 0);
    renderScoringPagePlayers(currentTeam1, currentTeam2, shouldDisplayPlayers);
    // Persistir estado
    try { salvarEstado(getGameState()); } catch(e) {}

}

/**
 * Inicia uma nova partida.
 * @param {string} appId - O ID do aplicativo.
 */
export function startGame(appId) {
    if (isGameInProgress) {
        return;
    }

    const config = loadConfig();
    const playersPerTeam = parseInt(config.playersPerTeam, 10);
    const displayPlayers = config.displayPlayers ?? true;

    setGameStartedExplicitly(true);

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
        console.log('[startGame] Nenhum time gerado suficiente. Iniciando partida sem jogadores visíveis.');
        currentTeam1 = [];
        currentTeam2 = [];
        currentTeam1Index = -1;
        currentTeam2Index = -1;

        activeTeam1Name = config.customTeam1Name || 'Time 1';
        activeTeam2Name = config.customTeam2Name || 'Time 2';
        activeTeam1Color = config.customTeam1Color || '#325fda';
        activeTeam2Color = config.customTeam2Color || '#f03737';
    }

    updateTeamDisplayNamesAndColors(activeTeam1Name, activeTeam2Name, activeTeam1Color, activeTeam2Color);
    // Condição para exibir jogadores: displayPlayers E (time1 ou time2 tem jogadores)
    const shouldDisplayPlayers = displayPlayers && (currentTeam1.length > 0 || currentTeam2.length > 0);
    renderScoringPagePlayers(currentTeam1, currentTeam2, shouldDisplayPlayers);

    isGameInProgress = true;
    updateNavScoringButton(true, 'scoring-page');
    if (Elements.timerAndSetTimerWrapper()) {
        Elements.timerAndSetTimerWrapper().style.display = 'flex';
    }
    showPage('scoring-page');
    startTimer();
    startSetTimer();
    updateTimerButtonIcon();
    setsHistory = [];
    
    // Iniciar salvamento automático a cada 10 segundos
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
    autoSaveInterval = setInterval(() => {
        if (isGameInProgress) {
            try { 
                salvarEstado(getGameState());
            } catch(e) {
                console.error('[autoSave] Erro ao salvar estado:', e);
            }
        }
    }, 10000); // Salva a cada 10 segundos
    
    // Persistir estado inicial
    try { salvarEstado(getGameState()); } catch(e) {}

}

/**
 * Cicla para o próximo time gerado para o painel especificado.
 * @param {string} teamPanel - 'team1' ou 'team2'.
 */
export function cycleTeam(teamPanel) {
    if (!allGeneratedTeams || allGeneratedTeams.length === 0) {
        return;
    }

    const config = loadConfig();
    const defaultColors = ['#325fda', '#f03737', '#28a745', '#ffc107', '#6f42c1', '#17a2b8'];
    const displayPlayers = config.displayPlayers ?? true;

    if (teamPanel === 'team1') {
        currentTeam1Index = (currentTeam1Index + 1) % allGeneratedTeams.length;
        const selectedTeam = allGeneratedTeams[currentTeam1Index];
        currentTeam1 = selectedTeam.players;
        activeTeam1Name = config[`customTeam${currentTeam1Index + 1}Name`] || selectedTeam.name;
        activeTeam1Color = config[`customTeam${currentTeam1Index + 1}Color`] || defaultColors[currentTeam1Index] || '#325fda';
    } else if (teamPanel === 'team2') {
        currentTeam2Index = (currentTeam2Index + 1) % allGeneratedTeams.length;
        const selectedTeam = allGeneratedTeams[currentTeam2Index];
        currentTeam2 = selectedTeam.players;
        activeTeam2Name = config[`customTeam${currentTeam2Index + 1}Name`] || selectedTeam.name;
        activeTeam2Color = config[`customTeam${currentTeam2Index + 1}Color`] || defaultColors[currentTeam2Index] || '#f03737';
    }

    updateTeamDisplayNamesAndColors(activeTeam1Name, activeTeam2Name, activeTeam1Color, activeTeam2Color);
    // Condição para exibir jogadores: displayPlayers E (time1 ou time2 tem jogadores)
    const shouldDisplayPlayers = displayPlayers && (currentTeam1.length > 0 || currentTeam2.length > 0);
    renderScoringPagePlayers(currentTeam1, currentTeam2, shouldDisplayPlayers);
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
    salvarTimesGerados(teams);
    console.log('[setAllGeneratedTeams] Times gerados definidos e salvos:', allGeneratedTeams);
}

/**
 * Retorna todos os times gerados.
 * @returns {Array<Object>} Todos os times gerados.
 */
export function getAllGeneratedTeams() {
    return allGeneratedTeams;
}

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
export function endGame() {
    if (!isGameInProgress) {
        return;
    }

    // Verificar se ambos os times têm jogadores antes de salvar
    const team1HasPlayers = currentTeam1 && currentTeam1.length > 0;
    const team2HasPlayers = currentTeam2 && currentTeam2.length > 0;
    
    if (team1HasPlayers && team2HasPlayers) {
        // Formatar os dados para o formato esperado por history-ui.js
        const matchData = {
            teamA: {
                name: activeTeam1Name,
                players: currentTeam1
            },
            teamB: {
                name: activeTeam2Name,
                players: currentTeam2
            },
            score: {
                teamA: team1Score,
                teamB: team2Score,
                setsA: team1Sets,
                setsB: team2Sets
            },
            winner: team1Sets > team2Sets ? activeTeam1Name : activeTeam2Name,
            timeElapsed: timeElapsed,
            createdAt: new Date().toISOString(),
            sets: setsHistory,
            location: 'Não informado'
        };
        
        // Adicionar ao histórico usando a função do history-ui.js que já tem o modal de confirmação
        addMatchToHistory(matchData);
    }

    clearInterval(timerInterval);
    clearInterval(setTimerInterval);
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
    }
    timerInterval = null;
    setTimerInterval = null;
    isTimerRunning = false;
    isGameInProgress = false;
    setGameStartedExplicitly(false);
    showPage('start-page');
    // Limpar estado persistido ao endGame
    try { limparEstado(); } catch(e) {}
    // Atualizar texto do botão
    const startButton = document.getElementById('start-game-button');
    if (startButton) startButton.textContent = 'Começar Jogo';

}

/**
 * Reinicia o estado do jogo para um novo jogo.
 */
export function resetGameForNewMatch() {
    team1Score = 0;
    team2Score = 0;
    team1Sets = 0;
    team2Sets = 0;
    timeElapsed = 0;
    setElapsedTime = 0;
    setsHistory = [];
    clearInterval(timerInterval);
    clearInterval(setTimerInterval);
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
    }
    timerInterval = null;
    setTimerInterval = null;
    isTimerRunning = false;
    isGameInProgress = false;
    currentTeam1 = [];
    currentTeam2 = [];
    currentTeam1Index = 0;
    currentTeam2Index = 1;

    const config = loadConfig();
    activeTeam1Name = config.customTeam1Name || 'Time 1';
    activeTeam2Name = config.customTeam2Name || 'Time 2';
    activeTeam1Color = config.customTeam1Color || '#325fda';
    activeTeam2Color = config.customTeam2Color || '#f03737';

    updateScoreDisplay(team1Score, team2Score);
    updateSetsDisplay(team1Sets, team2Sets);
    updateTimerDisplay(timeElapsed);
    updateSetTimerDisplay(setElapsedTime);
    updateTeamDisplayNamesAndColors(activeTeam1Name, activeTeam2Name, activeTeam1Color, activeTeam2Color);
    updateNavScoringButton(false, '');
    setGameStartedExplicitly(false);
    updateTimerButtonIcon();
    if (Elements.timerAndSetTimerWrapper()) {
        Elements.timerAndSetTimerWrapper().style.display = 'none';
    }
    renderScoringPagePlayers([], [], false);
    // Limpar estado persistido ao resetGameForNewMatch
    try { limparEstado(); } catch(e) {}
    // Não limpar times gerados no reset - eles devem persistir
    // Atualizar texto do botão
    const startButton = document.getElementById('start-game-button');
    if (startButton) startButton.textContent = 'Começar Jogo';

}

// Salvar automaticamente no fechamento/atualização da página
window.addEventListener('beforeunload', () => {
    if (isGameInProgress) {
        try { 
            const state = getGameState();
            salvarEstado(state);
            console.log('[beforeunload] Estado da partida salvo:', state);
        } catch (e) {
            console.error('[beforeunload] Erro ao salvar estado:', e);
        }
    }
});

// Salvar também no evento pagehide (mais confiável em dispositivos móveis)
window.addEventListener('pagehide', () => {
    if (isGameInProgress) {
        try { 
            const state = getGameState();
            salvarEstado(state);
            console.log('[pagehide] Estado da partida salvo:', state);
        } catch (e) {
            console.error('[pagehide] Erro ao salvar estado:', e);
        }
    }
});

// Salvar também no evento visibilitychange (quando a aba perde foco)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && isGameInProgress) {
        try { 
            const state = getGameState();
            salvarEstado(state);
            console.log('[visibilitychange] Estado da partida salvo:', state);
        } catch (e) {
            console.error('[visibilitychange] Erro ao salvar estado:', e);
        }
    }
});
