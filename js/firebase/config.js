// js/firebase/config.js
// Contém a configuração e inicialização do Firebase.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let app;
let db;
let auth;
let appId; // Variável para armazenar o appId
let firebaseConfig;

/**
 * Inicializa o Firebase App e define as instâncias de Auth e Firestore.
 */
export async function initFirebaseApp() {
    // Determine appId e firebaseConfig
    appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    console.log("App ID (do ambiente ou padrão):", appId);

    try {
        if (typeof __firebase_config !== 'undefined' && __firebase_config) {
            firebaseConfig = JSON.parse(__firebase_config);
            console.log("Firebase Config (do ambiente):", firebaseConfig);
        } else {
            // Fallback para a configuração fornecida pelo usuário se __firebase_config não estiver definido ou for vazio
            firebaseConfig = {
                apiKey: "AIzaSyDNnPPdQziILeX9HjjJg5oW_hp6hDRCrB0",
                authDomain: "volei-das-ruas-dz.firebaseapp.com",
                projectId: "volei-das-ruas-dz",
                storageBucket: "volei-das-ruas-dz.firebasestorage.app",
                messagingSenderId: "318529125182",
                appId: "1:318529125182:web:5f77edf287bbd749948a6f"
            };
            console.log("Firebase Config (fallback do usuário):", firebaseConfig);
        }
    } catch (e) {
        console.error("Erro ao analisar __firebase_config, usando fallback:", e);
        firebaseConfig = {
            apiKey: "AIzaSyDNnPPdQziILeX9HjjJg5oW_hp6hDRCrB0",
            authDomain: "volei-das-ruas-dz.firebaseapp.com",
            projectId: "volei-das-ruas-dz",
            storageBucket: "volei-das-ruas-dz.firebasestorage.app",
            messagingSenderId: "318529125182",
            appId: "1:318529125182:web:5f77edf287bbd749948a6f"
        };
    }

    // Inicializa o Firebase App
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    console.log("Firebase App inicializado.");
}

/**
 * Retorna a instância do Firebase App.
 * @returns {object} A instância do Firebase App.
 */
export function getFirebaseApp() {
    return app;
}

/**
 * Retorna a instância do Firestore.
 * @returns {object} A instância do Firestore.
 */
export function getFirestoreDb() {
    return db;
}

/**
 * Retorna a instância de autenticação do Firebase.
 * @returns {object} A instância de autenticação.
 */
export function getAuthInstance() {
    return auth;
}

/**
 * Retorna o ID do aplicativo.
 * @returns {string} O ID do aplicativo.
 */
export function getAppId() {
    return appId;
}

// Exporta as instâncias diretamente para facilitar o uso em outros módulos
export { db, auth };
