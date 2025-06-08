// js/firebase/auth.js
// Contém a lógica de autenticação do Firebase (login, logout, observador de estado).

import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { setupFirestorePlayersListener } from '../data/players.js';
import { getPlayers } from '../data/players.js'; // NOVO: Importa getPlayers para verificar dados locais
import { showPage, updatePlayerModificationAbility } from '../ui/pages.js';
import * as Elements from '../ui/elements.js';
import { displayMessage } from '../ui/messages.js';

let currentUser = null;
let currentAuthInstance = null; // Stores the Firebase Auth instance
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
    // NEW: Checks if offline before attempting login
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
    // NEW: Checks if offline before attempting anonymous login (may require initial connection)
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
    // NEW: Informs the user if offline when attempting to log out and returns
    if (!navigator.onLine) {
        displayMessage("You are offline. Cannot log out now.", "info");
        // We do not call signOut here if the intention is to disable the button,
        // as signOut() would attempt a network request and could cause errors.
        return; // Exits the function, preventing logout
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
    const isOnline = navigator.onLine; // Gets the current online status

    if (profileLogoutButton) {
        // If there is a logged-in user (either Google or anonymous)
        if (currentUser) {
            profileLogoutButton.innerHTML = `<span class="material-icons">logout</span> Sair`;
            profileLogoutButton.disabled = !isOnline; // Disables if offline
        } else {
            // If there is no logged-in user
            profileLogoutButton.innerHTML = `<span class="material-icons">login</span> Logar`;
            profileLogoutButton.disabled = !isOnline; // Disables if offline
        }

        // Also controls pointer events and opacity for visual feedback
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
    currentAuthInstance = authInstance; // Stores the instance
    currentDbInstance = dbInstance;     // Stores the instance

    onAuthStateChanged(currentAuthInstance, async (user) => { // Uses currentAuthInstance
        currentUser = user; // Updates the global user
        updateProfileMenuLoginState(); // UPDATED: Ensures the logout button state is updated here

        if (user) {
            // User authenticated (including persisted sessions)
            console.log(`User logged in: ${user.uid} (Provider: ${user.isAnonymous ? 'Anonymous' : user.providerData[0]?.providerId || 'Google'})`); // Added provider log
            if (Elements.userIdDisplay()) Elements.userIdDisplay().textContent = `ID: ${user.uid}`;
            if (Elements.userProfilePicture()) Elements.userProfilePicture().src = user.photoURL || "https://placehold.co/40x40/222/FFF?text=?"; // Placeholder if no photo
            if (Elements.userDisplayName()) Elements.userDisplayName().textContent = user.displayName || (user.isAnonymous ? "Anonymous User" : "Google User");

            console.log(`Setting up Firestore listener for user: ${user.uid}`);
            setupFirestorePlayersListener(currentDbInstance, appId);
            updatePlayerModificationAbility(true);
            showPage('start-page'); // Shows the home page if there's an authenticated user
            
            // NEW: Ensures login/logout buttons are enabled when online
            if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = false;
            if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = false;
        } else {
            // No user authenticated (session not found or expired)
            console.log("No user authenticated.");
            if (Elements.userIdDisplay()) Elements.userIdDisplay().textContent = 'ID: Not logged in'; // Changes to "Not logged in"
            if (Elements.userProfilePicture()) Elements.userProfilePicture().src = "https://placehold.co/40x40/222/FFF?text=?";
            if (Elements.userDisplayName()) Elements.userDisplayName().textContent = "Visitor"; // Changes to "Visitor"
            updatePlayerModificationAbility(false);
            setupFirestorePlayersListener(null, appId); // Unsubscribes the Firestore listener

            // ATUALIZADO: Sempre tenta mostrar a start-page se offline, independente de haver jogadores locais
            if (!navigator.onLine) {
                showPage('start-page'); // Directs to start-page to allow access to local data
                displayMessage("Your session expired due to lack of connection, but you can continue using local data. Reconnect to log in again.", "info");
                // NEW: Disables login buttons if offline
                if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = true;
                if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = true;
            } else {
                // NEW: If online, show login page and enable buttons
                showPage('login-page');
                if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = false;
                if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = false;
            }
        }
    });
}
