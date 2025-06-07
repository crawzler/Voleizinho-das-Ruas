// js/data/history.js
// Manages game history data, using localStorage as a fallback.

const HISTORY_STORAGE_KEY = 'gameHistory';

/**
 * Salva o resultado de um jogo no histórico do localStorage.
 * @param {object} gameData - Os dados do jogo a serem salvos (ex: times, placar).
 */
export const saveGameToHistory = async (gameData) => {
    try {
        const history = await loadGameHistory();
        history.unshift({ ...gameData, id: `game-${Date.now()}` }); // Adiciona no início
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
        console.log("Jogo salvo no histórico local com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar jogo no histórico local: ", error);
    }
};

/**
 * Carrega o histórico de jogos do localStorage.
 * @returns {Promise<Array>} - Uma promessa que resolve para um array de jogos do histórico.
 */
export const loadGameHistory = async () => {
    try {
        const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
        const history = storedHistory ? JSON.parse(storedHistory) : [];
        console.log("Histórico de jogos carregado do localStorage:", history);
        return history;
    } catch (error) {
        console.error("Erro ao carregar histórico de jogos do localStorage: ", error);
        return [];
    }
};