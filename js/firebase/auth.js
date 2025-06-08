// js/firebase/auth.js
// Contém a lógica de autenticação do Firebase (login, logout, observador de estado).

import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { setupFirestorePlayersListener } from '../data/players.js';
import { showPage, updatePlayerModificationAbility } from '../ui/pages.js'; // Removido updateProfileMenuLoginState pois será declarado abaixo
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
    // NOVO: Verifica se está offline antes de tentar o login
    if (!navigator.onLine) {
        displayMessage("Você está offline. Conecte-se à internet para fazer login com o Google.", "error");
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
    // NOVO: Verifica se está offline antes de tentar o login anônimo (pode precisar de conexão inicial)
    if (!navigator.onLine) {
        displayMessage("Você está offline. Conecte-se à internet para iniciar uma sessão anônima.", "error");
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
    // NOVO: Informa o usuário se estiver offline ao tentar deslogar e retorna
    if (!navigator.onLine) {
        displayMessage("Você está offline. Não é possível fazer logout agora.", "info");
        // Não chamamos signOut aqui se a intenção é desabilitar o botão,
        // pois signOut() tentaria uma requisição de rede e pode causar erros.
        return; // Sai da função, impedindo o logout
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
 * ATUALIZADO: Atualiza o texto, ícone e estado disabled do botão de login/logout no mini-menu do perfil.
 * Esta função agora é responsável por habilitar/desabilitar o botão de logout e está declarada apenas uma vez.
 */
export function updateProfileMenuLoginState() {
    const profileLogoutButton = Elements.profileLogoutButton();
    const currentUser = getCurrentUser();
    const isOnline = navigator.onLine; // Obtém o status online atual

    if (profileLogoutButton) {
        // Se houver um usuário logado (seja Google ou anônimo)
        if (currentUser) {
            profileLogoutButton.innerHTML = `<span class="material-icons">logout</span> Sair`;
            profileLogoutButton.disabled = !isOnline; // Desabilita se offline
        } else {
            // Se não houver usuário logado
            profileLogoutButton.innerHTML = `<span class="material-icons">login</span> Logar`;
            profileLogoutButton.disabled = !isOnline; // Desabilita se offline
        }

        // Controla também os eventos do ponteiro e a opacidade para feedback visual
        profileLogoutButton.style.pointerEvents = profileLogoutButton.disabled ? 'none' : 'auto';
        profileLogoutButton.style.opacity = profileLogoutButton.disabled ? '0.5' : '1';
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
        updateProfileMenuLoginState(); // ATUALIZADO: Garante que o estado do botão de logout seja atualizado aqui

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
            
            // NOVO: Habilita botões de login/logout quando online
            if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = false;
            if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = false;
        } else {
            // Nenhum usuário autenticado (sessão não encontrada ou expirada)
            console.log("Nenhum usuário autenticado.");
            if (Elements.userIdDisplay()) Elements.userIdDisplay().textContent = 'ID: Não logado'; // Altera para "Não logado"
            if (Elements.userProfilePicture()) Elements.userProfilePicture().src = "https://placehold.co/40x40/222/FFF?text=?";
            if (Elements.userDisplayName()) Elements.userDisplayName().textContent = "Visitante"; // Altera para "Visitante"
            updatePlayerModificationAbility(false);
            showPage('login-page'); // Permanece na página de login
            setupFirestorePlayersListener(null, appId); // Desinscreve o listener do Firestore

            // NOVO: Desabilita botões de login/logout se offline
            if (!navigator.onLine) {
                displayMessage("Sua sessão expirou ou não há conexão. Conecte-se à internet para fazer login.", "error");
                if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = true;
                if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = true;
            } else {
                // NOVO: Habilita botões de login/logout se online
                if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = false;
                if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = false;
            }
        }
    });
}
