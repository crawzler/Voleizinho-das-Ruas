// js/firebase/auth.js
// Contém a lógica de autenticação do Firebase (login, logout, observador de estado).

import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { setupFirestorePlayersListener } from '../data/players.js';
import { showPage, updatePlayerModificationAbility, updateProfileMenuLoginState } from '../ui/pages.js';
import * as Elements from '../ui/elements.js';
import { displayMessage } from '../ui/messages.js';

let currentUser = null;
let currentAuthInstance = null; // Armazena a instância de auth passada
let currentDbInstance = null;   // Armazena a instância de db passada
let isManualAnonymousLogin = false;

const googleLoginProvider = new GoogleAuthProvider();

export function getCurrentUser() {
    return currentUser;
}

export async function loginWithGoogle() {
    if (!currentAuthInstance) {
        console.error("Instância de autenticação não disponível para login com Google.");
        displayMessage("Erro de login: Autenticação não inicializada.", "error");
        return;
    }
    try {
        await signInWithPopup(currentAuthInstance, googleLoginProvider);
        console.log("Login com Google realizado com sucesso!");
    } catch (error) {
        console.error("Erro no login com Google:", error);
        displayMessage("Erro no login com Google. Tente novamente.", "error");
    }
}

export async function signInAnonymouslyUser(appId) {
    if (!currentAuthInstance) {
        console.error("Instância de autenticação não disponível para login anônimo.");
        displayMessage("Erro de login: Autenticação não inicializada.", "error");
        return;
    }
    isManualAnonymousLogin = true;
    try {
        await signInAnonymously(currentAuthInstance);
        console.log("Login anônimo realizado com sucesso!");
    } catch (error) {
        console.error("Erro no login anônimo:", error);
        displayMessage("Erro no login anônimo. Tente novamente.", "error");
    }
}

export async function logout() {
    if (!currentAuthInstance) {
        console.error("Instância de autenticação não disponível para logout.");
        displayMessage("Erro de logout: Autenticação não inicializada.", "error");
        return;
    }
    try {
        await signOut(currentAuthInstance);
        console.log("Logout realizado com sucesso!");
        displayMessage("Você foi desconectado.", "info");
    } catch (error) {
        console.error("Erro no logout:", error);
        displayMessage("Erro ao fazer logout. Tente novamente.", "error");
    }
}

/**
 * Configura o observador de estado de autenticação do Firebase.
 * Este listener é o ponto central para reagir às mudanças de login/logout.
 * @param {object} authInstance - A instância do Auth do Firebase.
 * @param {object} dbInstance - A instância do Firestore do Firebase.
 * @param {string} appId - O ID do aplicativo para uso na sincronização do Firestore.
 */
export function setupAuthListener(authInstance, dbInstance, appId) {
    currentAuthInstance = authInstance; // Armazena a instância
    currentDbInstance = dbInstance;     // Armazena a instância

    onAuthStateChanged(currentAuthInstance, async (user) => { // Usa currentAuthInstance
        currentUser = user; // Atualiza o usuário global
        updateProfileMenuLoginState(); // Atualiza o estado do menu de perfil

        if (user) {
            // Usuário autenticado (incluindo sessões persistidas)
            console.log(`Usuário logado: ${user.uid} (Provider: ${user.isAnonymous ? 'Anônimo' : user.providerData[0]?.providerId || 'Google'})`); // Adicionado log do provedor
            if (Elements.userIdDisplay()) Elements.userIdDisplay().textContent = `ID: ${user.uid}`;
            if (Elements.userProfilePicture()) Elements.userProfilePicture().src = user.photoURL || "https://placehold.co/40x40/222/FFF?text=?"; // Placeholder se não houver foto
            if (Elements.userDisplayName()) Elements.userDisplayName().textContent = user.displayName || (user.isAnonymous ? "Usuário Anônimo" : "Usuário Google");

            console.log(`Configurando listener do Firestore para o usuário: ${user.uid}`);
            setupFirestorePlayersListener(currentDbInstance, appId);
            updatePlayerModificationAbility(true);
            showPage('start-page'); // Mostra a página inicial se houver um usuário autenticado
        } else {
            // Nenhum usuário autenticado (sessão não encontrada ou expirada)
            console.log("Nenhum usuário autenticado. Exibindo página de login.");
            if (Elements.userIdDisplay()) Elements.userIdDisplay().textContent = 'ID: Não logado'; // Altera para "Não logado"
            if (Elements.userProfilePicture()) Elements.userProfilePicture().src = "https://placehold.co/40x40/222/FFF?text=?";
            if (Elements.userDisplayName()) Elements.userDisplayName().textContent = "Visitante"; // Altera para "Visitante"
            updatePlayerModificationAbility(false);
            showPage('login-page'); // Permanece na página de login
            setupFirestorePlayersListener(null, appId); // Desinscreve o listener do Firestore
        }
    });
}
