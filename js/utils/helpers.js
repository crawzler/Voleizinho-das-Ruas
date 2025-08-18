// js/utils/helpers.js
// Funções utilitárias gerais.

/**
 * Formata um número de segundos para o formato MM:SS.
 * @param {number} seconds - O número de segundos.
 * @returns {string} O tempo formatado (MM:SS).
 */
export function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(remainingSeconds).padStart(2, '0');
    return `${formattedMinutes}:${formattedSeconds}`;
}

/**
 * Embaralha um array no lugar (Fisher-Yates shuffle).
 * @param {Array<any>} array - O array a ser embaralhado.
 */
export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// --- Persistência do estado da partida ---
export function salvarEstado(partida) {
    try {
        localStorage.setItem("estadoPartida", JSON.stringify(partida));
    } catch (e) {
        console.error("[helpers] Erro ao salvar estado:", e);
    }
}

export function carregarEstado() {
    try {
        const salvo = localStorage.getItem("estadoPartida");
        return salvo ? JSON.parse(salvo) : null;
    } catch (e) {
        console.error("[helpers] Erro ao carregar estado:", e);
        return null;
    }
}

export function limparEstado() {
    try {
        localStorage.removeItem("estadoPartida");
    } catch (e) {
        console.error("[helpers] Erro ao limpar estado:", e);
    }
}

export function limparTudo() {
    try {
        localStorage.removeItem("estadoPartida");
        localStorage.removeItem("timesGerados");
    } catch (e) {
        console.error("[helpers] Erro ao limpar tudo:", e);
    }
}

// --- Persistência dos times gerados ---
export function salvarTimesGerados(times) {
    try {
        localStorage.setItem("timesGerados", JSON.stringify(times));
    } catch (e) {
        console.error("[helpers] Erro ao salvar times gerados:", e);
    }
}

export function carregarTimesGerados() {
    try {
        const salvos = localStorage.getItem("timesGerados");
        return salvos ? JSON.parse(salvos) : [];
    } catch (e) {
        console.error("[helpers] Erro ao carregar times gerados:", e);
        return [];
    }
}
