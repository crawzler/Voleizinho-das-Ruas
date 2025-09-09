// js/firebase/auth.js
// Contém a lógica de autenticação do Firebase (login, logout, observador de estado).

import { onAuthStateChanged, signInAnonymously, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { setupFirestorePlayersListener } from '../data/players.js';
import { showPage, updatePlayerModificationAbility } from '../ui/pages.js';
import * as Elements from '../ui/elements.js';
import { displayMessage } from '../ui/messages.js';
import { updateConnectionIndicator, hideLoadingOverlay, markAuthInitialized } from '../main.js'; // Importa hideLoadingOverlay
import { setupSchedulingPage, cleanupSchedulingListener, updateSchedulingPermissions } from '../ui/scheduling-ui.js';
import { updateRolesVisibility } from '../ui/roles-ui.js';
import { deleteDoc, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAppId } from './config.js';
import { initWelcomeNotifications } from '../notifications/welcome-notifications.js';

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
    } catch (error) {
        displayMessage("Error during anonymous login. Please try again.", "error");
    }
}

export async function logout() {
    if (!currentAuthInstance) {
        displayMessage("Logout error: Authentication not initialized.", "error");
        return;
    }
    if (!navigator.onLine) {
        displayMessage("You are offline. Cannot log out now.", "info");
        return;
    }

    try {
        await signOut(currentAuthInstance);
        displayMessage("You have been disconnected.", "info");
    }
    catch (error) {
        displayMessage("Error logging out. Please try again.", "error");
    }
}

/**
 * UPDATED: Updates the text, icon, and options in the profile menu based on user login state
 */
