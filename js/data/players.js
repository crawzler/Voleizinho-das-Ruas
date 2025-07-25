// js/data/players.js
// Gerencia a lista de jogadores, incluindo armazenamento local e sincronização com Firestore.

// Removido 'auth' e 'getFirestoreDb' de config.js, pois as instâncias são passadas como parâmetros.
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { renderPlayersList } from '../ui/players-ui.js';
import { getFirestoreDb } from '../firebase/config.js';
import { getCurrentUser } from '../firebase/auth.js'; // Adicionando import para getCurrentUser

const PUBLIC_PLAYERS_COLLECTION_PATH = 'artifacts/{appId}/public/data/players'; // NOVO: Caminho para a coleção pública

// Global array to store players. Always initialized from localStorage.
let players = [];
let currentAppId = null;
let firestoreUnsubscribe = null;
let hasInitialFirestoreLoadAttempted = false; // Renamed for clarity: tracks if initial Firebase load was *attempted*
let currentDbInstance = null; // To hold the db instance passed from setupFirestorePlayersListener

// Função utilitária para carregar jogadores do localStorage e marcar como [local]
function getLocalPlayersWithTag() {
    let localPlayers = [];
    try {
        const stored = localStorage.getItem('volleyballPlayers');
        if (stored) {
            localPlayers = JSON.parse(stored);
            localPlayers = localPlayers.map(p => {
                if (!p.id || (!p.isManual && !(p.uid && p.uid.startsWith('manual_')))) {
                    return { ...p, name: p.name.includes('[local]') ? p.name : `${p.name} [local]` };
                }
                return p;
            });
        }
    } catch (e) {
        console.warn('Erro ao ler jogadores locais:', e);
    }
    return localPlayers;
}

// Inicialização segura dos players - com try/catch para evitar erros
try {
    // Inicializa players: se offline, carrega do localStorage; se online, espera Firestore
    if (!navigator.onLine) {
        players = getLocalPlayersWithTag();
        // Envolve a renderização em setTimeout para garantir que ocorra após a inicialização do auth.js
        setTimeout(() => {
            try {
                renderPlayersList(players); // Garante renderização offline
        } catch (e) {
                console.warn('Erro ao renderizar lista de jogadores durante inicialização:', e);
        }
        }, 0);
    }
    } catch (e) {
    console.warn('Erro durante inicialização de players:', e);
}
/**
 * Retorna a lista atual de jogadores.
 * @returns {Array<Object>} A lista de jogadores.
 */
export function getPlayers() {
    // Se não houver players na memória, tenta carregar do localStorage
    if (players.length === 0 && !navigator.onLine) {
        players = getLocalPlayersWithTag();
    }
    return players;
    }

/**
 * Configura o listener do Firestore para jogadores e sincroniza dados.
 * @param {object|null} dbInstance - A instância do Firestore do Firebase (pode ser null para desinscrever).
 * @param {string} appIdentifier - O ID do aplicativo.
 */
export function setupFirestorePlayersListener(dbInstance, appIdentifier) {
    currentDbInstance = dbInstance;

    // Se não temos conexão com Firestore ou estamos offline, usamos dados locais
    if (!navigator.onLine || !dbInstance || !appIdentifier) {
        if (firestoreUnsubscribe) {
            firestoreUnsubscribe();
            firestoreUnsubscribe = null;
    }
        // Carrega jogadores do localStorage
        const localPlayers = getLocalPlayersWithTag();
        if (localPlayers.length > 0) {
            players = localPlayers;
        renderPlayersList(players);
    }
        hasInitialFirestoreLoadAttempted = false;
        return;
}

    // Se estamos online, configura o listener do Firestore
    if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
    }

    const collectionPath = `artifacts/${appIdentifier}/public/data/players`;
    firestoreUnsubscribe = onSnapshot(
        collection(dbInstance, ...collectionPath.split('/')),
        async (snapshot) => {
            const firestorePlayers = [];
            snapshot.forEach(doc => {
                firestorePlayers.push({ ...doc.data(), id: doc.id });
            });

            // Mescla jogadores do Firestore com jogadores locais
            const localPlayers = getLocalPlayersWithTag();
            const localOnlyPlayers = localPlayers.filter(player =>
                player.isLocal && !firestorePlayers.some(fp => fp.id === player.id)
            );

            players = [...firestorePlayers, ...localOnlyPlayers];

            // Sempre salva a lista completa no localStorage
            try {
                localStorage.setItem('volleyballPlayers', JSON.stringify(players));
            } catch (e) {
                console.error("Erro ao salvar jogadores no localStorage:", e);
            }

            renderPlayersList(players);
            hasInitialFirestoreLoadAttempted = true;
        },
        (error) => {
            console.error("Erro ao observar coleção de jogadores:", error);
            const localPlayers = getLocalPlayersWithTag();
            if (localPlayers.length > 0) {
                players = localPlayers;
                renderPlayersList(players);
            }
        }
    );
}

/**
 * Função para renderizar a tela de jogadores
 */
export function initializePlayersScreen() {
    renderPlayersList([]); // Renderiza uma lista vazia
}

