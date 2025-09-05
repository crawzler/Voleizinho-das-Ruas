// js/firebase/dev-fix.js
// Correções para desenvolvimento local

export function isLocalDevelopment() {
    return window.location.hostname === 'localhost' || 
           window.location.port === '5500' ||
           window.location.protocol === 'file:';
}

export async function applyDevFirestoreFix() {
    if (!isLocalDevelopment()) return;
    
    try {
        const { initFirebaseApp } = await import('./config.js');
        const { getFirestore } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        
        const { app } = await initFirebaseApp();
        const db = getFirestore(app);
        
        if (db._delegate && db._delegate._databaseId) {
            db._delegate._settings = {
                ...db._delegate._settings,
                experimentalForceLongPolling: true,
                ignoreUndefinedProperties: true
            };
        }
        
        console.log('Fix de desenvolvimento aplicado');
        return true;
    } catch (error) {
        console.warn('Erro no fix de desenvolvimento:', error);
        return false;
    }
}

if (isLocalDevelopment()) {
    applyDevFirestoreFix();
}