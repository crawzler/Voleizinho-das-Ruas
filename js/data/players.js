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
 * Carrega a lista de jogadores do localStorage.
 */
function loadPlayersFromLocalStorage() {
    try {
        const storedPlayers = localStorage.getItem('volleyballPlayers');
        if (storedPlayers) {
            players = JSON.parse(storedPlayers);
            console.log("Jogadores carregados do localStorage.");
        }
    } catch (e) {
        console.error('Erro ao carregar jogadores do localStorage:', e);
        players = []; // Garante que players seja um array vazio em caso de erro
    }
}

/**
 * Inicializa o módulo de jogadores carregando do localStorage e configurando o listener do Firestore.
 * @param {string} appId - O ID do aplicativo.
 */
export function loadPlayers(appId) {
    currentAppId = appId;
    loadPlayersFromLocalStorage();
    // A renderização inicial será feita pelo listener do Firestore ou diretamente se não houver Firestore.
    // renderPlayersList(players); // Removido, pois o listener do Firestore ou a lógica de fallback o fará.
}

/**
 * Adiciona um novo jogador. Se o usuário estiver autenticado, tenta adicionar ao Firestore.
 * Caso contrário, adiciona apenas localmente.
 * @param {string} playerName - O nome do jogador a ser adicionado.
 * @param {string} userId - O ID do usuário autenticado (pode ser null para usuários não logados).
 * @param {string} appId - O ID do aplicativo.
 */
export async function addPlayer(playerName, userId, appId) { // Adicionado appId
    if (!playerName) {
        displayMessage("O nome do jogador não pode ser vazio.", "error");
        return;
    }

    // Verifica se o jogador já existe localmente (para evitar duplicatas visíveis antes do Firestore)
    if (players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
        displayMessage(`O jogador '${playerName}' já existe.`, "info");
        return;
    }

    // Se o usuário estiver logado, tenta adicionar ao Firestore
    if (userId && auth.currentUser) { // Qualquer usuário autenticado (anônimo ou Google)
        try {
            const playerRef = await addDoc(collection(db, `artifacts/${appId}/public/data/players`), { // Usando appId
                name: playerName,
                createdAt: new Date()
            });
            console.log("Jogador adicionado ao Firestore com ID:", playerRef.id);
            displayMessage(`Jogador '${playerName}' adicionado ao Firestore.`, "success");
            // O listener do Firestore (setupFirestorePlayersListener) irá atualizar a lista 'players' e a UI
        } catch (e) {
            console.error("Erro ao adicionar jogador ao Firestore:", e);
            displayMessage("Erro ao adicionar jogador ao Firestore.", "error");
        }
    } else {
        // Adiciona apenas localmente se não houver userId (não logado)
        const newPlayer = { id: generateLocalId(), name: playerName };
        players.push(newPlayer);
        savePlayers(); // Salva no localStorage
        renderPlayersList(players); // Renderiza a lista atualizada
        displayMessage(`Jogador '${playerName}' adicionado localmente.`, "success");
    }
}

/**
 * Remove um jogador. Se o jogador tiver um firestoreId e o usuário estiver autenticado,
 * tenta remover do Firestore. Caso contrário, remove apenas localmente.
 * @param {string} playerId - O ID local ou firestoreId do jogador a ser removido.
 * @param {string} userId - O ID do usuário autenticado (pode ser null para usuários não logados).
 * @param {string} appId - O ID do aplicativo.
 */
export async function removePlayer(playerId, userId, appId) { // Adicionado appId
    if (!playerId) {
        console.error("ID do jogador inválido para remoção.");
        displayMessage("Erro: ID do jogador inválido.", "error");
        return;
    }

    const playerToRemove = players.find(p => p.id === playerId);

    if (!playerToRemove) {
        displayMessage("Jogador não encontrado para remoção.", "error");
        return;
    }

    // Se o usuário estiver logado E o jogador tiver um firestoreId, tenta remover do Firestore
    if (userId && auth.currentUser && playerToRemove.firestoreId) {
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/public/data/players`, playerToRemove.firestoreId)); // Usando appId
            console.log("Jogador removido do Firestore com ID:", playerToRemove.firestoreId);
            displayMessage(`Jogador '${playerToRemove.name}' removido do Firestore.`, "success");
            // O listener do Firestore irá atualizar a lista 'players' e a UI
        } catch (e) {
            console.error("Erro ao remover jogador do Firestore:", e);
            displayMessage("Erro ao remover jogador do Firestore.", "error");
        }
    } else {
        // Remove apenas localmente se não tiver firestoreId ou se não estiver logado
        const initialLength = players.length;
        players = players.filter(p => p.id !== playerId);
        if (players.length < initialLength) {
            savePlayers(); // Salva no localStorage
            renderPlayersList(players); // Renderiza a lista atualizada
            displayMessage(`Jogador '${playerToRemove.name}' removido localmente.`, "success");
        } else {
            displayMessage("Jogador não encontrado para remoção local.", "error");
        }
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
 * Configura o listener do Firestore para a coleção de jogadores.
 * Este listener sincroniza a lista local de jogadores com o Firestore em tempo real.
 * @param {string} appId - O ID do aplicativo.
 * @param {string} userId - O ID do usuário autenticado.
 */
export function setupFirestorePlayersListener(appId, userId) {
    if (!db || !appId || !userId) {
        console.warn("[setupFirestorePlayersListener] Firestore, App ID ou User ID não disponíveis. Não será possível sincronizar jogadores com Firestore.");
        // Se não houver Firestore ou autenticação, apenas renderiza o que está no localStorage
        renderPlayersList(players);
        return;
    }

    const playersCollectionRef = collection(db, `artifacts/${appId}/public/data/players`); // Usando appId
    const q = query(playersCollectionRef); // Opcional: adicionar orderBy se necessário, mas pode exigir índices no Firestore

    onSnapshot(q, (snapshot) => {
        const firestorePlayers = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            firestorePlayers.push({
                id: doc.id, // Usar o ID do Firestore como ID principal
                name: data.name,
                firestoreId: doc.id
            });
        });

        // SIMPLIFICADO: A lista 'players' agora reflete diretamente o que está no Firestore.
        // Isso garante que adições e remoções do Firestore sejam imediatamente refletidas.
        players = firestorePlayers;
        // NOVO: Ordena os jogadores por nome em ordem alfabética
        players.sort((a, b) => a.name.localeCompare(b.name));
        savePlayers(); // Salva a lista atualizada (que agora reflete o Firestore) no localStorage
        renderPlayersList(players); // Renderiza a lista atualizada
        console.log("[setupFirestorePlayersListener] Jogadores atualizados via Firestore snapshot.");
    }, (error) => {
        console.error("[setupFirestorePlayersListener] Erro ao ouvir jogadores do Firestore:", error);
        displayMessage("Erro ao carregar jogadores do Firestore.", "error");
    });
}
