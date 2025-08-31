// js/data/history.js
// Manages game history data, using localStorage as a fallback.

const HISTORY_STORAGE_KEY = 'voleiScoreMatchHistory';

/**
 * Salva o resultado de um jogo no histórico do localStorage.
 * @param {object} gameData - Os dados do jogo a serem salvos (ex: times, placar).
 * @deprecated Esta função está sendo substituída por addMatchToHistory em history-ui.js
 */
export const saveGameToHistory = async (gameData) => {
    // Função mantida apenas para compatibilidade, mas não faz mais nada
    // O salvamento agora é feito exclusivamente via addMatchToHistory que tem confirmação
    // Função obsoleta
};

/**
 * Carrega o histórico de jogos do localStorage.
 * @returns {Promise<Array>} - Uma promessa que resolve para um array de jogos do histórico.
 */
export const loadGameHistory = async () => {
    try {
        const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
        const history = storedHistory ? JSON.parse(storedHistory) : [];
        // Histórico carregado
        return history;
    } catch (error) {
        // Log removido
        return [];
    }
};
