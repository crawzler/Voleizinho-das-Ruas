// js/data/players.js
// Gerencia a lista de jogadores, incluindo armazenamento local e sincronização com Firestore.

import { db, auth } from '../firebase/config.js';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getCurrentUser } from '../firebase/auth.js';
import { renderPlayersList } from '../ui/players-ui.js';
import { displayMessage } from '../ui/messages.js'; // NOVO: Importa a função de exibição de mensagens

let players = []; // Array para armazenar objetos de jogadores: { id: 'local_uuid', name: 'Nome do Jogador', firestoreId: 'firestore_doc_id' }
let currentAppId = null; // Para armazenar o appId uma vez que ele é passado

/**
 * Gera um ID único para jogadores apenas locais (offline).
 * @returns {string} Um ID único prefixado com 'local-'.
 */
function generateLocalId() {
    return `local-${crypto.randomUUID()}`;
}

/**
 * Salva a lista de jogadores no localStorage.
 */
async function savePlayers() {
    try {
        localStorage.setItem('volleyballPlayers', JSON.stringify(players));
        console.log("Jogadores salvos no localStorage.");
    } catch (e) {
        console.error('Erro ao salvar jogadores no localStorage:', e);
    }
}

/**
 * Carrega a lista de jogadores do localStorage e configura um listener para sincronizar com o Firestore.
 * @param {string} appId - O ID do aplicativo.
 */
export async function loadPlayers(appId) {
    currentAppId = appId;
    try {
        const storedPlayers = localStorage.getItem('volleyballPlayers');
        if (storedPlayers) {
            players = JSON.parse(storedPlayers);
            console.log("[loadPlayers] Jogadores carregados do localStorage:", players);
        } else {
            players = [];
            console.log("[loadPlayers] Nenhum jogador encontrado no localStorage.");
        }
        renderPlayersList(players); 
    } catch (e) {
        console.error('[loadPlayers] Erro ao carregar jogadores do localStorage:', e);
        players = [];
    }

    const currentUser = getCurrentUser();
    // Configura o listener do Firestore para a coleção pública se houver um usuário autenticado (incluindo anônimos)
    if (currentUser) {
        console.log("[loadPlayers] Usuário autenticado (anônimo ou não). Configurando listener do Firestore para dados PÚBLICOS.");
        setupFirestorePlayersListener(appId); // Não passa currentUser, pois a coleção é pública
    } else {
        console.log("[loadPlayers] Nenhum usuário autenticado. Não configurando listener do Firestore.");
        // Garante que a lista local seja renderizada para usuários não autenticados
        renderPlayersList(players);
    }
}

/**
 * Adiciona um novo jogador à lista e ao Firestore (se o usuário tiver permissão).
 * @param {string} playerName - O nome do jogador a ser adicionado.
 */
