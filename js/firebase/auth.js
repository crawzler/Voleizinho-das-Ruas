// js/firebase/auth.js
// Contém a lógica de autenticação do Firebase (login, logout, observador de estado).

import { auth, db } from './config.js';
import { signInAnonymously, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { loadPlayers, setupFirestorePlayersListener } from '../data/players.js';
import { showPage, updatePlayerModificationAbility } from '../ui/pages.js';
import * as Elements from '../ui/elements.js';

let currentUser = null;
// Esta flag será usada para diferenciar um login anônimo recém-clicado de uma sessão anônima persistente.
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
    }
}

export async function logout() {
    try {
        await signOut(auth);
        console.log("Logout realizado com sucesso!");
        showPage('login-page'); // Volta para a página de login após o logout
    } catch (error) {
        console.error("Erro ao fazer logout:", error);
    }
}

/**
 * Realiza o login anônimo e navega para a página inicial em caso de sucesso.
 * Esta função é chamada APENAS pelo clique do botão "Entrar sem Logar".
 */
export async function signInAnonymouslyUser() {
    try {
        isManualAnonymousLogin = true; // Sinaliza que este é um login anônimo iniciado manualmente
        const userCredential = await signInAnonymously(auth);
        console.log("Login anônimo manual realizado com sucesso!");

        // CRÍTICO: Se o onAuthStateChanged não for acionado para uma sessão anônima existente,
        // garantimos a navegação aqui para o clique manual.
        if (userCredential.user && userCredential.user.isAnonymous && auth.currentUser) {
            // Verifica se o usuário atual é o mesmo que acabou de ser autenticado
            // e se a página atual é a de login para evitar navegação duplicada.
            if (document.getElementById('login-page').classList.contains('app-page--active')) {
                 showPage('start-page');
            }
        }

    } catch (error) {
        console.error("Erro no login anônimo manual:", error);
        // Se o login anônimo falhar, garante que a página de login seja exibida.
        showPage('login-page');
    } finally {
        // Resetar a flag após a tentativa de login.
        // Um pequeno delay para garantir que o onAuthStateChanged tenha processado, se acionado.
        setTimeout(() => {
            isManualAnonymousLogin = false;
        }, 100); 
    }
}

export function setupAuthListener(appId) {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (user) {
            Elements.userIdDisplay.textContent = `ID: ${user.uid}`;
            console.log(`Usuário autenticado: ${user.uid}`);

            // Carrega os jogadores antes de navegar, mas sem renderizar (renderização só na players-page)
            await loadPlayers(appId, user.uid);

            if (user.isAnonymous) {
                // Se é um login anônimo manual (acabou de clicar no botão)
                if (isManualAnonymousLogin) {
                    console.log("Usuário anônimo (login manual). Navegando para a página inicial.");
                    updatePlayerModificationAbility(true); // Anônimos podem modificar
                    showPage('start-page');
                } else {
                    // É uma sessão anônima existente de um carregamento anterior, mostra a tela de login
                    console.log("Usuário anônimo (sessão existente). Mantendo na página de login.");
                    updatePlayerModificationAbility(true); // Anônimos podem modificar
                    showPage('login-page');
                }
            } else {
                // Usuário logado via Google (não anônimo), sempre navega para a página inicial
                console.log(`Usuário não anônimo (Google). Carregando jogadores para ${user.uid}...`);
                setupFirestorePlayersListener(appId, user.uid);
                updatePlayerModificationAbility(false); // Google não pode modificar
                showPage('start-page');
            }
        } else {
            // Nenhum usuário autenticado (nem mesmo anônimo automático de sessão anterior)
            console.log("Nenhum usuário autenticado. Exibindo página de login.");
            Elements.userIdDisplay.textContent = 'ID: Anônimo'; // Exibe status anônimo na sidebar
            updatePlayerModificationAbility(true); // Permite modificação enquanto não há login confirmado
            showPage('login-page'); // Garante que a página de login seja exibida
        }
        // A flag isManualAnonymousLogin será resetada no bloco finally de signInAnonymouslyUser
        // ou após um pequeno delay se onAuthStateChanged for acionado.
    });
}
