// js/ui/history-ui.js
// Funções relacionadas à interface da página de histórico de jogos.

import * as Elements from './elements.js';
import { displayMessage } from './messages.js';
import { showConfirmationModal } from './pages.js'; // Importa o modal de confirmação

const MATCH_HISTORY_STORAGE_KEY = 'voleiScoreMatchHistory';

let matchHistory = [];

/**
 * Carrega o histórico de partidas do localStorage.
 */
function loadMatchHistoryFromLocalStorage() {
    const storedHistory = localStorage.getItem(MATCH_HISTORY_STORAGE_KEY);
    // console.log('Histórico carregado do localStorage:', storedHistory); // Removido log de depuração
    if (storedHistory) {
        try {
            matchHistory = JSON.parse(storedHistory);
        } catch (error) {
            console.error('Erro ao analisar o histórico do localStorage:', error);
            matchHistory = [];
        }
    }
}

/**
 * Salva o histórico de partidas no localStorage.
 */
function saveMatchHistoryToLocalStorage() {
    try {
        localStorage.setItem(MATCH_HISTORY_STORAGE_KEY, JSON.stringify(matchHistory));
        // console.log('Histórico salvo no localStorage com sucesso.'); // Removido log de depuração
    } catch (error) {
        console.error('Erro ao salvar o histórico no localStorage:', error);
        displayMessage('Erro ao salvar o histórico.', 'error');
    }
}

/**
 * Adiciona uma partida ao histórico.
 * @param {object} matchData - Os dados da partida (teamA, teamB, score, winner, timeElapsed, location, etc.).
 */
export function addMatchToHistory(matchData) {
    // Adiciona um ID único à partida para facilitar a remoção
    const matchWithId = { ...matchData, id: `match-${Date.now()}` };
    matchHistory.unshift(matchWithId); // Adiciona no início para as mais recentes aparecerem primeiro
    saveMatchHistoryToLocalStorage();
    displayMessage('Partida salva no histórico!', 'success');
    renderMatchHistory(); // Renderiza novamente o histórico
}

/**
 * Exclui uma partida do histórico.
 * @param {string} matchId - O ID da partida a ser excluída.
 */
function deleteMatch(matchId) {
    const initialLength = matchHistory.length;
    matchHistory = matchHistory.filter(match => match.id !== matchId);
    if (matchHistory.length < initialLength) {
        saveMatchHistoryToLocalStorage();
        displayMessage('Registro do histórico excluído.', 'success');
        renderMatchHistory(); // Renderiza novamente o histórico
    } else {
        displayMessage('Erro: Registro do histórico não encontrado.', 'error');
    }
}

/**
 * Renderiza o histórico de partidas na interface do usuário.
 */
function renderMatchHistory() {
    const historyListContainer = Elements.historyListContainer(); // Chamada da função
    if (!historyListContainer) {
        console.warn("Elemento 'history-list-container' não encontrado no DOM.");
        return;
    }

    historyListContainer.innerHTML = ''; // Limpa o container antes de renderizar

    if (matchHistory.length === 0) {
        historyListContainer.innerHTML = '<p class="empty-list-message">Nenhuma partida registrada ainda.</p>';
        return;
    }

    matchHistory.forEach(match => {
        historyListContainer.appendChild(createMatchCard(match));
    });
}

/**
 * Cria o elemento HTML para um cartão de partida do histórico.
 * @param {object} match - Os dados da partida.
 * @returns {HTMLElement} O elemento do cartão da partida.
 */
function createMatchCard(match) {
    const card = document.createElement('div');
    card.className = 'match-history-card';
    card.dataset.matchId = match.id; // Adiciona o ID da partida como um data attribute

    const matchDate = new Date(match.createdAt);
    const formattedDate = matchDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedTime = matchDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const isTeamAWinner = match.winner === match.teamA.name;
    const isTeamBWinner = match.winner === match.teamB.name;

    const teamAName = match.teamA.name || 'Time A';
    const teamBName = match.teamB.name || 'Time B';

    const createPlayerList = (teamPlayers, isWinner) => {
        if (!teamPlayers || teamPlayers.length === 0) return 'Sem jogadores';
        return `<ul>${teamPlayers.map(player => `<li class="${isWinner ? 'winner-player' : ''}">${player}</li>`).join('')}</ul>`;
    };

    card.innerHTML = `
        <div class="date-time-info">
            <span>${formattedDate} às ${formattedTime}</span>
            <button class="delete-match-button" title="Excluir partida"><span class="material-icons">delete</span></button>
        </div>
        <div class="match-info">
            <div class="team">
                <h4 class="${isTeamAWinner ? 'winner' : ''}">${teamAName} (${match.score.setsA})</h4>
                ${createPlayerList(match.teamA.players, isTeamAWinner)}
            </div>
            <div class="match-score">
                <span>${match.score.teamA}</span> x <span>${match.score.teamB}</span>
            </div>
            <div class="team">
                <h4 class="${isTeamBWinner ? 'winner' : ''}">${teamBName} (${match.score.setsB})</h4>
                ${createPlayerList(match.teamB.players, isTeamBWinner)}
            </div>
        </div>
    `;
    return card;
}

/**
 * Configura os event listeners e a lógica para a página de histórico.
 */
export function setupHistoryPage() {
    loadMatchHistoryFromLocalStorage();

    const historyListContainer = Elements.historyListContainer(); // Chamada da função aqui também
    
    if (historyListContainer) {
        // Delegação de evento para o botão de excluir
        historyListContainer.addEventListener('click', (event) => {
            const deleteButton = event.target.closest('.delete-match-button');
            if (deleteButton) {
                const card = deleteButton.closest('.match-history-card');
                const matchId = card.dataset.matchId;
                showConfirmationModal(
                    'Tem certeza que deseja excluir este registro do histórico?',
                    () => {
                        deleteMatch(matchId);
                    }
                );
            }
        });
    }

    // Renderiza o histórico sempre que a página é configurada
    renderMatchHistory();
}
