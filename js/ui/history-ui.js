// js/ui/history-ui.js
// Renders the game history page.

import { loadGameHistory } from '../data/history.js';
import * as Elements from './elements.js';

/**
 * Formata a data de um jogo para exibição.
 * @param {string} isoDate - A data no formato ISO.
 * @returns {string} A data formatada (ex: 01/01/2023 14:30).
 */
function formatGameDate(isoDate) {
    if (!isoDate) return 'Data desconhecida';
    const date = new Date(isoDate);
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Formata a duração de um jogo para exibição.
 * @param {number} durationInSeconds - A duração em segundos.
 * @returns {string} A duração formatada (ex: 1h 15m 30s).
 */
function formatGameDuration(durationInSeconds) {
    if (isNaN(durationInSeconds) || durationInSeconds < 0) {
        return '00:00';
    }
    const minutes = Math.floor(durationInSeconds / 60).toString().padStart(2, '0');
    const seconds = (durationInSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
}

function formatSetDuration(durationInSeconds) {
    if (isNaN(durationInSeconds) || durationInSeconds < 0) {
        return '00:00';
    }
    const minutes = Math.floor(durationInSeconds / 60).toString().padStart(2, '0');
    const seconds = (durationInSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
}


/**
 * Cria o HTML para um único item do histórico.
 * @param {object} game - O objeto do jogo.
 * @returns {string} O HTML do item do histórico.
 */
function createHistoryItemHTML(game) {
    const gameDate = new Date(game.date);
    const formattedDate = gameDate.toLocaleDateString('pt-BR');
    const formattedTime = gameDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const team1PlayersList = game.team1Players.map(player => `<li>- ${player}</li>`).join('');
    const team2PlayersList = game.team2Players.map(player => `<li>- ${player}</li>`).join('');

    const setsList = game.sets.map(set => `
        <li>
            <span>${set.team1Score} ${game.team1Name} vs ${game.team2Name} ${set.team2Score}</span>
            <span>${formatSetDuration(set.duration)}</span>
        </li>
    `).join('');

    return `
        <div class="history-item">
            <div class="history-item-header">
                <h2>${game.team1Name} ${game.team1Sets} vs ${game.team2Sets} ${game.team2Name}</h2>
                <div class="date-time">
                    <span>${formattedDate}</span>
                    <span>${formattedTime}</span>
                </div>
                <button class="expand-button">
                    <i class="material-icons">expand_more</i>
                </button>
            </div>
            <div class="history-item-content" style="display: none;">
                <div class="details-grid">
                    <div class="players-section">
                        <h3>Jogadores:</h3>
                        <div class="teams">
                            <div class="team">
                                <h4>${game.team1Name}:</h4>
                                <ul>${team1PlayersList}</ul>
                            </div>
                            <div class="team">
                                <h4>${game.team2Name}:</h4>
                                <ul>${team2PlayersList}</ul>
                            </div>
                        </div>
                    </div>
                    <div class="sets-section">
                        <h3>Sets:</h3>
                        <ul>${setsList}</ul>
                    </div>
                </div>
                <div class="history-item-footer">
                    <div class="location">
                        <i class="material-icons">location_on</i>
                        <span>Local: Quadra da Praça</span>
                    </div>
                    <div class="game-time">
                        <i class="material-icons">timer</i>
                        <span>Tempo de jogo: ${formatGameDuration(game.duration)}</span>
                    </div>
                    <button class="delete-button">
                        <i class="material-icons">delete</i>
                    </button>
                </div>
            </div>
        </div>
    `;
}


/**
 * Carrega e exibe o histórico de jogos na página.
 */
export async function setupHistoryPage() {
    const historyContainer = Elements.historyList();
    historyContainer.innerHTML = '<p class="message message--loading">Carregando histórico...</p>';

    const gameHistory = await loadGameHistory();

    if (gameHistory.length === 0) {
        historyContainer.innerHTML = '<p class="message message--info">Nenhum jogo encontrado no histórico.</p>';
        return;
    }

    historyContainer.innerHTML = gameHistory.map(createHistoryItemHTML).join('');
}