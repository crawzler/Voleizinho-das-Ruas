// js/firebase/auth.js
// Contém a lógica de autenticação do Firebase (login, logout, observador de estado).

import { auth, db } from './config.js';
import { signInAnonymously, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { loadPlayers, setupFirestorePlayersListener } from '../data/players.js';
import { showPage, updatePlayerModificationAbility, updateProfileMenuLoginState } from '../ui/pages.js'; // NOVO: Importa updateProfileMenuLoginState
import * as Elements from '../ui/elements.js';
import { displayMessage } from '../ui/messages.js';

let currentUser = null;
let isManualAnonymousLogin = false;

const googleLoginProvider = new GoogleAuthProvider();

export function getCurrentUser() {
    return currentUser;
}

export async function loginWithGoogle() {
    try {
        await signInWithPopup(auth, googleLoginProvider);
        console.log("Login com Google realizado com sucesso!");
        // O onAuthStateChanged (abaixo) lidará com a navegação para a página inicial após o login.
    } catch (error) {
        console.error("Erro no login com Google:", error);
        displayMessage("Erro no login com Google. Tente novamente.", "error");
    }
}

export async function signInAnonymouslyUser(appId) {
    isManualAnonymousLogin = true;
    try {
        await signInAnonymously(auth);
        console.log("Login anônimo realizado com sucesso!");
        // O onAuthStateChanged (abaixo) lidará com a navegação para a página inicial após o login.
    } catch (error) {
        console.error("Erro no login anônimo:", error);
        displayMessage("Erro no login anônimo. Tente novamente.", "error");
    }
}

export async function logout() {
    try {
        await signOut(auth);
        console.log("Logout realizado com sucesso!");
        displayMessage("Desconectado com sucesso.", "success");
        // O onAuthStateChanged lidará com a navegação para a página de login.
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
        displayMessage("Erro ao fazer logout. Tente novamente.", "error");
    }
}

/**
 * Configura o observador de estado de autenticação do Firebase.
 * Isso garante que o aplicativo reaja a mudanças no estado de login/logout.
 * @param {string} appId - O ID do aplicativo para uso com o Firestore.
 */
export function setupAuthListener(appId) {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user; // Atualiza a variável global currentUser
        console.log("[Auth Listener] Estado de autenticação alterado. User:", user ? user.uid : "null");

        // NOVO: Sempre atualiza o estado do botão de login/logout no menu do perfil
        updateProfileMenuLoginState();

        if (user) {
            // Usuário autenticado (anônimo ou Google)
            if (Elements.userIdDisplay()) Elements.userIdDisplay().textContent = `ID: ${user.uid}`;
            if (Elements.userProfilePicture()) Elements.userProfilePicture().src = user.photoURL || "https://placehold.co/40x40/222/FFF?text=?";
            if (Elements.userDisplayName()) Elements.userDisplayName().textContent = user.displayName || (user.isAnonymous ? "Usuário Anônimo" : "Usuário Google");

            // Se há um usuário autenticado (anônimo ou Google), navega para a start-page.
            // O Firebase gerencia a persistência da sessão automaticamente.
            console.log(`Usuário autenticado (${user.isAnonymous ? 'Anônimo' : 'Google'}). Navegando para start-page.`);
            setupFirestorePlayersListener(appId, user.uid);
            updatePlayerModificationAbility(true); // AGORA: Qualquer usuário autenticado pode modificar
            showPage('start-page');

        } else {
            // Nenhum usuário autenticado (nem mesmo anônimo automático de sessão anterior)
            console.log("Nenhum usuário autenticado. Exibindo página de login.");
            if (Elements.userIdDisplay()) Elements.userIdDisplay().textContent = 'ID: Anônimo';
            // Adicionado verificação de nulidade para userProfilePicture e userDisplayName
            if (Elements.userProfilePicture()) Elements.userProfilePicture().src = "https://placehold.co/40x40/222/FFF?text=?"; // Placeholder
            if (Elements.userDisplayName()) Elements.userDisplayName().textContent = "Usuário Anônimo";
            updatePlayerModificationAbility(false); // AGORA: Ninguém logado não pode modificar
            showPage('login-page');
        }
    });
}
