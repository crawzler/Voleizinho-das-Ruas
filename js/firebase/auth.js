// js/firebase/auth.js
// Contém a lógica de autenticação do Firebase (login, logout, observador de estado).

import { onAuthStateChanged, signInAnonymously, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { setupFirestorePlayersListener } from '../data/players.js';
import { showPage, updatePlayerModificationAbility } from '../ui/pages.js';
import * as Elements from '../ui/elements.js';
import { displayMessage } from '../ui/messages.js';
import { updateConnectionIndicator, hideLoadingOverlay } from '../main.js'; // Importa hideLoadingOverlay
import { setupSchedulingPage, cleanupSchedulingListener } from '../ui/scheduling-ui.js';
import { deleteDoc, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAppId } from './config.js';

let currentUser = null;

let currentAuthInstance = null;
let currentDbInstance = null;
let isManualAnonymousLogin = false;

export function getCurrentUser() {
    return currentUser;
}

export function setCurrentUser(user) {
    currentUser = user;
}

export async function signInAnonymouslyUser(appId) {
    if (!currentAuthInstance) {
        console.error("Authentication instance not available for anonymous login.");
        displayMessage("Login error: Authentication not initialized.", "error");
        return;
    }
    if (!navigator.onLine) {
        displayMessage("You are offline. Connect to the internet to start an anonymous session.", "error");
        return;
    }
    isManualAnonymousLogin = true;
    try {
        await signInAnonymously(currentAuthInstance);
        console.log("Anonymous login successful!");
    } catch (error) {
        console.error("Error during anonymous login:", error);
        displayMessage("Error during anonymous login. Please try again.", "error");
    }
}

export async function logout() {
    if (!currentAuthInstance) {
        console.error("Authentication instance not available for logout.");
        displayMessage("Logout error: Authentication not initialized.", "error");
        return;
    }
    if (!navigator.onLine) {
        displayMessage("You are offline. Cannot log out now.", "info");
        return;
    }

    try {
        await signOut(currentAuthInstance);
        console.log("Logout successful!");
        displayMessage("You have been disconnected.", "info");
    }
    catch (error) {
        console.error("Error during logout:", error);
        displayMessage("Error logging out. Please try again.", "error");
    }
}

/**
 * UPDATED: Updates the text, icon, and options in the profile menu based on user login state
 */
export function updateProfileMenuLoginState() {
    const currentUser = getCurrentUser();
    const userDisplayNameElement = document.getElementById('userDisplayName');
    const userProfilePictureElement = document.querySelector('.user-profile-picture');

    if (userDisplayNameElement) {
        if (currentUser && currentUser.isAnonymous) {
            userDisplayNameElement.textContent = "Anônimo";
        } else if (currentUser) {
            userDisplayNameElement.textContent = currentUser.displayName || currentUser.email || "Google User";
        } else {
            userDisplayNameElement.textContent = "Visitante";
        }
    }

    if (userProfilePictureElement) {
        userProfilePictureElement.src = currentUser?.photoURL || "https://placehold.co/40x40/222/FFF?text=?";
    }
}

// Expõe as funções para o HTML
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;

/**
 * Sets up the Firebase authentication state observer.
 * This listener is the central point for reacting to login/logout changes.
 * @param {object} authInstance - The Firebase Auth instance.
 * @param {object} dbInstance - The Firebase Firestore instance.
 * @param {string} appId - The application ID for use in Firestore synchronization.
 */
export function setupAuthListener(authInstance, dbInstance, appId) {
    currentAuthInstance = authInstance;
    currentDbInstance = dbInstance;

    onAuthStateChanged(currentAuthInstance, async (user) => {
        console.log(`[onAuthStateChanged] Usuário: ${user ? user.uid : 'NULO'}, Online: ${navigator.onLine}`);

        setCurrentUser(user); // Update the currentUser
        updateProfileMenuLoginState();
        updateConnectionIndicator(navigator.onLine ? 'online' : 'offline');
        hideLoadingOverlay();

        if (user) {
            console.log(`User logged in: ${user.uid}`);
            if (Elements.userIdDisplay()) Elements.userIdDisplay().textContent = `ID: ${user.uid}`;
            if (Elements.userProfilePicture()) Elements.userProfilePicture().src = user.photoURL || "https://placehold.co/40x40/222/FFF?text=?";
            
            // NOVO: Busca o nome do jogador no Firestore
            if (Elements.userDisplayName()) {
                if (user.isAnonymous) {
                    Elements.userDisplayName().textContent = "Usuário Anônimo";
                } else {
                    // Busca o nome do Firestore
                    try {
                        const playerName = await getPlayerNameFromFirestore(currentDbInstance, appId, user.uid);
                        Elements.userDisplayName().textContent = playerName || user.displayName || user.email || "Visitante";
                    } catch (error) {
                        console.error("Erro ao buscar nome do usuário:", error);
                        Elements.userDisplayName().textContent = user.displayName || user.email || "Visitante";
                    }
                }
            }

            console.log(`Setting up Firestore listener for user: ${user.uid}`);
            setupFirestorePlayersListener(currentDbInstance, appId);
            setupSchedulingPage(); // Adicione esta linha para garantir que o listener de agendamentos seja refeito ao logar
            updatePlayerModificationAbility(true);
            showPage('start-page');
            
            if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = false;
            if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = false;
        } else {
            console.log("No user authenticated.");
            if (Elements.userIdDisplay()) Elements.userIdDisplay().textContent = 'ID: Not logged in';
            if (Elements.userProfilePicture()) Elements.userProfilePicture().src = "https://placehold.co/40x40/222/FFF?text=?";
            if (Elements.userDisplayName()) Elements.userDisplayName().textContent = "Visitor";
            updatePlayerModificationAbility(false);
            setupFirestorePlayersListener(null, appId);
            cleanupSchedulingListener(); // NOVO: Remove o listener ao deslogar
            // REMOVIDO: setupSchedulingPage(); // NÃO reative o listener após limpar!

            if (!navigator.onLine) {
                console.log("[Auth Listener] Offline e sem usuário logado. Tentando mostrar start-page.");
                showPage('start-page'); // Direciona para a start-page para permitir acesso aos dados locais
                displayMessage("Sua sessão expirou devido à falta de conexão, mas você pode continuar usando dados locais. Reconecte para logar novamente.", "info");
                
                if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = true;
                if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = true;
            } else {
                console.log("[Auth Listener] Online e sem usuário logado. Mostrando login-page.");
                showPage('login-page');
                if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = false;
                if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = false;
            }
        }
    });
}

export async function loginWithGoogle() {
    if (!currentAuthInstance) {
        console.error("Authentication instance not available for Google login.");
        displayMessage("Login error: Authentication not initialized.", "error");
        return;
    }
    if (!navigator.onLine) {
        displayMessage("You are offline. Connect to the internet to log in with Google.", "error");
        return;
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
        prompt: 'select_account' // <-- força o popup para escolher conta
    });
    try {
        await signOut(currentAuthInstance); // Força logout antes

        const result = await signInWithPopup(currentAuthInstance, provider);
        const user = result.user;
        const dbInstance = currentDbInstance || null;
        const appId = getAppId();

        // --- NOVO: Sincronização do nome do jogador ---
        if (dbInstance && appId && user && user.uid) {
            let playerName = await getPlayerNameFromFirestore(dbInstance, appId, user.uid);
            if (!playerName) {
                try {
                    playerName = await promptForDisplayName();
                } catch (e) {
                    displayMessage("Login cancelado. Nome obrigatório.", "error");
                    await signOut(currentAuthInstance);
                    return;
                }
                await createPlayerInFirestore(dbInstance, appId, user.uid, playerName);
                displayMessage(`Bem-vindo, ${playerName}!`, "success");
            } else {
                displayMessage(`Bem-vindo de volta, ${playerName}!`, "success");
            }
            // Atualiza o displayName do usuário localmente (opcional)
            if (Elements.userDisplayName()) {
                Elements.userDisplayName().textContent = playerName;
            }
        }
        // --- FIM NOVO ---

        // Certifica que o nome correto é exibido
        const displayName = user.displayName || user.email || "Usuário Google";
        if (Elements.userDisplayName()) {
            Elements.userDisplayName().textContent = displayName;
        }
        // displayMessage(`Welcome, ${displayName}!`, "success"); // Mensagem já tratada acima
    } catch (error) {
        console.error("Error during Google login:", error);
        displayMessage("Error during Google login. Please try again.", "error");
    }
}

