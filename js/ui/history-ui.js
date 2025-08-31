// js/ui/history-ui.js
// Funções relacionadas à interface da página de histórico de jogos.

import * as Elements from './elements.js';
import { displayMessage } from './messages.js';
import { showConfirmationModal } from './pages.js';

const MATCH_HISTORY_STORAGE_KEY = 'voleiScoreMatchHistory';

let matchHistory = [];
// Estado de UI para filtros e visualização
let currentView = 'timeline'; // 'timeline' | 'cards'
let currentFilter = 'all'; // 'all' | 'mine'
let searchQuery = '';
let currentUser = null;

/**
 * Carrega o histórico de partidas do localStorage.
 */
function loadMatchHistoryFromLocalStorage() {
    const storedHistory = localStorage.getItem(MATCH_HISTORY_STORAGE_KEY);
    if (storedHistory) {
        try {
            matchHistory = JSON.parse(storedHistory);
            if (Array.isArray(matchHistory)) {
                matchHistory.sort((a, b) => {
                    const da = new Date(a.createdAt || a.savedAt || 0);
                    const db = new Date(b.createdAt || b.savedAt || 0);
                    return db - da;
                });
            }
        } catch (error) {
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
    } catch (error) {
        // silencioso
    }
}

/**
 * Adiciona uma partida ao histórico.
 * @param {object} matchData - Os dados da partida (teamA, teamB, score, winner, timeElapsed, location, etc.).
 */
export function addMatchToHistory(matchData, options = {}) {
    // Verifica se há jogadores selecionados em ambos os times
    const teamAHasPlayers = matchData.teamA && matchData.teamA.players && matchData.teamA.players.length > 0;
    const teamBHasPlayers = matchData.teamB && matchData.teamB.players && matchData.teamB.players.length > 0;
    
    if (!teamAHasPlayers || !teamBHasPlayers) {
        displayMessage('Não é possível salvar o jogo sem jogadores selecionados.', 'error');
        return;
    }
    
    // Se solicitado, salva silenciosamente sem perguntar
    if (options && options.silent) {
        (async () => {
            try {
                const matchWithId = { ...matchData, id: `match-${Date.now()}` };
                matchHistory.unshift(matchWithId);
                saveMatchHistoryToLocalStorage();

                if (navigator.onLine) {
                    const [{ getFirestoreDb, getAppId }, { getCurrentUser }] = await Promise.all([
                        import('../firebase/config.js'),
                        import('../firebase/auth.js')
                    ]);
                    const db = getFirestoreDb();
                    const appId = getAppId();
                    const user = getCurrentUser();
                    if (db && appId && user) {
                        const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
                        const matchWithUser = {
                            ...matchWithId,
                            userId: user.uid,
                            userDisplayName: user.displayName || 'Anônimo',
                            savedAt: new Date().toISOString()
                        };
                        const matchesCollection = collection(db, `artifacts/${appId}/public/data/matches`);
                        await addDoc(matchesCollection, matchWithUser);
                    }
                }
                // Mensagens silenciosas para não interromper fluxo automático
                renderMatchHistory();
            } catch (_) {
                renderMatchHistory();
            }
        })();
        return;
    }

    // Importa a função de confirmação e o Firebase
    Promise.all([
        import('./pages.js'),
        import('../firebase/config.js'),
        import('../firebase/auth.js')
    ]).then(([{ showConfirmationModal }, { getFirestoreDb, getAppId }, { getCurrentUser }]) => {
        showConfirmationModal(
            'Deseja salvar esta partida no histórico?',
            async () => {
                try {
                    // Adiciona um ID único à partida para facilitar a remoção
                    const matchWithId = { ...matchData, id: `match-${Date.now()}` };
                    
                    // Salva no localStorage
                    matchHistory.unshift(matchWithId);
                    saveMatchHistoryToLocalStorage();
                    
                    // Salva no Firebase se estiver online
                    if (navigator.onLine) {
                        const db = getFirestoreDb();
                        const appId = getAppId();
                        const user = getCurrentUser();
                        
                        if (db && appId && user) {
                            const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
                            const matchWithUser = {
                                ...matchWithId,
                                userId: user.uid,
                                userDisplayName: user.displayName || 'Anônimo',
                                savedAt: new Date().toISOString()
                            };
                            const matchesCollection = collection(db, `artifacts/${appId}/public/data/matches`);
                            await addDoc(matchesCollection, matchWithUser);
                            displayMessage('Partida salva no histórico local e na nuvem!', 'success');
                        } else {
                            displayMessage('Partida salva apenas no histórico local.', 'success');
                        }
                    } else {
                        displayMessage('Partida salva apenas no histórico local. Sincronize quando estiver online.', 'info');
                    }
                    
                    renderMatchHistory(); // Renderiza novamente o histórico
                } catch (error) {
                    displayMessage('Erro ao salvar na nuvem. Partida salva apenas localmente.', 'error');
                    renderMatchHistory();
                }
            }
        );
    });
}

/**
 * Exclui uma partida do histórico.
 * @param {string} matchId - O ID da partida a ser excluída.
 */
async function deleteMatch(matchId) {
    const initialLength = matchHistory.length;
    matchHistory = matchHistory.filter(match => match.id !== matchId);
    
    if (matchHistory.length < initialLength) {
        // Salva a alteração no localStorage
        saveMatchHistoryToLocalStorage();
        
        // Tenta excluir do Firebase se estiver online
        if (navigator.onLine) {
            try {
                const { getFirestoreDb, getAppId } = await import('../firebase/config.js');
                const { getCurrentUser } = await import('../firebase/auth.js');
                const { collection, query, where, getDocs, deleteDoc } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
                
                const db = getFirestoreDb();
                const appId = getAppId();
                const user = getCurrentUser();
                
                if (db && appId && user) {
                    const matchesCollection = collection(db, `artifacts/${appId}/public/data/matches`);
                    const q = query(matchesCollection, where("id", "==", matchId));
                    const querySnapshot = await getDocs(q);
                    
                    if (!querySnapshot.empty) {
                        const deletePromises = [];
                        querySnapshot.forEach((doc) => {
                            deletePromises.push(deleteDoc(doc.ref));
                        });
                        await Promise.all(deletePromises);
                        displayMessage('Registro do histórico excluído localmente e na nuvem.', 'success');
                    } else {
                        displayMessage('Registro excluído apenas localmente.', 'info');
                    }
                } else {
                    displayMessage('Registro excluído apenas localmente.', 'info');
                }
            } catch (error) {
                displayMessage('Erro ao excluir da nuvem. Registro excluído apenas localmente.', 'error');
            }
        } else {
            displayMessage('Registro excluído localmente. Sincronize quando estiver online.', 'info');
        }
        
        renderMatchHistory(); // Renderiza novamente o histórico
    } else {
        displayMessage('Erro: Registro do histórico não encontrado.', 'error');
    }
}

/**
 * Renderiza o histórico de partidas na interface do usuário.
 */
function renderMatchHistory() {
    const historyListContainer = Elements.historyListContainer();
    if (!historyListContainer) return;

    const filtered = applyFiltersAndSearch(matchHistory);
    updateHistoryStats(filtered);

    historyListContainer.innerHTML = '';
    if (filtered.length === 0) {
        historyListContainer.innerHTML = '<p class="empty-list-message">Nenhuma partida encontrada.</p>';
        return;
    }

    // Renderiza sempre cartões, agrupados por data (dd/MM/yyyy)
    renderGroupedCards(historyListContainer, filtered);
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
    
    // Usa createdAt ou savedAt, o que estiver disponível
    const matchDate = new Date(match.createdAt || match.savedAt);
    const formattedTime = matchDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const teamAName = match.teamA?.name || 'Time A';
    const teamBName = match.teamB?.name || 'Time B';

    // Cor dos times (usa salvo ou gera fallback determinístico)
    const guessColor = (name, fallbackIndex = 0) => {
        const palette = ['#325fda', '#f03737', '#4CAF50', '#FFC107', '#9C27B0', '#00BCD4'];
        if (!name) return palette[fallbackIndex % palette.length];
        let sum = 0; for (let i = 0; i < name.length; i++) sum = (sum + name.charCodeAt(i)) % 1000;
        return palette[sum % palette.length] || palette[fallbackIndex % palette.length];
    };
    const teamAColor = (match.teamA && match.teamA.color) ? match.teamA.color : guessColor(teamAName, 0);
    const teamBColor = (match.teamB && match.teamB.color) ? match.teamB.color : guessColor(teamBName, 1);

    // Cálculo de sets: prioriza match.sets; senão score.setsA/B
    const score = match.score || {};
    let setsA = 0, setsB = 0;
    if (Array.isArray(match.sets) && match.sets.length > 0) {
        setsA = match.sets.filter(s => s.winner === 'team1').length;
        setsB = match.sets.filter(s => s.winner === 'team2').length;
    } else {
        setsA = (typeof score.setsA === 'number') ? score.setsA : 0;
        setsB = (typeof score.setsB === 'number') ? score.setsB : 0;
    }

    // Vencedor robusto para cabeçalho/sections
    const headerWinnerSide = (() => {
        if (Array.isArray(match.sets) && match.sets.length > 0) {
            if (setsA > setsB) return 'team1';
            if (setsB > setsA) return 'team2';
        }
        if (typeof score.setsA === 'number' && typeof score.setsB === 'number') {
            if (score.setsA > score.setsB) return 'team1';
            if (score.setsB > score.setsA) return 'team2';
        }
        if (typeof match.winner === 'string') {
            const w = match.winner.toLowerCase();
            if (w === 'team1') return 'team1';
            if (w === 'team2') return 'team2';
            if (w === (teamAName || '').toLowerCase()) return 'team1';
            if (w === (teamBName || '').toLowerCase()) return 'team2';
        }
        return null;
    })();
    const isWinnerHeaderA = headerWinnerSide === 'team1';
    const isWinnerHeaderB = headerWinnerSide === 'team2';

    // Formatar duração do jogo
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };
    const gameTime = formatTime(match.timeElapsed || 0);

    // Criar listas de jogadores
    const createPlayerList = (teamPlayers) => {
        if (!teamPlayers || teamPlayers.length === 0) return '<ul><li>Sem jogadores</li></ul>';
        return `<ul>${teamPlayers.map(player => `<li>${player}</li>`).join('')}</ul>`;
    };

    // Criar itens de sets
    const createSetsItems = () => {
        if (!match.sets || match.sets.length === 0) {
            return `<div class="set-item">
                <span class="set-number">Set 1:</span>
                <div class="set-score">
                    <span class="${isWinnerHeaderA ? 'winner-score' : ''}">${teamAName} ${score.teamA ?? 0}</span>
                    <span> x </span>
                    <span class="${isWinnerHeaderB ? 'winner-score' : ''}">${score.teamB ?? 0} ${teamBName}</span>
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
            return `<div class="set-time-item"><div class="set-time"><span>00:00</span></div></div>`;
        }
        return match.sets.map((set) => {
            const setTime = formatTime(set.duration || 0);
            return `<div class="set-time-item"><div class="set-time"><span>${setTime}</span></div></div>`;
        }).join('');
    };

    // HEADER: coroas e badges (sem estilos, só peso/tamanho) + hora
    card.innerHTML = `
        <div class="date-time-info">
            <span class="match-history-header">
                ${isWinnerHeaderA ? '<span class="winner-crown" style="color:#FFD700; height: 100%;">👑</span>' : ''}
                <span style="color:${teamAColor}; font-weight: 800;">${teamAName}</span>
                <span class="set-badge" style="font-weight:900; font-size: large;">${setsA}</span>
                <span style="opacity:.6; padding: 0px;">vs</span>
                <span class="set-badge" style="font-weight:900; font-size: large;">${setsB}</span>
                <span style="color:${teamBColor}; font-weight: 800;">${teamBName}</span>
                ${isWinnerHeaderB ? '<span class="winner-crown" style="color:#FFD700;">👑</span>' : ''}
            </span>
            <div class="match-date">
                <span class="match-time-value" style="color: var(--text-secondary); font-size: 0.82rem;">${formattedTime}</span>
                <span class="material-icons match-expand-icon">expand_more</span>
            </div>
        </div>
        <div class="match-info">
            <div class="match-content">
                <div class="match-section">
                    <h4 class="section-title">Jogadores</h4>
                    <div class="players-container">
                        <div class="team-players team-a-players ${isWinnerHeaderA ? 'winner-team' : ''}">
                            ${createPlayerList(match.teamA.players)}
                        </div>
                        <div class="team-players team-b-players ${isWinnerHeaderB ? 'winner-team' : ''}">
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
                    <h4 class="section-title"><span class="material-icons">schedule</span></h4>
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
                <button class="delete-match-button" title="Excluir partida" style="display: ${match.userId ? 'none' : 'flex'}">
                    <span class="material-icons">delete</span>
                </button>
            </div>
        </div>
    `;
    
    // Adicionar funcionalidade de accordion
    const header = card.querySelector('.date-time-info');
    const content = card.querySelector('.match-info');
    const deleteButton = card.querySelector('.delete-match-button');
    
    // Verifica se o usuário atual é o criador da partida e mostra/esconde o botão de excluir
    import('../firebase/auth.js').then(({ getCurrentUser }) => {
        const user = getCurrentUser();
        if (user && match.userId === user.uid) {
            if (deleteButton) deleteButton.style.display = 'flex';
        } else {
            if (deleteButton) deleteButton.style.display = 'none';
        }
    });
    
    header.addEventListener('click', () => {
        header.classList.toggle('active');
        content.classList.toggle('active');
        const icon = header.querySelector('.match-expand-icon');
        if (content.classList.contains('active')) {
            content.style.maxHeight = content.scrollHeight + 'px';
            if (icon) icon.textContent = 'expand_less';
        } else {
            content.style.maxHeight = '0';
            if (icon) icon.textContent = 'expand_more';
        }
    });
    
    return card;
}

function renderGroupedCards(container, list) {
    const groups = new Map();
    list.forEach(m => {
        const d = new Date(m.createdAt || m.savedAt || 0);
        const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push(m);
    });

    for (const [label, arr] of groups.entries()) {
        const header = document.createElement('div');
        header.className = 'timeline-group-header';
        header.textContent = label;
        container.appendChild(header);
        arr.forEach(m => container.appendChild(createMatchCard(m)));
    }
}

function createTimelineItem(match) {
    const card = document.createElement('div');
    card.className = 'match-history-card';
    card.dataset.matchId = match.id;

    const d = new Date(match.createdAt || match.savedAt || 0);
    const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const teamAName = match.teamA?.name || 'Time A';
    const teamBName = match.teamB?.name || 'Time B';
    const score = match.score || {};
    let setsA = 0, setsB = 0;
    if (Array.isArray(match.sets) && match.sets.length > 0) {
        setsA = match.sets.filter(s => s.winner === 'team1').length;
        setsB = match.sets.filter(s => s.winner === 'team2').length;
    } else {
        setsA = (typeof score.setsA === 'number') ? score.setsA : 0;
        setsB = (typeof score.setsB === 'number') ? score.setsB : 0;
    }

    // Cores estimadas
    const guessColor = (name, fallbackIndex = 0) => {
        const palette = ['#325fda', '#f03737', '#4CAF50', '#FFC107', '#9C27B0', '#00BCD4'];
        if (!name) return palette[fallbackIndex % palette.length];
        let sum = 0; for (let i = 0; i < name.length; i++) sum = (sum + name.charCodeAt(i)) % 1000;
        return palette[sum % palette.length] || palette[fallbackIndex % palette.length];
    };
    const teamAColor = guessColor(teamAName, 0);
    const teamBColor = guessColor(teamBName, 1);

    // Vencedor para coroa na timeline
    const headerWinnerSide = (() => {
        if (Array.isArray(match.sets) && match.sets.length > 0) {
            if (setsA > setsB) return 'team1';
            if (setsB > setsA) return 'team2';
        }
        if (typeof score.setsA === 'number' && typeof score.setsB === 'number') {
            if (score.setsA > score.setsB) return 'team1';
            if (score.setsB > score.setsA) return 'team2';
        }
        if (typeof match.winner === 'string') {
            const w = match.winner.toLowerCase();
            if (w === 'team1') return 'team1';
            if (w === 'team2') return 'team2';
            if (w === (teamAName || '').toLowerCase()) return 'team1';
            if (w === (teamBName || '').toLowerCase()) return 'team2';
        }
        return null;
    })();
    const isWinnerHeaderA = headerWinnerSide === 'team1';
    const isWinnerHeaderB = headerWinnerSide === 'team2';

    card.innerHTML = `
        <div class="date-time-info">
            <span class="match-history-header">
                ${isWinnerHeaderA ? '<span class="winner-crown" style="color:#FFD700; margin-right:6px;">👑</span>' : ''}
                <span style="color:${teamAColor}; font-weight: 800;">${teamAName}</span>
                <span class="set-badge" style="font-weight:900; font-size: large; margin-left:6px;">${setsA}</span>
                <span style="opacity:.6; padding: 0 6px;">vs</span>
                <span class="set-badge" style="font-weight:900; font-size: large; margin-right:6px;">${setsB}</span>
                <span style="color:${teamBColor}; font-weight: 800;">${teamBName}</span>
                ${isWinnerHeaderB ? '<span class="winner-crown" style="color:#FFD700;">👑</span>' : ''}
            </span>
            <div class="match-date">
                <span class="match-time-value" style="color: var(--text-secondary); font-size: 0.82rem;">${timeStr}</span>
            </div>
        </div>
        <div class="match-footer">
            <div class="match-location">
                <span class="material-icons">location_on</span>
                <span>Local: ${match.location || 'Não informado'}</span>
            </div>
            <div class="match-duration">
                <span class="material-icons">timer</span>
                <span>${formatDuration(match.timeElapsed || 0)}</span>
                <button class="delete-match-button" title="Excluir partida" style="display: ${match.userId ? 'none' : 'flex'}">
                    <span class="material-icons">delete</span>
                </button>
            </div>
        </div>`;

    // Verifica botão de exclusão para o criador
    import('../firebase/auth.js').then(({ getCurrentUser }) => {
        const user = getCurrentUser();
        const delBtn = card.querySelector('.delete-match-button');
        if (delBtn) delBtn.style.display = (user && match.userId === user.uid) ? 'flex' : 'none';
    });

    return card;
}

function formatDuration(seconds) {
    const mins = Math.floor((seconds || 0) / 60);
    const secs = (seconds || 0) % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Configura os event listeners e a lógica para a página de histórico.
 */
export function setupHistoryPage() {
    loadMatchHistoryFromLocalStorage();

    const historyListContainer = Elements.historyListContainer();
    
    // Captura usuário atual para filtro "Meus"
    import('../firebase/auth.js').then(({ getCurrentUser }) => {
        try { currentUser = getCurrentUser(); } catch (e) { currentUser = null; }
        renderMatchHistory();
    });

    // Delegação de evento para exclusão (funciona em ambas as visualizações)
    if (historyListContainer) {
        historyListContainer.addEventListener('click', (event) => {
            if (event.target.closest('.delete-match-button')) {
                event.stopPropagation();
                const deleteButton = event.target.closest('.delete-match-button');
                const card = deleteButton.closest('.match-history-card');
                if (!card) return;
                const matchId = card.dataset.matchId;
                import('./pages.js').then(({ showConfirmationModal }) => {
                    showConfirmationModal('Tem certeza que deseja excluir este registro do histórico?', () => { deleteMatch(matchId); });
                });
            }
        });
    }

    // Controles de busca e limpar
    const searchInput = document.getElementById('history-search');
    const clearBtn = document.getElementById('history-clear-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            searchQuery = (searchInput.value || '').trim().toLowerCase();
            renderMatchHistory();
        });
    }
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const si = document.getElementById('history-search');
            if (si) si.value = '';
            searchQuery = '';
            renderMatchHistory();
        });
    }

    // Chips de filtro
    const chips = document.querySelectorAll('.filter-chips .chip');
    chips.forEach(ch => {
        ch.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            ch.classList.add('active');
            currentFilter = ch.dataset.filter || 'all';
            renderMatchHistory();
        });
    });

    // Render inicial
    renderMatchHistory();

    // Sync com Firebase em background
    loadMatchHistoryFromFirebase().then(loaded => {
        if (loaded) displayMessage('Histórico sincronizado com a nuvem!', 'success');
    });
}

/**
 * Carrega o histórico de partidas do Firebase.
 */
async function loadMatchHistoryFromFirebase() {
    if (!navigator.onLine) {
        return; // Se estiver offline, não tenta carregar do Firebase
    }
    
    try {
        const { getFirestoreDb, getAppId } = await import('../firebase/config.js');
        const { getCurrentUser } = await import('../firebase/auth.js');
        const { collection, query, orderBy, getDocs, limit } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
        
        const db = getFirestoreDb();
        const appId = getAppId();
        const user = getCurrentUser();
        
        if (db && appId && user) {
            const matchesCollection = collection(db, `artifacts/${appId}/public/data/matches`);
            const q = query(matchesCollection, orderBy("savedAt", "desc"), limit(100));
            const querySnapshot = await getDocs(q);
            
            const firebaseMatches = [];
            querySnapshot.forEach((doc) => {
                firebaseMatches.push({
                    ...doc.data(),
                    firestoreId: doc.id
                });
            });
            
            if (firebaseMatches.length > 0) {
                const firebaseIds = firebaseMatches.map(match => match.id);
                const localOnlyMatches = matchHistory.filter(match => !firebaseIds.includes(match.id));
                matchHistory = [...firebaseMatches, ...localOnlyMatches];
                matchHistory.sort((a, b) => {
                    const dateA = new Date(a.createdAt || a.savedAt || 0);
                    const dateB = new Date(b.createdAt || b.savedAt || 0);
                    return dateB - dateA;
                });
                saveMatchHistoryToLocalStorage();
                renderMatchHistory();
                return true;
            }
        }
    } catch (error) {
        // silencioso
    }
    
    return false;
}

// Helpers de lista e visualizações
function applyFiltersAndSearch(list) {
    let out = Array.isArray(list) ? list.slice() : [];
    // Ordena por data desc
    out.sort((a, b) => new Date(b.createdAt || b.savedAt || 0) - new Date(a.createdAt || a.savedAt || 0));

    // Filtro "meus" baseado em participação (nome do usuário na lista de jogadores)
    if (currentFilter === 'mine' && currentUser) {
        const name = (currentUser.displayName || '').trim().toLowerCase();
        out = out.filter(m => {
            if (!name) return false;
            const playersA = (m.teamA && Array.isArray(m.teamA.players) ? m.teamA.players.map(p => (p || '').trim().toLowerCase()) : []);
            const playersB = (m.teamB && Array.isArray(m.teamB.players) ? m.teamB.players.map(p => (p || '').trim().toLowerCase()) : []);
            return playersA.includes(name) || playersB.includes(name);
        });
    }

    // Busca textual: times, jogadores, local
    if (searchQuery) {
        const q = searchQuery;
        out = out.filter(m => {
            const teamA = (m.teamA && m.teamA.name ? m.teamA.name : '').toLowerCase();
            const teamB = (m.teamB && m.teamB.name ? m.teamB.name : '').toLowerCase();
            const playersA = (m.teamA && Array.isArray(m.teamA.players) ? m.teamA.players.join(' ') : '').toLowerCase();
            const playersB = (m.teamB && Array.isArray(m.teamB.players) ? m.teamB.players.join(' ') : '').toLowerCase();
            const location = (m.location || '').toLowerCase();
            return teamA.includes(q) || teamB.includes(q) || playersA.includes(q) || playersB.includes(q) || location.includes(q);
        });
    }

    return out;
}

function updateHistoryStats(list) {
    try {
        const winsEl = document.getElementById('history-wins');
        const lossesEl = document.getElementById('history-losses');
        const totalEl = document.getElementById('history-total');
        if (totalEl) totalEl.style.display = 'none'; // esconde a badge de partidas

        let wins = 0, losses = 0;
        const name = currentUser && currentUser.displayName ? currentUser.displayName.trim().toLowerCase() : '';

        list.forEach(m => {
            const playersA = (m.teamA && Array.isArray(m.teamA.players) ? m.teamA.players.map(p => (p || '').trim().toLowerCase()) : []);
            const playersB = (m.teamB && Array.isArray(m.teamB.players) ? m.teamB.players.map(p => (p || '').trim().toLowerCase()) : []);
            const onA = name && playersA.includes(name);
            const onB = name && playersB.includes(name);
            if (!onA && !onB) return; // conta apenas partidas em que participei

            const score = m.score || {};
            const setsA = (Array.isArray(m.sets) && m.sets.length > 0) ? m.sets.filter(s => s.winner === 'team1').length : (typeof score.setsA === 'number' ? score.setsA : 0);
            const setsB = (Array.isArray(m.sets) && m.sets.length > 0) ? m.sets.filter(s => s.winner === 'team2').length : (typeof score.setsB === 'number' ? score.setsB : 0);
            if (setsA === setsB) return; // ignora empates/imprecisos

            const userWon = (onA && setsA > setsB) || (onB && setsB > setsA);
            if (userWon) wins++; else losses++;
        });

        if (winsEl) winsEl.textContent = `${wins} ${wins === 1 ? 'vitória' : 'vitórias'}`;
        if (lossesEl) lossesEl.textContent = `${losses} ${losses === 1 ? 'derrota' : 'derrotas'}`;
    } catch (e) { /* ignore */ }
}
