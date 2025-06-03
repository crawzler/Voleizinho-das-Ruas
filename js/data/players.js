// js/data/players.js
// Gerencia a lista de jogadores, incluindo armazenamento local e sincronização com Firestore.

import { db, auth } from '../firebase/config.js';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getCurrentUser } from '../firebase/auth.js';
import { renderPlayersList } from '../ui/players-ui.js'; // Removido updatePlayerModificationAbility, pois não é exportado por players-ui.js

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
 * @param {string} appId - O ID do aplicativo.
 */
export async function loadPlayers(appId) {
    currentAppId = appId; // Define o appId para uso em outras funções
    try {
        const storedPlayers = localStorage.getItem('volleyballPlayers');
        if (storedPlayers) {
            players = JSON.parse(storedPlayers);
            console.log("Jogadores carregados do localStorage.");
            renderPlayersList(players); // Renderiza a lista de jogadores carregada
        } else {
            players = []; // Inicializa como vazio se não houver dados
        }
    } catch (e) {
        console.error('Erro ao carregar jogadores do localStorage:', e);
        players = []; // Garante que players seja um array mesmo em caso de erro
    }
}

/**
 * Adiciona um novo jogador à lista e, se autenticado, ao Firestore.
 * @param {string} playerName - O nome do jogador a ser adicionado.
 */
export async function addPlayer(playerName) {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.isAnonymous) {
        console.warn("Ação não permitida: Você precisa estar logado com uma conta não anônima para adicionar jogadores.");
        // Opcional: exibir uma mensagem na UI para o usuário
        return;
    }

    if (!playerName || playerName.trim() === '') {
        console.warn("Nome do jogador não pode ser vazio.");
        return;
    }

    const newPlayer = {
        id: generateLocalId(), // ID local para uso imediato na UI
        name: playerName.trim(),
        firestoreId: null // Será preenchido se salvo no Firestore
    };

    players.push(newPlayer);
    savePlayers();
    renderPlayersList(players); // Renderiza imediatamente após a adição local

    if (currentUser && !currentUser.isAnonymous && navigator.onLine && db && currentAppId) {
        try {
            const docRef = await addDoc(collection(db, `artifacts/${currentAppId}/public/data/players`), {
                name: newPlayer.name,
                userId: currentUser.uid, // Associa o jogador ao UID do usuário
                createdAt: new Date()
            });
            newPlayer.firestoreId = docRef.id; // Atualiza o objeto com o ID do Firestore
            savePlayers(); // Salva novamente para persistir o firestoreId
            console.log(`Jogador \"${newPlayer.name}\" adicionado ao Firestore com ID: ${docRef.id}`);
        } catch (error) {
            console.error("Erro ao adicionar jogador ao Firestore:", error);
            // Se falhar no Firestore, o jogador ainda estará no localStorage
        }
    } else {
        console.log("Offline ou usuário anônimo/DB não inicializado, jogador adicionado apenas localmente.");
    }
}

/**
 * Remove um jogador da lista e, se aplicável, do Firestore.
 * @param {string} playerIdToRemove - O ID do jogador a ser removido (local ou Firestore ID).
 */
export async function removePlayer(playerIdToRemove) {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.isAnonymous) {
        console.warn("Ação não permitida: Você precisa estar logado com uma conta não anônima para remover jogadores.");
        return;
    }

    const indexToRemove = players.findIndex(p => p.id === playerIdToRemove);

    if (indexToRemove !== -1) {
        const playerToRemove = players[indexToRemove];

        players.splice(indexToRemove, 1);
        savePlayers();
        renderPlayersList(players); // Renderiza imediatamente após a remoção local

        if (playerToRemove.firestoreId && navigator.onLine && db && currentAppId) {
            const playerDocRef = doc(db, `artifacts/${currentAppId}/public/data/players`, playerToRemove.firestoreId);
            try {
                await deleteDoc(playerDocRef);
                console.log(`Jogador \"${playerToRemove.name}\" (ID: ${playerToRemove.firestoreId}) removido do Firestore.`);
            } catch (error) {
                console.error(`Erro ao remover jogador \"${playerToRemove.name}\" do Firestore:`, error);
            }
        } else {
            console.log("Offline ou DB não inicializado, jogador removido apenas localmente.");
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
 * Configura um listener em tempo real para a coleção de jogadores no Firestore.
 * @param {string} appId - O ID do aplicativo.
 */
export function setupFirestorePlayersListener(appId) {
    currentAppId = appId;
    const currentUser = getCurrentUser();

    if (!db || !currentUser || currentUser.isAnonymous) {
        console.log("Firestore ou usuário anônimo/não autenticado. Listener de jogadores não será configurado.");
        return;
    }

    const playersCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/players`);
    const q = query(playersCollectionRef); // Não filtra por userId aqui, pois é uma coleção pública

    onSnapshot(q, (snapshot) => {
        const firestorePlayers = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            // Apenas adiciona jogadores que pertencem ao usuário atual ou que são públicos
            // No caso de dados públicos, todos os jogadores são visíveis
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
        console.log("Jogadores atualizados via Firestore snapshot.");
    }, (error) => {
        console.error("Erro ao ouvir jogadores do Firestore:", error);
    });
}
