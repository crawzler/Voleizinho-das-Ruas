// js/firebase/auth.js
// Contém a lógica de autenticação do Firebase (login, logout, observador de estado).

import { auth, db } from './config.js';
import { signInAnonymously, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { loadPlayers, setupFirestorePlayersListener } from '../data/players.js';
import { showPage, updatePlayerModificationAbility } from '../ui/pages.js';
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
        showPage('login-page');
        Elements.userIdDisplay.textContent = 'ID: Deslogado';
    } catch (error) {
        console.error("Erro no logout:", error);
        displayMessage("Erro ao fazer logout.", "error");
    }
}

export function setupAuthListener(appId) {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (user) {
            Elements.userIdDisplay.textContent = `ID: ${user.isAnonymous ? 'Anônimo' : user.uid}`;

            // Se há um usuário autenticado (anônimo ou Google), navega para a start-page.
            // O Firebase gerencia a persistência da sessão automaticamente.
            console.log(`Usuário autenticado (${user.isAnonymous ? 'Anônimo' : 'Google'}). Navegando para start-page.`);
            setupFirestorePlayersListener(appId, user.uid);
            updatePlayerModificationAbility(true); // AGORA: Qualquer usuário autenticado pode modificar
            showPage('start-page');

        } else {
            // Nenhum usuário autenticado (nem mesmo anônimo automático de sessão anterior)
            console.log("Nenhum usuário autenticado. Exibindo página de login.");
            Elements.userIdDisplay.textContent = 'ID: Anônimo';
            updatePlayerModificationAbility(false); // AGORA: Ninguém logado não pode modificar
            showPage('login-page');
        }
    });
}
