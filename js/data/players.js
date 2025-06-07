// js/data/players.js
// Gerencia a lista de jogadores, incluindo armazenamento local e sincronização com Firestore.

import { getFirestoreDb, auth } from '../firebase/config.js';
import { collection, addDoc, deleteDoc, doc, onSnapshot, query } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getCurrentUser } from '../firebase/auth.js';
import { renderPlayersList } from '../ui/players-ui.js';
import { displayMessage } from '../ui/messages.js'; // NOVO: Importa a função de exibição de mensagens

let players = []; // Array para armazenar objetos de jogadores: { id: 'local_uuid', name: 'Nome do Jogador', firestoreId: 'firestore_doc_id' }
let currentAppId = null; // Para armazenar o appId uma vez que ele é passado
let firestoreUnsubscribe = null; // Para armazenar a função de unsubscribe do Firestore
let hasInitialFirestoreLoadCompleted = false; // NOVA FLAG: Para controlar o carregamento inicial do Firestore

/**
 * Gera um ID único para jogadores apenas locais (offline).\
 * @returns {string} Um ID único prefixado com 'local-'.
 */
function generateLocalId() {
    return `local-${crypto.randomUUID()}`;
}

/**
 * Salva a lista de jogadores no localStorage.\
 */
async function savePlayers() {
    try {
        const playersToSave = JSON.stringify(players);
        localStorage.setItem('volleyballPlayers', playersToSave);
        console.log("[savePlayers] Jogadores salvos no localStorage:", players); // Log para verificar o que está sendo salvo
    } catch (e) {
        console.error('[savePlayers] Erro ao salvar jogadores no localStorage:', e);
    }
}

/**
 * Carrega a lista de jogadores do localStorage ou inicializa vazia.
 * Renderiza imediatamente o que foi carregado.
 * @param {string} appId - O ID do aplicativo.
 */
export async function loadPlayers(appIdParam) {
    currentAppId = appIdParam; // Armazena o appId

    try {
        const storedPlayers = localStorage.getItem('volleyballPlayers');
        if (storedPlayers) {
            players = JSON.parse(storedPlayers);
            console.log("[loadPlayers] Jogadores carregados do localStorage:", players); // Log para verificar o que está sendo carregado
        } else {
            console.log("[loadPlayers] Nenhum jogador encontrado no localStorage. Iniciando com lista vazia.");
            players = []; // Garante que players seja um array vazio se nada for encontrado
        }
    } catch (e) {
        console.error('[loadPlayers] Erro ao carregar jogadores do localStorage, redefinindo:', e);
        players = []; // Redefine para vazio em caso de erro de parsing
    }

    renderPlayersList(players); // Renderiza imediatamente o que foi carregado do localStorage

    // O setupFirestorePlayersListener será chamado pelo auth.js APÓS a autenticação
    // para garantir que o 'db' e o 'user.uid' estejam prontos.
}

/**
 * Retorna a lista atual de jogadores.
 * @returns {Array<Object>} A lista de jogadores.
 */
export function getPlayers() {
    return players;
}

/**
 * Adiciona um novo jogador à lista e, se online, ao Firestore.
 * @param {string} playerName - O nome do jogador a ser adicionado.
 */
export async function addPlayer(playerName) {
    if (!playerName) {
        displayMessage('Por favor, digite um nome para o jogador.', 'info');
        return;
    }

    const trimmedName = playerName.trim();
    if (players.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
        displayMessage('Esse jogador já existe na lista.', 'info');
        return;
    }

    const newPlayer = {
        id: generateLocalId(), // Gera um ID local provisório
        name: trimmedName,
        firestoreId: null // Inicialmente nulo até ser salvo no Firestore
    };

    players.push(newPlayer); // Adiciona ao array local
    savePlayers(); // Salva a lista atualizada (com o novo jogador local) no localStorage
    renderPlayersList(players);
    displayMessage(`Jogador '${trimmedName}' adicionado!`, 'success');

    // Tenta salvar no Firestore se o usuário estiver autenticado e o db estiver disponível
    const user = getCurrentUser();
    // Verifica se estamos online antes de tentar adicionar ao Firestore
    const db = getFirestoreDb();
    if (navigator.onLine && user && db && user.uid && currentAppId) {
        try {
            const playersCollectionRef = collection(db, `artifacts/${currentAppId}/public/data/players`);
            const docRef = await addDoc(playersCollectionRef, {
                name: trimmedName,
                createdAt: new Date() // Opcional: timestamp
            });
            // Atualiza o jogador no array local com o ID do Firestore
            const playerIndex = players.findIndex(p => p.id === newPlayer.id);
            if (playerIndex > -1) {
                players[playerIndex].firestoreId = docRef.id;
                console.log(`[addPlayer] Jogador '${trimmedName}' salvo no Firestore com ID: ${docRef.id}`);
                savePlayers(); // Salva novamente para persistir o firestoreId no localStorage
            }
        } catch (error) {
            console.error("[addPlayer] Erro ao adicionar jogador ao Firestore:", error);
            displayMessage("Erro ao sincronizar jogador com a nuvem.", "error");
        }
    } else {
        displayMessage("Jogador salvo localmente. Conecte-se para sincronizar com a nuvem.", "info");
    }
}