export async function updateProfileMenuLoginState() {
    const currentUser = getCurrentUser();
    const userDisplayNameElement = document.getElementById('user-display-name');
    const userProfilePictureElement = document.getElementById('user-profile-picture');

    if (userDisplayNameElement) {
        if (currentUser && currentUser.isAnonymous) {
            userDisplayNameElement.textContent = "Anônimo";
        } else if (currentUser) {
            // Busca dados personalizados se usuário logado
            try {
                const appId = localStorage.getItem('appId');
                if (currentDbInstance && appId) {
                    const playerData = await getPlayerDataFromFirestore(currentDbInstance, appId, currentUser.uid);
                    userDisplayNameElement.textContent = playerData?.name || currentUser.displayName || currentUser.email || "Google User";
                    if (userProfilePictureElement) {
                        userProfilePictureElement.src = playerData?.photoURL || currentUser.photoURL || "https://placehold.co/40x40/222/FFF?text=?";
                    }
                } else {
                    userDisplayNameElement.textContent = currentUser.displayName || currentUser.email || "Google User";
                    if (userProfilePictureElement) {
                        userProfilePictureElement.src = currentUser.photoURL || "https://placehold.co/40x40/222/FFF?text=?";
                    }
                }
            } catch (error) {
                userDisplayNameElement.textContent = currentUser.displayName || currentUser.email || "Google User";
                if (userProfilePictureElement) {
                    userProfilePictureElement.src = currentUser.photoURL || "https://placehold.co/40x40/222/FFF?text=?";
                }
            }
        } else {
            userDisplayNameElement.textContent = "Visitante";
            if (userProfilePictureElement) {
                userProfilePictureElement.src = "https://placehold.co/40x40/222/FFF?text=?";
            }
        }
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
    
    // Salva o appId no localStorage para uso posterior
    if (appId) {
        localStorage.setItem('appId', appId);
    }

    onAuthStateChanged(currentAuthInstance, async (user) => {

        try { markAuthInitialized(); } catch (_) {}
        setCurrentUser(user); // Update the currentUser
        updateProfileMenuLoginState();
        updateConnectionIndicator(navigator.onLine ? 'online' : 'offline');
        hideLoadingOverlay();
        
        // Dispara evento de mudança de usuário
        window.dispatchEvent(new CustomEvent('user-changed', { detail: { user } }));
        
        // Controla visibilidade do menu de gerenciamento
        updateManagementMenuVisibility(user);
        
        // Controla visibilidade da aba de gerenciamento (roles)
        updateRolesTabVisibility(user);

        if (user) {
            if (Elements.userIdDisplay()) Elements.userIdDisplay().textContent = `ID: ${user.uid}`;
            
            if (user.isAnonymous) {
                if (Elements.userProfilePicture()) Elements.userProfilePicture().src = "https://placehold.co/40x40/222/FFF?text=?";
                if (Elements.userDisplayName()) Elements.userDisplayName().textContent = "Anônimo";
            } else {
                // Busca dados personalizados do Firestore
                getPlayerDataFromFirestore(currentDbInstance, appId, user.uid).then(playerData => {
                    if (Elements.userDisplayName()) {
                        Elements.userDisplayName().textContent = playerData?.name || user.displayName || user.email || "Visitante";
                    }
                    if (Elements.userProfilePicture()) {
                        Elements.userProfilePicture().src = playerData?.photoURL || user.photoURL || "https://placehold.co/40x40/222/FFF?text=?";
                    }
                }).catch(() => {
                    // Fallback para dados do Google se não encontrar no Firestore
                    if (Elements.userDisplayName()) Elements.userDisplayName().textContent = user.displayName || user.email || "Visitante";
                    if (Elements.userProfilePicture()) Elements.userProfilePicture().src = user.photoURL || "https://placehold.co/40x40/222/FFF?text=?";
                });
            }

            setupFirestorePlayersListener(currentDbInstance, appId);
            setupSchedulingPage(); // Adicione esta linha para garantir que o listener de agendamentos seja refeito ao logar
            updateSchedulingPermissions(); // Atualiza permissões de agendamento
            updatePlayerModificationAbility(true);
            updateRolesVisibility(); // Atualiza visibilidade da tela de roles
            
            if (sessionStorage.getItem('fromNotification') === 'true' || sessionStorage.getItem('justNavigatedToScheduling') === 'true') {
                if (sessionStorage.getItem('fromNotification') === 'true') {
                    showPage('scheduling-page');
                    sessionStorage.setItem('justNavigatedToScheduling', 'true');
                    let attempts = 0;
                    const maxAttempts = 20;
                    const interval = 100;
                    const checkAndRemoveFlag = () => {
                        const activePage = document.querySelector('.app-page--active');
                        const activeId = activePage ? activePage.id : null;
                        if (activeId === 'scheduling-page') {
                            sessionStorage.removeItem('fromNotification');
                            setTimeout(() => sessionStorage.removeItem('justNavigatedToScheduling'), 500);
                            sessionStorage.setItem('schedulingPageLock', 'true');
                            return;
                        }
                        attempts++;
                        if (attempts < maxAttempts) {
                            setTimeout(checkAndRemoveFlag, interval);
                        }
                    };
                    checkAndRemoveFlag();
                    return;
                } else if (sessionStorage.getItem('justNavigatedToScheduling') === 'true') {
                    // Evita navegação redundante após scheduling-page
                    return;
                }
            } else if (sessionStorage.getItem('schedulingPageLock') === 'true') {
                // Bloqueia qualquer navegação extra após scheduling-page
                setTimeout(() => sessionStorage.removeItem('schedulingPageLock'), 1000);
                return;
            } else {

                // Se houver hash na URL e corresponder a uma página válida, navega para ela
                if (window.location.hash && window.location.hash.startsWith('#') && window.location.hash.length > 1) {
                    const pageId = window.location.hash.substring(1);
                    if (document.getElementById(pageId) && pageId.endsWith('-page')) {
                        showPage(pageId);
                    } else {
                        showPage('start-page');
                    }
                } else {
                    showPage('start-page');
                }
            }
            // Após login: inicia o modal de boas-vindas de notificações (se aplicável)
            try {
                initWelcomeNotifications();
            } catch (_) { /* ignore */ }
            
            if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = false;
            if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = false;

            
        } else {
            if (Elements.userIdDisplay()) Elements.userIdDisplay().textContent = 'ID: Not logged in';
            if (Elements.userProfilePicture()) Elements.userProfilePicture().src = "https://placehold.co/40x40/222/FFF?text=?";
            if (Elements.userDisplayName()) Elements.userDisplayName().textContent = "Visitor";
            updatePlayerModificationAbility(false);
            setupFirestorePlayersListener(null, appId);
            cleanupSchedulingListener(); // NOVO: Remove o listener ao deslogar
            updateSchedulingPermissions(); // Atualiza permissões de agendamento
            // REMOVIDO: setupSchedulingPage(); // NÃO reative o listener após limpar!

            if (!navigator.onLine) {
                showPage('start-page'); // Direciona para a start-page para permitir acesso aos dados locais
                displayMessage("Sua sessão expirou devido à falta de conexão, mas você pode continuar usando dados locais. Reconecte para logar novamente.", "info");
                
                if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = true;
                if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = true;
            } else {
                showPage('login-page');
                if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = false;
                if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = false;
            }
        }
    });
}

export async function loginWithGoogle() {
    if (!currentAuthInstance) {
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
                await createPlayerInFirestore(dbInstance, appId, user.uid, playerName, user.photoURL);
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

        // displayMessage(`Welcome, ${displayName}!`, "success"); // Mensagem já tratada acima
    } catch (error) {
        displayMessage("Error during Google login. Please try again.", "error");
    }
}

/**
 * Resets a user by deleting their data from Firestore and logging them out
 */
export async function resetUser() {
    if (!currentAuthInstance || !currentDbInstance) {
        displayMessage("Erro: Firebase não inicializado.", "error");
        throw new Error("Firebase não inicializado.");
    }

    const user = getCurrentUser();
    if (!user) {
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
            } catch (deleteError) {
                if (deleteError.code === "permission-denied") {
                    throw new Error("permission-denied");
                }
                throw deleteError;
            }
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
                // Silencioso
            }
        });

        // Faz logout do usuário
        try {
            await signOut(currentAuthInstance);
            displayMessage("Dados do usuário resetados com sucesso. Por favor, faça login novamente.", "success");
            showPage('login-page');
        } catch (signOutError) {
            throw signOutError;
        }
        
    } catch (error) {
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
 * Busca os dados completos do jogador pelo UID no Firestore.
 * @param {object} dbInstance
 * @param {string} appId
 * @param {string} uid
 * @returns {Promise<object|null>} dados do jogador ou null se não existir
 */
async function getPlayerDataFromFirestore(dbInstance, appId, uid) {
    const playerDocRef = doc(dbInstance, `artifacts/${appId}/public/data/players`, uid);
    const playerDoc = await getDoc(playerDocRef);
    if (playerDoc.exists()) {
        return playerDoc.data();
    }
    return null;
}

/**
 * Cria o jogador no Firestore com o nome fornecido.
 * @param {object} dbInstance
 * @param {string} appId
 * @param {string} uid
 * @param {string} name
 * @param {string} photoURL
 */
async function createPlayerInFirestore(dbInstance, appId, uid, name, photoURL = null) {
    const playerDocRef = doc(dbInstance, `artifacts/${appId}/public/data/players`, uid);
    await setDoc(playerDocRef, {
        uid,
        name,
        photoURL,
        isManual: false,
        createdAt: new Date().toISOString()
    }, { merge: true });
}

/**
 * Controla a visibilidade do menu de gerenciamento baseado nas permissões do usuário
 * @param {Object} user - Usuário atual
 */
async function updateManagementMenuVisibility(user) {
    const managementMenu = document.getElementById('nav-users');
    if (!managementMenu) return;
    
    // Menu de usuários agora aparece para todos os usuários autenticados
    const shouldShow = user && !user.isAnonymous;
    managementMenu.style.display = shouldShow ? 'flex' : 'none';
}

/**
 * Controla a visibilidade da aba de gerenciamento (roles) baseado no role do usuário
 * @param {Object} user - Usuário atual
 */
function updateRolesTabVisibility(user) {
    const rolesTab = document.getElementById('nav-roles');
    if (!rolesTab) return;
    
    // Só mostra para usuários autenticados (não anônimos) e que sejam devs
    // Em desenvolvimento, sempre mostra para usuários autenticados
    const shouldShow = user && !user.isAnonymous;
    rolesTab.style.display = shouldShow ? 'flex' : 'none';
    
    // Força atualização no DOM
    if (shouldShow) {
        rolesTab.classList.add('visible');
    } else {
        rolesTab.classList.remove('visible');
    }
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