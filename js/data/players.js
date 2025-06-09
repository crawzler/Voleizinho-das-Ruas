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
function savePlayersToLocalStorage() {
    try {
        localStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(players));
    } catch (error) {
        // Removido: console.error("Erro ao salvar jogadores no localStorage:", error);
        // Removido: displayMessage("Erro ao salvar jogadores localmente.", "error");
    }
}

/**
 * Carrega a lista de jogadores do localStorage.
 * @returns {Array<Object>} A lista de jogadores carregada.
 */
export function loadPlayersFromLocalStorage() {
    try {
        const storedPlayers = localStorage.getItem(PLAYERS_STORAGE_KEY);
        return storedPlayers ? JSON.parse(storedPlayers) : [];
    } catch (error) {
        // Removido: console.error("Erro ao carregar jogadores do localStorage, redefinindo:", error);
        // Removido: displayMessage("Erro ao carregar jogadores locais. Tentando continuar.", "error");
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

    const trimmedName = playerName.trim();
    const normalizedPlayerName = trimmedName.toLowerCase();
    const existingPlayer = players.find(p => p.name.toLowerCase() === normalizedPlayerName);
    if (existingPlayer) {
        displayMessage(`Jogador '${trimmedName}' já existe.`, "info");
        return;
    }

    const newPlayer = {
        id: generateLocalId(),
        name: trimmedName,
        firestoreId: null
    };

    players.push(newPlayer);
    players.sort((a, b) => a.name.localeCompare(b.name));
    savePlayersToLocalStorage();
    renderPlayersList(players);
    displayMessage(`Jogador '${trimmedName}' adicionado localmente!`, "success");

    if (userId && appId && currentDbInstance) {
        try {
            const playerCollectionRef = collection(currentDbInstance, PUBLIC_PLAYERS_COLLECTION_PATH.replace('{appId}', appId));
            const docRef = await addDoc(playerCollectionRef, { name: trimmedName });
            const playerIndex = players.findIndex(p => p.id === newPlayer.id);
            if (playerIndex > -1) {
                players[playerIndex].firestoreId = docRef.id;
                players[playerIndex].id = `firestore-${docRef.id}`;
                savePlayersToLocalStorage();
            }
            displayMessage(`Jogador '${trimmedName}' sincronizado com a nuvem.`, "success");
        } catch (error) {
            // Removido: displayMessage("Erro ao sincronizar jogador com a nuvem.", "error");
            players = players.filter(p => p.id !== newPlayer.id);
            savePlayersToLocalStorage();
            renderPlayersList(players);
        }
    } else {
        // Removido: displayMessage("Jogador salvo localmente. Conecte-se para sincronizar com a nuvem.", "info");
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
        // Removido: console.warn(`Tentativa de remover jogador com ID não encontrado: ${playerId}`);
        displayMessage("Jogador não encontrado para remoção.", "error");
        return;
    }

    const playerToRemove = players[playerToRemoveIndex];
    players.splice(playerToRemoveIndex, 1);
    savePlayersToLocalStorage();
    renderPlayersList(players);
    // Removido: displayMessage("Jogador removido localmente.", "info");
    displayMessage(`Jogador '${playerToRemove.name}' removido localmente.`, "info");

    if (userId && appId && currentDbInstance && playerToRemove.firestoreId) {
        try {
            const docRef = doc(currentDbInstance, PUBLIC_PLAYERS_COLLECTION_PATH.replace('{appId}', appId), playerToRemove.firestoreId);
            await deleteDoc(docRef);
            displayMessage(`Jogador '${playerToRemove.name}' removido da nuvem.`, "success");
        } catch (error) {
            // Removido: displayMessage("Erro ao sincronizar remoção com a nuvem.", "error");
            displayMessage(`Erro ao sincronizar remoção de '${playerToRemove.name}' para a nuvem. (Permissão?)`, "error");
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
        // Removido: console.error("uploadLocalPlayersToFirestore: Instância do Firestore não está disponível.");
        return;
    }
    const playerCollectionRef = collection(currentDbInstance, PUBLIC_PLAYERS_COLLECTION_PATH.replace('{appId}', appId));
    const firestorePlayerNames = new Set(firestorePlayers.map(p => p.name.toLowerCase()));

    for (const player of players) {
        if (!player.firestoreId && player.id.startsWith('local-')) {
            if (!firestorePlayerNames.has(player.name.toLowerCase())) {
                try {
                    const docRef = await addDoc(playerCollectionRef, { name: player.name });
                    player.firestoreId = docRef.id;
                    player.id = `firestore-${docRef.id}`;
                    savePlayersToLocalStorage();
                    // Removido: displayMessage("Jogadores locais sincronizados com a nuvem!", "success");
                } catch (error) {
                    // Não exibe displayMessage aqui para evitar spam em caso de muitos erros de permissão.
                }
            } else {
                const existingFirestorePlayer = firestorePlayers.find(fp => fp.name.toLowerCase() === player.name.toLowerCase());
                if (existingFirestorePlayer) {
                    player.firestoreId = existingFirestorePlayer.firestoreId;
                    player.id = `firestore-${existingFirestorePlayer.firestoreId}`;
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
export function setupFirestorePlayersListener(dbInstance, appIdentifier) {
    currentDbInstance = dbInstance;

    if (!appIdentifier || !dbInstance) {
        if (firestoreUnsubscribe) {
            firestoreUnsubscribe();
            firestoreUnsubscribe = null;
        }
        players = [];
        savePlayersToLocalStorage();
        renderPlayersList(players);
        hasInitialFirestoreLoadAttempted = false;
        // Removido: console.log("Usuário não autenticado ou Firebase não inicializado. Não configurando listener do Firestore.");
        return;
    }

    currentAppId = appIdentifier;
    const user = getCurrentUser();

    if (!user) {
        // Removido: console.warn("[setupFirestorePlayersListener] Usuário não autenticado. Não é possível configurar o listener do Firestore. Exibindo dados locais.");
        renderPlayersList(players);
        hasInitialFirestoreLoadAttempted = true;
        return;
    }

    const playerCollectionRef = collection(currentDbInstance, PUBLIC_PLAYERS_COLLECTION_PATH.replace('{appId}', appIdentifier));

    if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
    }

    firestoreUnsubscribe = onSnapshot(playerCollectionRef, async (snapshot) => {
        const firestorePlayers = [];
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            firestorePlayers.push({
                id: `firestore-${doc.id}`,
                name: data.name,
                firestoreId: doc.id
            });
        });

        let currentPlayersInState = loadPlayersFromLocalStorage();
        let mergedPlayers = [];

        const firestoreIdMap = new Map(firestorePlayers.map(p => [p.firestoreId, p]));
        const localIdMap = new Map();
        currentPlayersInState.forEach(lp => localIdMap.set(lp.id, lp));

        firestorePlayers.forEach(fp => {
            const existingLocal = currentPlayersInState.find(lp => lp.firestoreId === fp.firestoreId);
            if (existingLocal) {
                mergedPlayers.push({ ...existingLocal, name: fp.name, firestoreId: fp.firestoreId });
            } else {
                mergedPlayers.push(fp);
            }
        });

        currentPlayersInState.forEach(lp => {
            if (!lp.firestoreId || !firestoreIdMap.has(lp.firestoreId)) {
                const firestorePlayerByName = firestorePlayers.find(fp => fp.name.toLowerCase() === lp.name.toLowerCase());
                if (firestorePlayerByName) {
                    if (!mergedPlayers.some(p => p.firestoreId === firestorePlayerByName.firestoreId)) {
                        mergedPlayers.push({
                            ...lp,
                            id: `firestore-${firestorePlayerByName.firestoreId}`,
                            firestoreId: firestorePlayerByName.firestoreId,
                            name: firestorePlayerByName.name
                        });
                    }
                } else if (!mergedPlayers.some(p => p.id === lp.id)) {
                    mergedPlayers.push(lp);
                }
            }
        });

        const finalPlayersMap = new Map();
        mergedPlayers.forEach(p => {
            const key = p.firestoreId || p.id;
            finalPlayersMap.set(key, p);
        });
        players = Array.from(finalPlayersMap.values());

        players.sort((a, b) => a.name.localeCompare(b.name));
        savePlayersToLocalStorage();
        renderPlayersList(players);

        hasInitialFirestoreLoadAttempted = true;
    }, (error) => {
        // Removido: displayMessage("Erro ao carregar jogadores do Firestore. Verifique sua conexão.", "error");
        hasInitialFirestoreLoadAttempted = true;
    });
}