/**
 * Resets a user by deleting their data from Firestore and logging them out
 */
export async function resetUser() {
    if (!currentAuthInstance || !currentDbInstance) {
        console.error("Firebase instances not initialized.");
        displayMessage("Erro: Firebase não inicializado.", "error");
        throw new Error("Firebase não inicializado.");
    }

    const user = getCurrentUser();
    if (!user) {
        console.error("No user authenticated to reset.");
        displayMessage("Erro: Nenhum usuário autenticado.", "error");
        throw new Error("Nenhum usuário autenticado.");
    }

    if (!navigator.onLine) {
        displayMessage("Você precisa estar online para resetar seus dados.", "error");
        throw new Error("Offline");
    }

    try {
        // Get appId from config since we need it for the collection path
        const appId = getAppId();
        if (!appId) {
            throw new Error("App ID not found");
        }

        // Delete user data from Firestore first
        const userDocRef = doc(currentDbInstance, `artifacts/${appId}/public/data/players`, user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            try {
                await deleteDoc(userDocRef);
                console.log("Dados do usuário deletados com sucesso do Firestore.");
            } catch (deleteError) {
                console.error("Erro ao deletar dados do Firestore:", deleteError);
                if (deleteError.code === "permission-denied") {
                    throw new Error("permission-denied");
                }
                throw deleteError;
            }
        } else {
            console.log("Nenhum dado do usuário encontrado para deletar no Firestore.");
        }

        // Limpa dados do localStorage
        const keysToRemove = [
            'volleyballConfig',
            'volleyballPlayers',
            'gameHistory',
            'scheduledGames'
        ];
        
        keysToRemove.forEach(key => {
            try {
                localStorage.removeItem(key);
            } catch (e) {
                console.warn(`Erro ao remover ${key} do localStorage:`, e);
            }
        });
        console.log("Dados do localStorage limpos.");

        // Faz logout do usuário
        try {
            await signOut(currentAuthInstance);
            console.log("Usuário desconectado com sucesso.");
            displayMessage("Dados do usuário resetados com sucesso. Por favor, faça login novamente.", "success");
            showPage('login-page');
        } catch (signOutError) {
            console.error("Erro ao fazer logout:", signOutError);
            throw signOutError;
        }
        
    } catch (error) {
        console.error("Erro ao resetar usuário:", error);
        if (error.message === "permission-denied") {
            displayMessage("Permissão negada. Você pode não ter direitos para excluir seus dados.", "error");
        } else if (error.message === "App ID not found") {
            displayMessage("Erro: ID do aplicativo não encontrado.", "error");
        } else {
            displayMessage("Erro ao resetar usuário. Por favor, tente novamente.", "error");
        }
        throw error;
    }
}

