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
            // Removido: console.error('Erro ao analisar o histórico do localStorage:', error);
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
        // Removido: console.error('Erro ao salvar o histórico no localStorage:', error);
        // Removido: displayMessage('Erro ao salvar o histórico.', 'error');
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
        // Removido: displayMessage('Erro: Registro do histórico não encontrado.', 'error');
    }
}

/**
 * Renderiza o histórico de partidas na interface do usuário.
 */
function renderMatchHistory() {
    const historyListContainer = Elements.historyListContainer(); // Chamada da função
    if (!historyListContainer) {
        // Removido: console.log("Container do histórico não encontrado. A página de histórico está visível?");
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
    
    // Formatar duração do jogo
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    
    const gameTime = formatTime(match.timeElapsed || 0);

    // Criar listas de jogadores
    const createPlayerList = (teamPlayers, isWinner) => {
        if (!teamPlayers || teamPlayers.length === 0) return '<ul><li>Sem jogadores</li></ul>';
        return `<ul>${teamPlayers.map(player => `<li>${player}</li>`).join('')}</ul>`;
    };
    
    // Criar itens de sets
    const createSetsItems = () => {
        if (!match.sets || match.sets.length === 0) {
            return `<div class="set-item">
                <span class="set-number">Set 1:</span>
                <div class="set-score">
                    <span class="${isTeamAWinner ? 'winner-score' : ''}">${teamAName} ${match.score.teamA}</span>
                    <span> x </span>
                    <span class="${isTeamBWinner ? 'winner-score' : ''}">${match.score.teamB} ${teamBName}</span>
                </div>
            </div>`;
        }
        
        return match.sets.map((set, index) => {
            const isTeamASetWinner = set.winner === 'team1';
            const isTeamBSetWinner = set.winner === 'team2';
            return `<div class="set-item">
                <span class="set-number">Set ${index + 1}:</span>
                <div class="set-score">
                    <span class="${isTeamASetWinner ? 'winner-score' : ''}">${teamAName} ${set.team1Score}</span>
                    <span> x </span>
                    <span class="${isTeamBSetWinner ? 'winner-score' : ''}">${set.team2Score} ${teamBName}</span>
                </div>
            </div>`;
        }).join('');
    };
    
    // Criar itens de tempo dos sets
    const createSetTimesItems = () => {
        if (!match.sets || match.sets.length === 0) {
            return `<div class="set-time-item">
                <div class="set-time">
                    <span class="material-icons">schedule</span>
                    <span>00:00</span>
                </div>
            </div>`;
        }
        
        return match.sets.map((set, index) => {
            const setTime = formatTime(set.duration || 0);
            return `<div class="set-time-item">
                <div class="set-time">
                    <span class="material-icons">schedule</span>
                    <span>${setTime}</span>
                </div>
            </div>`;
        }).join('');
    };

    card.innerHTML = `
        <div class="date-time-info">
            <span>${teamAName} ${match.score.setsA} x ${match.score.setsB} ${teamBName}</span>
            <div class="match-date">
                <span class="match-date-span">
                    <span class="match-date-value">${formattedDate}</span>
                    <span class="match-time-value">${formattedTime}</span>
                </span>
                <span class="material-icons match-expand-icon">chevron_right</span>
            </div>
        </div>
        <div class="match-info">
            <div class="match-content">
                <div class="match-section">
                    <h4 class="section-title">Jogadores</h4>
                    <div class="players-container">
                        <div class="team-players team-a-players ${isTeamAWinner ? 'winner-team' : ''}">
                            <h5>${teamAName}</h5>
                            ${createPlayerList(match.teamA.players)}
                        </div>
                        <div class="team-players team-b-players ${isTeamBWinner ? 'winner-team' : ''}">
                            <h5>${teamBName}</h5>
                            ${createPlayerList(match.teamB.players)}
                        </div>
                    </div>
                </div>
                <div class="match-section">
                    <h4 class="section-title">Sets</h4>
                    <div class="sets-container">
                        ${createSetsItems()}
                    </div>
                </div>
                <div class="match-section">
                    <h4 class="section-title">Tempo</h4>
                    <div class="set-times-container">
                        ${createSetTimesItems()}
                    </div>
                </div>
            </div>
        </div>
        <div class="match-footer">
            <div class="match-location">
                <span class="material-icons">location_on</span>
                <span>Local: ${match.location || 'Não informado'}</span>
            </div>
            <div class="match-duration">
                <span class="material-icons">timer</span>
                <span>Tempo de jogo: ${gameTime}</span>
                <button class="delete-match-button" title="Excluir partida">
                    <span class="material-icons">delete</span>
                </button>
            </div>
        </div>
    `;
    
    // Adicionar funcionalidade de accordion
    const header = card.querySelector('.date-time-info');
    const content = card.querySelector('.match-info');
    
    header.addEventListener('click', () => {
        header.classList.toggle('active');
        content.classList.toggle('active');
        
        // Ajusta a altura máxima do conteúdo para animação suave
        if (content.classList.contains('active')) {
            content.style.maxHeight = content.scrollHeight + 'px';
        } else {
            content.style.maxHeight = '0';
        }
    });
    
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
            // Evita que o clique no botão de excluir acione o accordion
            if (event.target.closest('.delete-match-button')) {
                event.stopPropagation();
                
                const deleteButton = event.target.closest('.delete-match-button');
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