export async function addPlayer(playerName) {
    const newPlayer = {
        id: generateLocalId(), // ID local para uso imediato na UI
        name: playerName
    };

    // Adiciona ao array local
    players.push(newPlayer);
    savePlayers(); // Salva no localStorage

    // Renderiza a lista atualizada
    renderPlayersList(players);

    const currentUser = getCurrentUser();
    console.log("[addPlayer] currentUser:", currentUser);
    
    // Apenas tenta adicionar ao Firestore se o usuário estiver autenticado e NÃO for anônimo (para UX)
    // A segurança final é garantida pelas regras do Firestore.
    if (currentUser && !currentUser.isAnonymous) {
        console.log(`[addPlayer] Usuário autenticado (${currentUser.uid}) e NÃO anônimo. Tentando adicionar ao Firestore na coleção PÚBLICA.`);
        try {
            if (!db) {
                console.error("[addPlayer] Erro: Firestore DB não inicializado.");
                displayMessage("Erro interno: Banco de dados não inicializado.", "error");
                return;
            }
            if (!currentAppId) {
                console.error("[addPlayer] Erro: App ID não definido. loadPlayers deve ser chamado primeiro.");
                displayMessage("Erro interno: ID do aplicativo não definido.", "error");
                return;
            }

            // Altera o caminho da coleção para a coleção pública de jogadores
            const publicPlayersCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/players`);
            console.log(`[addPlayer] Caminho da coleção Firestore: artifacts/${currentAppId}/public/data/players`);
            console.log(`[addPlayer] Adicionando jogador '${playerName}' ao Firestore.`);

            const docRef = await addDoc(publicPlayersCollectionRef, { name: playerName, createdAt: new Date() });
            // Atualiza o jogador local com o firestoreId
            const playerIndex = players.findIndex(p => p.id === newPlayer.id);
            if (playerIndex !== -1) {
                players[playerIndex].firestoreId = docRef.id;
                savePlayers(); // Salva novamente com o firestoreId
            }
            displayMessage("Jogador adicionado com sucesso!", "success");
            console.log("[addPlayer] Jogador adicionado ao Firestore com ID:", docRef.id);
        } catch (e) {
            console.error("[addPlayer] ERRO ao adicionar jogador ao Firestore:", e);
            displayMessage("Erro ao adicionar jogador. Verifique suas permissões.", "error");
            // Opcional: remover o jogador do array local se a adição ao Firestore falhar
            players = players.filter(p => p.id !== newPlayer.id);
            savePlayers();
            renderPlayersList(players);
        }
    } else {
        // Substitui console.warn por displayMessage para o usuário
        displayMessage("Você não tem permissão para adicionar jogadores.", "error");
        console.warn("[addPlayer] Apenas usuários autenticados (não anônimos) podem salvar jogadores no Firestore. Operação bloqueada no frontend.");
    }
}

/**
 * Remove um jogador da lista e do Firestore (se o usuário tiver permissão).
 * @param {string} playerIdToRemove - O ID local do jogador a ser removido.
 */
export async function removePlayer(playerIdToRemove) {
    const playerToRemove = players.find(p => p.id === playerIdToRemove);

    if (!playerToRemove) {
        console.warn("[removePlayer] Jogador não encontrado para remoção:", playerIdToRemove);
        displayMessage("Jogador não encontrado.", "error");
        return;
    }

    // Remove do array local
    players = players.filter(p => p.id !== playerIdToRemove);
    savePlayers(); // Salva no localStorage

    // Renderiza a lista atualizada
    renderPlayersList(players);

    const currentUser = getCurrentUser();
    console.log("[removePlayer] currentUser:", currentUser);

    // Apenas tenta remover do Firestore se o jogador tiver um firestoreId e o usuário estiver autenticado E NÃO for anônimo (para UX)
    // A segurança final é garantida pelas regras do Firestore.
    if (currentUser && !currentUser.isAnonymous && playerToRemove.firestoreId) {
        console.log(`[removePlayer] Usuário autenticado (${currentUser.uid}) e NÃO anônimo. Tentando remover do Firestore da coleção PÚBLICA.`);
        try {
            if (!db) {
                console.error("[removePlayer] Erro: Firestore DB não inicializado.");
                displayMessage("Erro interno: Banco de dados não inicializado.", "error");
                return;
            }
            if (!currentAppId) {
                console.error("[removePlayer] Erro: App ID não definido. loadPlayers deve ser chamado primeiro.");
                displayMessage("Erro interno: ID do aplicativo não definido.", "error");
                return;
            }

            // Altera o caminho do documento para a coleção pública de jogadores
            const playerDocRef = doc(db, `artifacts/${currentAppId}/public/data/players`, playerToRemove.firestoreId);
            console.log(`[removePlayer] Caminho do documento Firestore para remover: artifacts/${currentAppId}/public/data/players/${playerToRemove.firestoreId}`);

            await deleteDoc(playerDocRef);
            displayMessage("Jogador removido com sucesso!", "success");
            console.log("[removePlayer] Jogador removido do Firestore:", playerToRemove.firestoreId);
        } catch (e) {
            console.error("[removePlayer] ERRO ao remover jogador do Firestore:", e);
            displayMessage("Erro ao remover jogador. Verifique suas permissões.", "error");
            // Opcional: readicionar o jogador ao array local se a remoção do Firestore falhar
            players.push(playerToRemove);
            savePlayers();
            renderPlayersList(players);
        }
    } else {
        // Substitui console.warn por displayMessage para o usuário
        displayMessage("Você não tem permissão para remover jogadores.", "error");
        console.warn("[removePlayer] Apenas usuários autenticados (não anônimos) podem remover jogadores do Firestore. Operação bloqueada no frontend.");
    }
}

/**
 * Retorna a lista atual de jogadores.
 * @returns {Array<Object>} A lista de jogadores.
 */
export function getPlayers() {
    return players;
}

/**
 * Configura um listener em tempo real para a coleção de jogadores PÚBLICA no Firestore.
 * @param {string} appId - O ID do aplicativo.
 */
export function setupFirestorePlayersListener(appId) {
    // Não verifica mais o currentUser aqui, pois a coleção é pública e acessível a qualquer autenticado.
    if (!db) {
        console.error("[setupFirestorePlayersListener] Erro: Firestore DB não inicializado.");
        return;
    }
    if (!appId) {
        console.error("[setupFirestorePlayersListener] Erro: App ID não definido.");
        return;
    }

    console.log(`[setupFirestorePlayersListener] Configurando onSnapshot para a coleção PÚBLICA: artifacts/${appId}/public/data/players`);
    const publicPlayersCollectionRef = collection(db, `artifacts/${appId}/public/data/players`);
    onSnapshot(publicPlayersCollectionRef, (snapshot) => {
        const firestorePlayers = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            firestorePlayers.push({
                id: doc.id, // Usar o ID do Firestore como ID principal
                name: data.name,
                firestoreId: doc.id
            });
        });

        // Mescla jogadores do localStorage com jogadores do Firestore
        // Prioriza jogadores do Firestore se houver conflito de nome (ou ID se você tiver um esquema mais complexo)
        const mergedPlayers = {};

        // Adiciona jogadores do Firestore primeiro
        firestorePlayers.forEach(p => {
            mergedPlayers[p.name] = p; // Usa o nome como chave para evitar duplicatas
        });

        // Adiciona jogadores do localStorage que não estão no Firestore
        players.forEach(p => {
            if (!mergedPlayers[p.name]) {
                mergedPlayers[p.name] = p;
            }
        });

        players = Object.values(mergedPlayers); // Converte de volta para array
        savePlayers(); // Salva a lista mesclada no localStorage
        renderPlayersList(players); // Renderiza a lista atualizada
        console.log("[setupFirestorePlayersListener] Jogadores atualizados via Firestore snapshot.");
    }, (error) => {
        console.error("[setupFirestorePlayersListener] Erro ao ouvir jogadores do Firestore:", error);
        displayMessage("Erro ao carregar jogadores do Firestore.", "error");
    });
}
