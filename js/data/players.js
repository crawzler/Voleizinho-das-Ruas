// js/data/players.js
// Gerencia a lista de jogadores, incluindo armazenamento local e sincronização com Firestore.

// Removido 'auth' e 'getFirestoreDb' de config.js, pois as instâncias são passadas como parâmetros.
import { collection, onSnapshot, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { renderPlayersList } from '../ui/players-ui.js';
import { getFirestoreDb } from '../firebase/config.js';

const PUBLIC_PLAYERS_COLLECTION_PATH = 'artifacts/{appId}/public/data/players'; // NOVO: Caminho para a coleção pública

// Global array to store players. Always initialized from localStorage.
let players = []; 
let currentAppId = null;
let firestoreUnsubscribe = null;
let hasInitialFirestoreLoadAttempted = false; // Renamed for clarity: tracks if initial Firebase load was *attempted*
let currentDbInstance = null; // To hold the db instance passed from setupFirestorePlayersListener

// Initialize players from local storage immediately when the module loads
players = [];

/**
 * Retorna a lista atual de jogadores.
 * @returns {Array<Object>} A lista de jogadores.
 */
export function getPlayers() {
    return players;
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
        renderPlayersList(players);
        hasInitialFirestoreLoadAttempted = false;
        return;
    }

    currentAppId = appIdentifier;

    if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
    }

    // CORREÇÃO: Passe cada parte do caminho como argumento separado
    const collectionPath = `artifacts/${appIdentifier}/public/data/players`;
    firestoreUnsubscribe = onSnapshot(
        collection(dbInstance, ...collectionPath.split('/')),
        async (snapshot) => {
            // NOVO: Atualiza o array players e salva no localStorage se online
            players = [];
            snapshot.forEach(doc => {
                players.push({ ...doc.data(), id: doc.id });
            });
            if (navigator.onLine) {
                try {
                    localStorage.setItem('volleyballPlayers', JSON.stringify(players));
                } catch (e) {
                    console.error("Erro ao salvar jogadores no localStorage:", e);
                }
            }
            renderPlayersList(players);
            hasInitialFirestoreLoadAttempted = true;
        },
        (error) => {
            hasInitialFirestoreLoadAttempted = true;
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
    const playerDocRef = doc(dbInstance, `artifacts/${appId}/public/data/players`, playerId);
    await setDoc(playerDocRef, {
        uid: playerId,
        name: name.trim(),
        createdAt: new Date().toISOString(),
        isManual: true
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
export async function addPlayer(dbInstance, appId, name, uid = null, forceManual = true) { // MUDANÇA AQUI: forceManual = true por padrão
    if (!dbInstance) {
        dbInstance = getFirestoreDb();
    }
    if (!name || name.trim().length < 2) {
        throw new Error("Nome inválido");
    }

    // Gera sempre um novo ID para cadastro manual
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 100000);
    const manualId = `manual_${timestamp}_${random}`;
    
    const playerDocRef = doc(dbInstance, `artifacts/${appId}/public/data/players`, manualId);
    await setDoc(playerDocRef, {
        uid: manualId,
        name: name.trim(),
        createdAt: new Date().toISOString(),
        isManual: true // Sempre true para cadastros pelo botão adicionar
    });
}