/**
 * Busca o jogador pelo UID no Firestore.
 * @param {object} dbInstance
 * @param {string} appId
 * @param {string} uid
 * @returns {Promise<string|null>} nome do jogador ou null se não existir
 */
async function getPlayerNameFromFirestore(dbInstance, appId, uid) {
    const playerDocRef = doc(dbInstance, `artifacts/${appId}/public/data/players`, uid);
    const playerDoc = await getDoc(playerDocRef);
    if (playerDoc.exists()) {
        const data = playerDoc.data();
        return data.name || null;
    }
    return null;
}

/**
 * Cria o jogador no Firestore com o nome fornecido.
 * @param {object} dbInstance
 * @param {string} appId
 * @param {string} uid
 * @param {string} name
 */
async function createPlayerInFirestore(dbInstance, appId, uid, name) {
    const playerDocRef = doc(dbInstance, `artifacts/${appId}/public/data/players`, uid);
    await setDoc(playerDocRef, {
        uid,
        name,
        createdAt: new Date().toISOString()
    }, { merge: true });
}

/**
 * Solicita ao usuário um nome para exibição.
 * Pode ser substituído por um modal mais bonito se desejar.
 * @returns {Promise<string>} nome digitado
 */
async function promptForDisplayName() {
    let name = "";
    while (!name || name.trim().length < 2) {
        name = window.prompt("Digite um nome para exibição (mínimo 2 caracteres):");
        if (name === null) throw new Error("cancelled");
    }
    return name.trim();
}
