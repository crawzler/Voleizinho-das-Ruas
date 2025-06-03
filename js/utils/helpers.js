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
