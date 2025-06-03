// js/firebase/config.js
// Contém a configuração e inicialização do Firebase.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

let app;
let db;
let auth;
let appId;
let firebaseConfig;

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

    // Inicializa o Firebase
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    return { app, auth, db, appId, firebaseConfig };
}

// Exporta as instâncias para que outros módulos possam usá-las
export { app, auth, db, appId, firebaseConfig };

