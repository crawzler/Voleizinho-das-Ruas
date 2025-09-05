// js/firebase/recovery.js
// Sistema de recuperação de erros de conexão Firestore

class FirestoreRecoveryManager {
    constructor() {
        this.connectionErrors = 0;
        this.maxRetries = 3;
        this.isRecovering = false;
        this.listeners = [];
        this.init();
    }
    
    init() {
        window.addEventListener('error', (event) => {
            if (this.isFirestoreError(event.error)) {
                this.handleFirestoreError(event.error);
            }
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            if (this.isFirestoreError(event.reason)) {
                this.handleFirestoreError(event.reason);
                event.preventDefault();
            }
        });
    }
    
    isFirestoreError(error) {
        if (!error) return false;
        const errorString = error.toString().toLowerCase();
        return errorString.includes('firestore') || errorString.includes('webchannel');
    }
    
    async handleFirestoreError(error) {
        if (this.isRecovering) return;
        this.connectionErrors++;
        if (this.connectionErrors >= this.maxRetries) {
            this.startRecoveryProcess();
        }
    }
    
    async startRecoveryProcess() {
        if (this.isRecovering) return;
        this.isRecovering = true;
        this.notifyListeners('recovery-start');
        
        try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            await this.reinitializeFirebase();
            this.connectionErrors = 0;
            this.isRecovering = false;
            this.notifyListeners('recovery-success');
        } catch (error) {
            this.isRecovering = false;
            this.notifyListeners('recovery-failed');
        }
    }
    
    async reinitializeFirebase() {
        const { initFirebaseApp } = await import('./config.js');
        const { setupAuthListener } = await import('./auth.js');
        const { setupFirestorePlayersListener } = await import('../data/players.js');
        
        const { app, db, auth } = await initFirebaseApp();
        const appId = localStorage.getItem('appId') || 'default';
        
        setupAuthListener(auth, db, appId);
        setupFirestorePlayersListener(db, appId);
    }
    
    addListener(callback) {
        this.listeners.push(callback);
    }
    
    notifyListeners(event) {
        this.listeners.forEach(callback => {
            try {
                callback(event);
            } catch (error) {
                console.error('Erro em listener:', error);
            }
        });
    }
    
    async checkConnectionHealth() {
        try {
            const { initFirebaseApp } = await import('./config.js');
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
            
            const { db } = await initFirebaseApp();
            const appId = localStorage.getItem('appId') || 'default';
            
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('timeout')), 3000)
            );
            
            await Promise.race([
                getDoc(doc(db, 'artifacts', appId, 'health', 'check')),
                timeoutPromise
            ]);
            
            return true;
        } catch (error) {
            return false;
        }
    }
    
    reset() {
        this.connectionErrors = 0;
        this.isRecovering = false;
    }
}

export default new FirestoreRecoveryManager();