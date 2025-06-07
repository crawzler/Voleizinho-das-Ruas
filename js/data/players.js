// js/data/players.js
// Gerencia a lista de jogadores, incluindo armazenamento local e sincronização com Firestore.

// Removido 'auth' e 'getFirestoreDb' de config.js, pois as instâncias são passadas como parâmetros.
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getCurrentUser } from '../firebase/auth.js';
import { renderPlayersList } from '../ui/players-ui.js';
import { displayMessage } from '../ui/messages.js';

const PLAYERS_STORAGE_KEY = 'volleyballPlayers';
const PUBLIC_PLAYERS_COLLECTION_PATH = 'artifacts/{appId}/public/data/players'; // NOVO: Caminho para a coleção pública

// Global array to store players. Always initialized from localStorage.
let players = []; 
let currentAppId = null;
let firestoreUnsubscribe = null;
let hasInitialFirestoreLoadAttempted = false; // Renamed for clarity: tracks if initial Firebase load was *attempted*
let currentDbInstance = null; // To hold the db instance passed from setupFirestorePlayersListener

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
function savePlayersToLocalStorage() { // Renamed for clarity
    try {
        localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(players));
    } catch (error) {
        console.error("Erro ao salvar jogadores no localStorage:", error);
        displayMessage("Erro ao salvar jogadores localmente.", "error");
    }
}

/**
 * Carrega a lista de jogadores do localStorage.
 * @returns {Array<Object>} A lista de jogadores carregada.
 */
export function loadPlayersFromLocalStorage() { // EXPORTED: Garante que esta função é exportada
    try {
        const storedPlayers = localStorage.getItem(PLAYERS_STORAGE_KEY);
        return storedPlayers ? JSON.parse(storedPlayers) : [];
    } catch (error) {
        console.error("Erro ao carregar jogadores do localStorage:", error);
        displayMessage("Erro ao carregar jogadores locais. Tentando continuar.", "error");
        return [];
    }
}

// Initialize players from local storage immediately when the module loads
players = loadPlayersFromLocalStorage();

/**
 * Retorna a lista atual de jogadores.
 * @returns {Array<Object>} A lista de jogadores.
 */
export function getPlayers() {
    return players;
}

/**
 * Adiciona um novo jogador à lista e tenta sincronizar com o Firestore.
 * @param {string} playerName - O nome do jogador.
 * @param {string|null} userId - O ID do usuário autenticado (ou null para anônimo/offline).
 * @param {string} appId - O ID do aplicativo.
 */
export async function addPlayer(playerName, userId, appId) {
    if (!playerName) {
        displayMessage("O nome do jogador não pode ser vazio.", "info");
        return;
    }

    const trimmedName = playerName.trim(); // TRIMS THE INPUT
    // Check for duplicate names (case-insensitive)
    const normalizedPlayerName = trimmedName.toLowerCase(); // Use trimmedName
    const existingPlayer = players.find(p => p.name.toLowerCase() === normalizedPlayerName);
    if (existingPlayer) {
        displayMessage(`Jogador '${trimmedName}' já existe.`, "info"); // Use trimmedName
        return;
    }

    // NEW: Adiciona o jogador imediatamente à lista local para feedback rápido,
    // mas sem um firestoreId ainda, pois a gravação no Firestore pode falhar por permissão.
    const newPlayer = {
        id: generateLocalId(), // Local unique ID
        name: trimmedName, // Use trimmedName
        firestoreId: null // Will be populated if successfully synced to Firestore
    };

    players.push(newPlayer);
    players.sort((a, b) => a.name.localeCompare(b.name));
    savePlayersToLocalStorage(); // Salva a lista local (temporariamente sem firestoreId)
    renderPlayersList(players); // Atualiza a UI imediatamente
    displayMessage(`Jogador '${trimmedName}' adicionado localmente!`, "success");

    if (userId && appId && currentDbInstance) {
        try {
            // ALTERADO: Grava na coleção PUBLICA de jogadores
            const playerCollectionRef = collection(currentDbInstance, PUBLIC_PLAYERS_COLLECTION_PATH.replace('{appId}', appId));
            const docRef = await addDoc(playerCollectionRef, { name: trimmedName }); // Use trimmedName here
            
            // Se a gravação for bem-sucedida, atualiza o firestoreId do jogador local
            const playerIndex = players.findIndex(p => p.id === newPlayer.id);
            if (playerIndex > -1) {
                players[playerIndex].firestoreId = docRef.id;
                // Altera o ID local para ser baseado no FirestoreId para evitar duplicatas futuras
                players[playerIndex].id = `firestore-${docRef.id}`;
                savePlayersToLocalStorage(); // Salva novamente com o firestoreId
            }
            displayMessage(`Jogador '${trimmedName}' sincronizado com a nuvem.`, "success");
        } catch (error) {
            console.error("Erro ao adicionar jogador ao Firestore (pode ser permissão):", error);
            // Se a gravação no Firestore falhar, o jogador permanece apenas local (sem firestoreId)
            displayMessage(`Erro ao sincronizar jogador '${trimmedName}' para a nuvem. (Permissão?)`, "error");
            // Remove o jogador da lista local se não for possível adicioná-lo ao Firestore
            // e o usuário não tiver permissão para adicionar.
            players = players.filter(p => p.id !== newPlayer.id);
            savePlayersToLocalStorage();
            renderPlayersList(players);
        }
    } else {
        displayMessage("Para adicionar jogadores à lista global, faça login com uma conta de administrador.", "info");
    }
}

