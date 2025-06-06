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
        displayMessage("Você foi desconectado.", "info");
        // O onAuthStateChanged (abaixo) lidará com a navegação para a página de login.
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
        displayMessage("Erro ao fazer logout. Tente novamente.", "error");
    }
}

/**
 * Configura o observador de estado de autenticação do Firebase.
 * Isso garante que a UI seja atualizada e os dados sejam carregados/sincronizados
 * sempre que o estado de autenticação mudar.
 * @param {string} appId - O ID do aplicativo.
 */
export function setupAuthListener(appId) {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user; // Atualiza a referência global do usuário

        // Atualiza o estado do menu de perfil (login/logout)
        updateProfileMenuLoginState(user);

        if (user) {
            // Usuário autenticado (anônimo ou Google)
            if (Elements.userIdDisplay()) Elements.userIdDisplay().textContent = `ID: ${user.uid}`;
            if (Elements.userProfilePicture()) Elements.userProfilePicture().src = user.photoURL || "https://placehold.co/40x40/222/FFF?text=?";
            if (Elements.userDisplayName()) Elements.userDisplayName().textContent = user.displayName || (user.isAnonymous ? "Usuário Anônimo" : "Usuário Google");

            // Configura o listener do Firestore APENAS QUANDO O USUÁRIO ESTÁ AUTENTICADO
            // Isso garante que o 'db' e o 'user.uid' estão disponíveis.
            console.log(`Usuário autenticado (${user.isAnonymous ? 'Anônimo' : 'Google'}). Configurando listener do Firestore.`);
            setupFirestorePlayersListener(appId); // MOVIDO PARA AQUI
            updatePlayerModificationAbility(true); // AGORA: Qualquer usuário autenticado pode modificar
            showPage('start-page'); // Mostra a página inicial após o login
        } else {
            // Nenhum usuário autenticado (nem mesmo anônimo automático de sessão anterior)
            console.log("Nenhum usuário autenticado. Exibindo página de login.");
            if (Elements.userIdDisplay()) Elements.userIdDisplay().textContent = 'ID: Anônimo';
            if (Elements.userProfilePicture()) Elements.userProfilePicture().src = "https://placehold.co/40x40/222/FFF?text=?"; // Placeholder
            if (Elements.userDisplayName()) Elements.userDisplayName().textContent = "Usuário Anônimo";
            updatePlayerModificationAbility(false); // AGORA: Ninguém logado não pode modificar
            showPage('login-page'); // Mostra a página de login
            // Quando não há usuário, desinscreve o listener do Firestore para evitar erros.
            setupFirestorePlayersListener(null); // Passa null para desinscrever o listener
        }
    });
}
