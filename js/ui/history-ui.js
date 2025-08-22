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
    // // Log removido // Removido log de depuração
    if (storedHistory) {
        try {
            matchHistory = JSON.parse(storedHistory);
        } catch (error) {
            // Removido: // Log removido
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
        // // Log removido // Removido log de depuração
    } catch (error) {
        // Removido: // Log removido
        // Removido: displayMessage('Erro ao salvar o histórico.', 'error');
    }
}

/**
 * Adiciona uma partida ao histórico.
 * @param {object} matchData - Os dados da partida (teamA, teamB, score, winner, timeElapsed, location, etc.).
 */
export function addMatchToHistory(matchData) {
    // Verifica se há jogadores selecionados em ambos os times
    const teamAHasPlayers = matchData.teamA && matchData.teamA.players && matchData.teamA.players.length > 0;
    const teamBHasPlayers = matchData.teamB && matchData.teamB.players && matchData.teamB.players.length > 0;
    
    if (!teamAHasPlayers || !teamBHasPlayers) {
        displayMessage('Não é possível salvar o jogo sem jogadores selecionados.', 'error');
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
                            // Importa as funções necessárias do Firestore
                            const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js");
                            
                            // Adiciona dados do usuário ao registro
                            const matchWithUser = {
                                ...matchWithId,
                                userId: user.uid,
                                userDisplayName: user.displayName || 'Anônimo',
                                savedAt: new Date().toISOString()
                            };
                            
                            // Salva no Firestore - usando o caminho correto para a coleção de partidas
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
                    // Log removido
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
    const matchToDelete = matchHistory.find(match => match.id === matchId);
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
                    // Busca o documento no Firestore pelo ID da partida
                    const matchesCollection = collection(db, `artifacts/${appId}/public/data/matches`);
                    const q = query(matchesCollection, where("id", "==", matchId));
                    const querySnapshot = await getDocs(q);
                    
                    if (!querySnapshot.empty) {
                        // Exclui todos os documentos encontrados (normalmente será apenas um)
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
                // Log removido
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
    const historyListContainer = Elements.historyListContainer(); // Chamada da função
    if (!historyListContainer) {
        // Removido: // Log removido
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
    
    // Verifica se o usuário atual é o criador da partida
    const isCreator = async () => {
        try {
            const { getCurrentUser } = await import('../firebase/auth.js');
            const user = getCurrentUser();
            return user && match.userId === user.uid;
        } catch (e) {
            return false;
        }
    };
    
    // Usa createdAt ou savedAt, o que estiver disponível
    const matchDate = new Date(match.createdAt || match.savedAt);
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
                    <span>00:00</span>
                </div>
            </div>`;
        }
        
        return match.sets.map((set, index) => {
            const setTime = formatTime(set.duration || 0);
            return `<div class="set-time-item">
                <div class="set-time">
                    <span>${setTime}</span>
                </div>
            </div>`;
        }).join('');
    };

    card.innerHTML = `
        <div class="date-time-info">
            <span class="match-history-header">
                <span class="${isTeamAWinner ? 'team-winner' : ''}">${teamAName} ${match.score.setsA}</span> 
                vs 
                <span class="${isTeamBWinner ? 'team-winner' : ''}">${match.score.setsB} ${teamBName}</span>
            </span>
            <div class="match-date">
                <span class="match-date-span">
                    <span class="match-date-value">${formattedDate}</span>
                    <span class="match-time-value">${formattedTime}</span>
                    ${match.userDisplayName ? `<small style="font-size: 0.7rem; opacity: 0.7; display: block;">por ${match.userDisplayName}</small>` : ''}
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
                            ${createPlayerList(match.teamA.players)}
                        </div>
                        <div class="team-players team-b-players ${isTeamBWinner ? 'winner-team' : ''}">
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
            // Busca todas as partidas no Firestore, não apenas do usuário atual
            const matchesCollection = collection(db, `artifacts/${appId}/public/data/matches`);
            const q = query(matchesCollection, orderBy("savedAt", "desc"), limit(100));
            const querySnapshot = await getDocs(q);
            
            const firebaseMatches = [];
            querySnapshot.forEach((doc) => {
                // Adiciona o ID do documento para facilitar operações futuras
                firebaseMatches.push({
                    ...doc.data(),
                    firestoreId: doc.id
                });
            });
            
            // Mescla com o histórico local, priorizando dados do Firebase
            if (firebaseMatches.length > 0) {
                // Filtra partidas locais que não existem no Firebase
                const firebaseIds = firebaseMatches.map(match => match.id);
                const localOnlyMatches = matchHistory.filter(match => !firebaseIds.includes(match.id));
                
                // Combina partidas do Firebase com partidas locais exclusivas
                matchHistory = [...firebaseMatches, ...localOnlyMatches];
                
                // Ordena por data de criação (mais recentes primeiro)
                matchHistory.sort((a, b) => {
                    const dateA = new Date(a.createdAt || a.savedAt || 0);
                    const dateB = new Date(b.createdAt || b.savedAt || 0);
                    return dateB - dateA;
                });
                
                // Salva a versão mesclada no localStorage
                saveMatchHistoryToLocalStorage();
                
                // Renderiza o histórico atualizado
                renderMatchHistory();
                return true;
            }
        }
    } catch (error) {
        // Log removido
    }
    
    return false;
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
                
                import('./pages.js').then(({ showConfirmationModal }) => {
                    showConfirmationModal(
                        'Tem certeza que deseja excluir este registro do histórico?',
                        () => {
                            deleteMatch(matchId);
                        }
                    );
                });
            }
        });
    }

    // Renderiza o histórico sempre que a página é configurada
    renderMatchHistory();
    
    // Tenta carregar dados do Firebase em segundo plano
    loadMatchHistoryFromFirebase().then(loaded => {
        if (loaded) {
            displayMessage('Histórico sincronizado com a nuvem!', 'success');
        }
    });
}