/**
 * Remove um jogador da lista e, se online, do Firestore.
 * @param {string} playerId - O ID do jogador a ser removido.
 */
export async function removePlayer(playerId) {
    const playerToRemove = players.find(p => p.id === playerId);
    if (!playerToRemove) {
        console.warn(`Tentativa de remover jogador com ID não encontrado: ${playerId}`);
        return;
    }

    // Remove do array local
    players = players.filter(p => p.id !== playerId);
    savePlayers(); // Salva a lista local atualizada
    renderPlayersList(players);
    displayMessage(`Jogador '${playerToRemove.name}' removido.`, 'success');

    // Tenta remover do Firestore se tiver um firestoreId e o db estiver disponível
    const user = getCurrentUser();
    // Verifica se estamos online antes de tentar remover do Firestore
    const db = getFirestoreDb();
    if (navigator.onLine && playerToRemove.firestoreId && user && db && user.uid && currentAppId) {
        try {
            const playerDocRef = doc(db, `artifacts/${currentAppId}/public/data/players`, playerToRemove.firestoreId);
            await deleteDoc(playerDocRef);
            console.log(`[removePlayer] Jogador '${playerToRemove.name}' (Firestore ID: ${playerToRemove.firestoreId}) removido do Firestore.`);
            // O onSnapshot do Firestore irá atualizar a lista para outras sessões.
        } catch (error) {
            console.error("[removePlayer] Erro ao remover jogador do Firestore:", error);
            displayMessage("Erro ao sincronizar remoção com a nuvem.", "error");
        }
    } else {
        displayMessage("Jogador removido localmente.", "info");
    }
}

/**
 * Configura o listener do Firestore para a coleção de jogadores.
 * Este listener é responsável por manter a lista de jogadores atualizada em tempo real.
 * Ele gerencia a sincronização e prioriza dados locais em cenários offline.
 * @param {string} appId - O ID do aplicativo.
 */