/**
 * Remove um jogador da lista e tenta sincronizar com o Firestore.
 * @param {string} playerId - O ID local do jogador a ser removido.
 * @param {string|null} userId - O ID do usuário autenticado (ou null para anônimo/offline).
 * @param {string} appId - O ID do aplicativo.
 */
export async function removePlayer(playerId, userId, appId) {
    const playerToRemoveIndex = players.findIndex(p => p.id === playerId);

    if (playerToRemoveIndex === -1) {
        displayMessage("Jogador não encontrado para remoção.", "error");
        return;
    }

    const playerToRemove = players[playerToRemoveIndex];
    
    // Remove do array local imediatamente para feedback rápido
    players.splice(playerToRemoveIndex, 1);
    savePlayersToLocalStorage();
    renderPlayersList(players);
    displayMessage(`Jogador '${playerToRemove.name}' removido localmente.`, "info");

    // Tenta remover do Firestore se o jogador tinha um firestoreId
    if (userId && appId && currentDbInstance && playerToRemove.firestoreId) {
        try {
            // ALTERADO: Remove da coleção PUBLICA de jogadores
            const docRef = doc(currentDbInstance, PUBLIC_PLAYERS_COLLECTION_PATH.replace('{appId}', appId), playerToRemove.firestoreId);
            await deleteDoc(docRef);
            displayMessage(`Jogador '${playerToRemove.name}' removido da nuvem.`, "success");
        } catch (error) {
            console.error("Erro ao remover jogador do Firestore (pode ser permissão):", error);
            displayMessage(`Erro ao sincronizar remoção de '${playerToRemove.name}' para a nuvem. (Permissão?)`, "error");
            // Se a remoção do Firestore falhar, o jogador pode reaparecer no próximo snapshot.
            // A UI local já foi atualizada.
        }
    } else {
        displayMessage("Para remover jogadores da lista global, faça login com uma conta de administrador.", "info");
    }
}

/**
 * Sincroniza jogadores locais que não estão no Firestore, subindo-os.
 * Chamado internamente pelo listener quando a carga inicial do Firestore é concluída.
 * @param {Array<Object>} firestorePlayers - Lista de jogadores atualmente no Firestore.
 * @param {string} userId - O ID do usuário autenticado.
 * @param {string} appId - O ID do aplicativo.
 */
