// js/firebase/auth.js
// Contém a lógica de autenticação do Firebase (login, logout, observador de estado).

import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { setupFirestorePlayersListener } from '../data/players.js';
import { getPlayers } from '../data/players.js';
import { showPage, updatePlayerModificationAbility } from '../ui/pages.js';
import * as Elements from '../ui/elements.js';
import { displayMessage } from '../ui/messages.js';
import { updateConnectionIndicator } from '../main.js'; // NOVO: Importa updateConnectionIndicator

let currentUser = null;
let currentAuthInstance = null; // Stores the Firebase Auth instancea
let currentDbInstance = null;   // Stores the Firestore DB instance
let isManualAnonymousLogin = false;

const googleLoginProvider = new GoogleAuthProvider();

export function getCurrentUser() {
    return currentUser;
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
    try {
        await signInWithPopup(currentAuthInstance, googleLoginProvider);
        console.log("Google login successful!");
    } catch (error) {
        console.error("Error during Google login:", error);
        displayMessage("Error during Google login. Please try again.", "error");
    }
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
    } catch (error) {
        console.error("Error during logout:", error);
        displayMessage("Error logging out. Please try again.", "error");
    }
}

/**
 * UPDATED: Updates the text, icon, and disabled state of the login/logout button in the profile mini-menu.
 * This function is now responsible for enabling/disabling the logout button and is declared only once.
 */
export function updateProfileMenuLoginState() {
    const profileLogoutButton = Elements.profileLogoutButton();
    const currentUser = getCurrentUser();
    const isOnline = navigator.onLine;

    if (profileLogoutButton) {
        if (currentUser) {
            profileLogoutButton.innerHTML = `<span class="material-icons">logout</span> Sair`;
            profileLogoutButton.disabled = !isOnline;
        } else {
            profileLogoutButton.innerHTML = `<span class="material-icons">login</span> Logar`;
            profileLogoutButton.disabled = !isOnline;
        }

        profileLogoutButton.style.pointerEvents = profileLogoutButton.disabled ? 'none' : 'auto';
        profileLogoutButton.style.opacity = profileLogoutButton.disabled ? '0.5' : '1';
    }
}


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
        // NOVO LOG DE DEBUG: Verifica o estado inicial do onAuthStateChanged
        console.log(`[onAuthStateChanged] Usuário: ${user ? user.uid : 'NULO'}, Online: ${navigator.onLine}`);

        currentUser = user;
        updateProfileMenuLoginState();

        // NOVO: Atualiza o indicador de conexão imediatamente com base no status da rede
        updateConnectionIndicator(navigator.onLine ? 'online' : 'offline');

        if (user) {
            console.log(`User logged in: ${user.uid} (Provider: ${user.isAnonymous ? 'Anonymous' : user.providerData[0]?.providerId || 'Google'})`);
            if (Elements.userIdDisplay()) Elements.userIdDisplay().textContent = `ID: ${user.uid}`;
            if (Elements.userProfilePicture()) Elements.userProfilePicture().src = user.photoURL || "https://placehold.co/40x40/222/FFF?text=?";
            if (Elements.userDisplayName()) Elements.userDisplayName().textContent = user.displayName || (user.isAnonymous ? "Anonymous User" : "Google User");

            console.log(`Setting up Firestore listener for user: ${user.uid}`);
            setupFirestorePlayersListener(currentDbInstance, appId);
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

            // ATUALIZADO: Lógica para lidar com o estado offline/online na tela de login
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