export function setupFirestorePlayersListener(appId) {
    // Se o listener já existe, desinscreve para evitar duplicações
    if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
        console.log("[setupFirestorePlayersListener] Desinscrito do listener anterior do Firestore.");
    }

    const user = getCurrentUser();
    const db = getFirestoreDb();
    if (!user || !db || !appId) {
        console.log("[setupFirestorePlayersListener] Usuário não autenticado ou Firebase não inicializado. Não configurando listener do Firestore.");
        return; // Retorna sem configurar o listener se as dependências não estiverem prontas
    }

    const playersCollectionRef = collection(db, `artifacts/${appId}/public/data/players`);
    const q = query(playersCollectionRef);

    // O onSnapshot agora inclui `includeMetadataChanges: true` para melhor detecção de status offline/cache
    firestoreUnsubscribe = onSnapshot(q, { includeMetadataChanges: true }, async (snapshot) => {
        const firestorePlayers = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            firestorePlayers.push({
                id: doc.id,
                name: data.name,
                firestoreId: doc.id
            });
        });

        const isFromCache = snapshot.metadata.fromCache;
        const hasPendingWrites = snapshot.metadata.hasPendingWrites; // Indica se há alterações não sincronizadas

        console.log("[setupFirestorePlayersListener] Snapshot do Firestore recebido.");
        console.log(`  - firestorePlayers.length: ${firestorePlayers.length}`);
        console.log(`  - isFromCache: ${isFromCache}`);
        console.log(`  - hasPendingWrites: ${hasPendingWrites}`);
        console.log(`  - players.length (local): ${players.length}`);

        // LÓGICA REFINADA:
        // Prioridade para dados do Firestore SE:
        // 1. O snapshot veio do servidor (não do cache)
        // 2. O snapshot veio do cache, mas tem dados
        // 3. O snapshot veio do cache, mas possui escritas pendentes (indica que o cache está sendo atualizado por nós)
        // E só se estamos online, o Firestore é a fonte da verdade para dados vazios.

        if (firestorePlayers.length > 0 || !isFromCache || hasPendingWrites) {
            // Se o Firestore tem dados (seja do servidor ou do cache) OU
            // Se estamos online (não do cache) E temos dados (ou estamos fazendo um upload) OU
            // Se há escritas pendentes (o cache está sendo atualizado por nós)
            console.log("[setupFirestorePlayersListener] Firestore tem dados válidos ou estamos online/sincronizando. Atualizando players do Firestore.");
            players = firestorePlayers; // Sobrescreve com os dados do Firestore
        } else {
            // Este bloco será executado SOMENTE SE:
            // 1. O snapshot veio do cache (estamos offline)
            // 2. O snapshot está vazio (`firestorePlayers.length === 0`)
            // 3. NÃO há escritas pendentes (`!hasPendingWrites`)
            // E, IMPLICITAMENTE, `players.length` > 0 (pois `loadPlayers` já teria preenchido)
            console.log("[setupFirestorePlayersListener] Offline (cache vazio) e sem escritas pendentes. Preservando jogadores locais.");
            // Não faz nada aqui, `players` já contém os dados do `localStorage` e já está renderizado.
        }

        // Lógica de upload para Firestore se estiver online e Firestore vazio, e temos jogadores locais
        // Isso só deve acontecer UMA VEZ após a conexão ser restabelecida se o Firestore estiver vazio.
        if (!hasInitialFirestoreLoadCompleted && navigator.onLine && firestorePlayers.length === 0 && players.length > 0) {
            console.log("[setupFirestorePlayersListener] Primeira carga online do Firestore vazia, mas jogadores locais presentes. Iniciando upload.");
            for (const player of players) {
                if (!player.firestoreId) { // Apenas suba jogadores que ainda não têm um firestoreId
                    try {
                        const docRef = await addDoc(playersCollectionRef, {
                            name: player.name,
                            createdAt: new Date()
                        });
                        player.firestoreId = docRef.id; // Atualiza o ID local
                        console.log(`[setupFirestorePlayersListener] Jogador '${player.name}' subido para o Firestore com ID: ${docRef.id}`);
                    } catch (error) {
                        console.error(`[setupFirestorePlayersListener] Erro ao subir jogador '${player.name}' para Firestore:`, error);
                        displayMessage(`Erro ao sincronizar jogador '${player.name}' para a nuvem.`, "error");
                    }
                }
            }
            savePlayers(); // Salva jogadores locais com os novos firestoreIds no localStorage
            displayMessage("Jogadores locais sincronizados com a nuvem!", "success");
        }

        // SEMPRE ordenar e renderizar a lista de jogadores no final do processamento do snapshot
        // Isso garante que a UI reflita o estado atual de 'players' após as decisões acima.
        players.sort((a, b) => a.name.localeCompare(b.name));
        savePlayers(); // Salva a lista final (seja do Firestore ou local) no localStorage
        renderPlayersList(players);
        console.log("[setupFirestorePlayersListener] Renderização da lista de jogadores concluída.");

        hasInitialFirestoreLoadCompleted = true; // Marca que a carga inicial do Firestore foi processada
    }, (error) => {
        console.error("[setupFirestorePlayersListener] Erro ao ouvir jogadores do Firestore:", error);
        displayMessage("Erro ao carregar jogadores do Firestore. Verifique sua conexão.", "error");
        // Em caso de erro, não sobrescreva os dados locais. Mantenha o que já foi carregado do localStorage.
        hasInitialFirestoreLoadCompleted = true; // Marca como completa para não tentar upload repetidamente em erros
    });
}