async function uploadLocalPlayersToFirestore(firestorePlayers, userId, appId) {
    if (!currentDbInstance) {
        console.error("uploadLocalPlayersToFirestore: Instância do Firestore não está disponível.");
        return;
    }
    // ALTERADO: Coleção PUBLICA de jogadores
    const playerCollectionRef = collection(currentDbInstance, PUBLIC_PLAYERS_COLLECTION_PATH.replace('{appId}', appId));
    const firestorePlayerNames = new Set(firestorePlayers.map(p => p.name.toLowerCase()));

    for (const player of players) { // Iterate over the global 'players' array
        if (!player.firestoreId && player.id.startsWith('local-')) { // Is it a local-only player?
            // Only upload if a player with the exact name (case-insensitive) does not exist in Firestore yet
            if (!firestorePlayerNames.has(player.name.toLowerCase())) {
                try {
                    const docRef = await addDoc(playerCollectionRef, { name: player.name });
                    player.firestoreId = docRef.id; // Update local player with Firestore ID
                    player.id = `firestore-${docRef.id}`; // Update local ID format
                    savePlayersToLocalStorage(); // Save updated players with new Firestore ID
                    console.log(`[uploadLocalPlayersToFirestore] Jogador '${player.name}' subido para o Firestore com ID: ${docRef.id}`);
                } catch (error) {
                    console.error(`[uploadLocalPlayersToFirestore] Erro ao subir jogador '${player.name}' para Firestore:`, error);
                    // Não exibe displayMessage aqui para evitar spam em caso de muitos erros de permissão.
                }
            } else {
                // Se um jogador com o mesmo nome já existe no Firestore,
                // atualiza o jogador local para linkar com esse ID do Firestore.
                const existingFirestorePlayer = firestorePlayers.find(fp => fp.name.toLowerCase() === player.name.toLowerCase());
                if (existingFirestorePlayer) {
                    player.firestoreId = existingFirestorePlayer.firestoreId;
                    player.id = `firestore-${existingFirestorePlayer.firestoreId}`; // Update local ID format
                    savePlayersToLocalStorage();
                }
            }
        }
    }
}


/**
 * Configura o listener do Firestore para jogadores e sincroniza dados.
 * @param {object|null} dbInstance - A instância do Firestore do Firebase (pode ser null para desinscrever).
 * @param {string} appIdentifier - O ID do aplicativo.
 */