/**
 * Função para criar um novo jogador.
 * @param {Object} user - O objeto do usuário autenticado.
 */
export function createPlayer(user) {
    const playerData = {
        uid: user.uid,
        name: user.displayName || user.email || "Sem Nome",
        // ...outros campos...
    };

    // Lógica para adicionar o jogador ao Firestore e atualizar a lista localmente
}

/**
 * Cadastra um novo jogador manualmente (apenas nome) no Firestore.
 * Só deve ser chamado por um admin autenticado.
 * @param {object} dbInstance - Instância do Firestore.
 * @param {string} appId - ID do app.
 * @param {string} name - Nome do jogador.
 * @returns {Promise<void>}
 */
export async function adminAddPlayer(dbInstance, appId, name) {
    if (!name || name.trim().length < 2) {
        throw new Error("Nome inválido");
    }
    // Gera um ID único para o jogador manual
    const playerId = `manual_${Date.now()}`;
    // Obtenha o usuário atual para registrar quem criou o jogador
    let createdBy = null;
    try {
        const currentUser = getCurrentUser();
        if (currentUser) {
            createdBy = currentUser.uid;
        }
        } catch (e) {
        console.warn('Erro ao obter usuário atual para criação de jogador:', e);
        }

        const playerDocRef = doc(dbInstance, `artifacts/${appId}/public/data/players`, playerId);
    await setDoc(playerDocRef, {
        uid: playerId,
        name: name.trim(),
        createdAt: new Date().toISOString(),
        isManual: true,
        createdBy: createdBy // Registra o UID do usuário que criou o jogador
    });
}
/**
 * Adiciona um novo jogador ao Firestore.
 * @param {object} dbInstance - Instância do Firestore.
 * @param {string} appId - ID do app.
 * @param {string} name - Nome do jogador.
 * @param {string} [uid] - UID do jogador (opcional, APENAS para registro via Google).
 * @returns {Promise<void>}
 */
export async function addPlayer(dbInstance, appId, name, uid = null, forceManual = true) {
    if (!name || name.trim().length < 2) {
        throw new Error("Nome inválido");
    }

    // Gera ID único para o jogador
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 100000);
    const playerId = `manual_${timestamp}_${random}`;

    // Se estiver offline ou sem dbInstance, adiciona tag [local]
    const playerName = (!navigator.onLine || !dbInstance) ? `${name.trim()} [local]` : name.trim();

    // Obtenha o usuário atual para registrar quem criou o jogador
    let createdBy = null;
    try {
        const currentUser = getCurrentUser();
        if (currentUser) {
            createdBy = currentUser.uid;
        }
    } catch (e) {
        console.warn('Erro ao obter usuário atual para criação de jogador:', e);
    }

    const playerData = {
        uid: playerId,
        name: playerName,
        createdAt: new Date().toISOString(),
        isManual: true,
        id: playerId,
        isLocal: (!navigator.onLine || !dbInstance),
        createdBy: createdBy // Registra o UID do usuário que criou o jogador
    };

    // Se estiver offline, salva apenas no localStorage
    if (!navigator.onLine || !dbInstance) {
    try {
        const stored = localStorage.getItem('volleyballPlayers');
        let localPlayers = stored ? JSON.parse(stored) : [];

        localPlayers.push(playerData);
        localStorage.setItem('volleyballPlayers', JSON.stringify(localPlayers));
        players = localPlayers;
        renderPlayersList(players);
            return;
    } catch (e) {
            console.error("Erro ao salvar jogador localmente:", e);
        throw e;
}
}

    // Se estiver online, tenta salvar no Firestore
    try {
        const playerDocRef = doc(dbInstance, `artifacts/${appId}/public/data/players`, playerId);
        await setDoc(playerDocRef, playerData);
    } catch (e) {
        // Se falhar o Firestore, tenta salvar localmente
        console.error("Erro ao salvar no Firestore, salvando localmente:", e);
        const stored = localStorage.getItem('volleyballPlayers');
        let localPlayers = stored ? JSON.parse(stored) : [];
        localPlayers.push(playerData);
        localStorage.setItem('volleyballPlayers', JSON.stringify(localPlayers));
        players = localPlayers;
        renderPlayersList(players);
    }
}

/**
 * Remove um jogador do Firestore e atualiza a lista local.
 * @param {string} playerId - O ID do jogador a ser removido.
 * @param {string} [requesterUid] - UID de quem está solicitando (opcional, para controle futuro).
 * @param {string} appId - O ID do aplicativo.
 * @returns {Promise<void>}
 */
export async function removePlayer(playerId, requesterUid, appId) {
    if (!currentDbInstance) {
        throw new Error('Firestore não inicializado');
    }
    if (!appId) {
        throw new Error('App ID não informado');
    }
    if (!playerId) {
        throw new Error('ID do jogador não informado');
    }
    try {
        const playerDocRef = doc(currentDbInstance, `artifacts/${appId}/public/data/players`, playerId);
        await deleteDoc(playerDocRef);
        // Remove localmente
        players = players.filter(p => p.id !== playerId);
        renderPlayersList(players);
    } catch (e) {
        console.error('Erro ao remover jogador:', e);
        throw e;
    }
}
