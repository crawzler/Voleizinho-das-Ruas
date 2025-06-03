// js/firebase/auth.js
// Contém a lógica de autenticação do Firebase (login, logout, observador de estado).

import { auth, db } from './config.js';
import { signInAnonymously, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { loadPlayers, setupFirestorePlayersListener } from '../data/players.js';
import { showPage, updatePlayerModificationAbility } from '../ui/pages.js';
import * as Elements from '../ui/elements.js'; // Importa elementos para exibir o ID do usuário

let currentUser = null; // Variável para armazenar o usuário atual

// Provedor de autenticação Google
const googleLoginProvider = new GoogleAuthProvider();

/**
 * Retorna o objeto do usuário autenticado atualmente.
 * @returns {Object|null} O objeto User do Firebase ou null se não houver usuário.
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Inicia o processo de login com o Google.
 */
export async function loginWithGoogle() {
    try {
        await signInWithPopup(auth, googleLoginProvider);
        console.log("Login com Google realizado com sucesso!");
        // O onAuthStateChanged lidará com a navegação para a página inicial
    } catch (error) {
        console.error("Erro no login com Google:", error);
        // Trate o erro de login, talvez mostrando uma mensagem para o usuário
    }
}

/**
 * Realiza o logout do usuário.
 */
export async function logout() {
    try {
        await signOut(auth);
        console.log("Logout realizado com sucesso!");
        // Após o logout, o onAuthStateChanged será acionado e redirecionará para a página de login
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
    }
}

/**
 * Configura o observador de estado de autenticação do Firebase.
 * Esta função é o ponto central para gerenciar o estado do usuário e a exibição da página.
 * @param {string} appId - O ID do aplicativo para carregamento de dados.
 */
export function setupAuthListener(appId) {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user; // Atualiza a variável global do usuário

        if (user) {
            console.log("Usuário autenticado:", user.uid);
            Elements.userIdDisplay.textContent = `ID: ${user.uid}`; // Exibe o ID do usuário

            if (!user.isAnonymous) {
                console.log(`Usuário não anônimo. Carregando jogadores para ${user.uid}...`);
                await loadPlayers(appId, user.uid);
                setupFirestorePlayersListener(appId, user.uid);
                updatePlayerModificationAbility(false); // Habilita modificação para usuários não anônimos
            } else {
                console.log("Usuário anônimo. Carregando jogadores locais...");
                await loadPlayers(appId, null); // Carrega jogadores locais para anônimos
                updatePlayerModificationAbility(true); // Desabilita modificação para usuários anônimos
            }
            showPage('start-page'); // Sempre redireciona para a página inicial após qualquer login
        } else {
            console.log("Nenhum usuário autenticado. Tentando login anônimo...");
            Elements.userIdDisplay.textContent = 'ID: Anônimo'; // Exibe status anônimo
            updatePlayerModificationAbility(true); // Desabilita modificação

            try {
                await signInAnonymously(auth); // Tenta login anônimo
                // Se o login anônimo for bem-sucedido, o onAuthStateChanged será acionado novamente
                // com um usuário anônimo, que então exibirá a 'start-page'.
            } catch (error) {
                console.error("Erro no login anônimo:", error);
                // Se o login anônimo falhar, exibe a página de login para o usuário tentar novamente
                showPage('login-page');
            }
        }
    });
}