export function setupFirestorePlayersListener(dbInstance, appIdentifier) { // UPDATED: Accepts dbInstance
    currentDbInstance = dbInstance; // Store the db instance

    if (!appIdentifier || !dbInstance) {
        if (firestoreUnsubscribe) {
            firestoreUnsubscribe();
            firestoreUnsubscribe = null;
        }
        // Se não houver appId ou dbInstance (por exemplo, deslogado ou falha na inicialização), limpa jogadores na memória e localStorage
        players = [];
        savePlayersToLocalStorage();
        renderPlayersList(players);
        hasInitialFirestoreLoadAttempted = false; // Reset flag
        console.log("[setupFirestorePlayersListener] Listener desinscrito ou não configurado devido à falta de appId/dbInstance."); // LOG DE DEPURACAO
        return;
    }

    currentAppId = appIdentifier;
    const user = getCurrentUser(); // Obtém o utilizador atual (pode ser anónimo ou Google)

    if (!user) { // Apenas verifica se o utilizador existe, não o UID ainda.
        console.warn("[setupFirestorePlayersListener] Usuário não autenticado. Não é possível configurar o listener do Firestore. Exibindo dados locais.");
        renderPlayersList(players);
        hasInitialFirestoreLoadAttempted = true;
        return;
    }

    // ALTERADO: Coleção PUBLICA de jogadores (não depende do UID para leitura)
    const playerCollectionRef = collection(currentDbInstance, PUBLIC_PLAYERS_COLLECTION_PATH.replace('{appId}', appIdentifier));

    // Desinscreve o listener anterior, se existir
    if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
    }

    firestoreUnsubscribe = onSnapshot(playerCollectionRef, async (snapshot) => {
        console.log("[setupFirestorePlayersListener] Snapshot recebido:", snapshot.docs.length, "documentos."); // LOG DE DEPURACAO
        const firestorePlayers = [];
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            firestorePlayers.push({
                id: `firestore-${doc.id}`, // Usa um prefixo distinto para jogadores originados do Firestore
                name: data.name,
                firestoreId: doc.id // Armazena o ID do documento do Firestore
            });
        });

        console.log("[setupFirestorePlayersListener] Jogadores do Firestore:", firestorePlayers); // LOG DE DEPURACAO

        // 1. Começa com os jogadores locais atuais como base
        let currentPlayersInState = loadPlayersFromLocalStorage(); 
        console.log("[setupFirestorePlayersListener] Jogadores locais (antes da fusão):", currentPlayersInState); // LOG DE DEPURACAO
        let mergedPlayers = [];

        const firestoreIdMap = new Map(firestorePlayers.map(p => [p.firestoreId, p]));
        const localIdMap = new Map();
        currentPlayersInState.forEach(lp => localIdMap.set(lp.id, lp));

        // Adiciona/Atualiza jogadores do Firestore na lista mesclada
        firestorePlayers.forEach(fp => {
            const existingLocal = currentPlayersInState.find(lp => lp.firestoreId === fp.firestoreId);
            if (existingLocal) {
                // Jogador existe no Firestore e localmente, prefere dados do Firestore para o nome, mas mantém ID local (se for local-id)
                mergedPlayers.push({ ...existingLocal, name: fp.name, firestoreId: fp.firestoreId });
            } else {
                // Jogador existe no Firestore, mas não localmente (ou a cópia local foi excluída)
                mergedPlayers.push(fp);
            }
        });

        // Adiciona jogadores apenas locais que não estão no Firestore
        currentPlayersInState.forEach(lp => {
            if (!lp.firestoreId || !firestoreIdMap.has(lp.firestoreId)) {
                // Este jogador é apenas local (sem firestoreId) ou foi excluído do Firestore
                // Verifica se um jogador com o mesmo nome já existe no Firestore; se sim, o vincula
                const firestorePlayerByName = firestorePlayers.find(fp => fp.name.toLowerCase() === lp.name.toLowerCase());
                if (firestorePlayerByName) {
                    // É um jogador local cujo nome corresponde a um jogador do Firestore. Adota o ID do Firestore.
                    if (!mergedPlayers.some(p => p.firestoreId === firestorePlayerByName.firestoreId)) {
                        mergedPlayers.push({
                            ...lp,
                            id: `firestore-${firestorePlayerByName.firestoreId}`,
                            firestoreId: firestorePlayerByName.firestoreId,
                            name: firestorePlayerByName.name // Usa o nome do Firestore também
                        });
                    }
                } else if (!mergedPlayers.some(p => p.id === lp.id)) {
                    // Verdadeiramente um jogador apenas local não encontrado no Firestore por ID ou nome
                    mergedPlayers.push(lp);
                }
            }
        });

        // Garante que não haja duplicatas reais por ID (local ou firestoreId)
        const finalPlayersMap = new Map();
        mergedPlayers.forEach(p => {
            const key = p.firestoreId || p.id; // Prefere firestoreId como chave se disponível
            finalPlayersMap.set(key, p);
        });
        players = Array.from(finalPlayersMap.values()); // Atualiza o array 'players' global


        console.log("[setupFirestorePlayersListener] Jogadores mesclados (final):", players); // LOG DE DEPURACAO


        // Sincronização inicial: Envia jogadores locais para o Firestore se estiver online, Firestore vazio e houver jogadores locais
        // Isso só deve acontecer UMA VEZ após a conexão ser restabelecida se o Firestore estiver vazio.
        // A condição `user && user.uid` foi removida, pois a leitura é pública, mas a escrita ainda exige autenticação.
        if (!hasInitialFirestoreLoadAttempted && navigator.onLine && firestorePlayers.length === 0 && players.length > 0) {
            console.log("[setupFirestorePlayersListener] Primeira carga online do Firestore vazia, mas jogadores locais presentes. Iniciando upload.");
            // O upload Local Players verifica as permissões dentro dela.
            await uploadLocalPlayersToFirestore(firestorePlayers, user?.uid, appIdentifier); // Passa user.uid para verificar permissões de escrita
        }
        
        // Após todo o processamento, garante que o array de jogadores esteja ordenado e salvo
        players.sort((a, b) => a.name.localeCompare(b.name));
        savePlayersToLocalStorage(); // Salva a lista final (seja do Firestore ou local) no localStorage
        renderPlayersList(players); // Atualiza a UI
        console.log("[setupFirestorePlayersListener] Renderização da lista de jogadores concluída.");

        hasInitialFirestoreLoadAttempted = true; // Marca que a carga inicial do Firestore foi processada
    }, (error) => {
        console.error("[setupFirestorePlayersListener] Erro ao ouvir jogadores do Firestore:", error);
        displayMessage("Erro ao carregar jogadores do Firestore. Verifique sua conexão.", "error");
        // Em caso de erro, não sobrescreva os dados locais. Mantenha o que já foi carregado do localStorage.
        hasInitialFirestoreLoadAttempted = true; // Marca como completa para não tentar upload repetidamente em erros
    });
}
