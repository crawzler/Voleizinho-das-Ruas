// js/utils/connectivity.js
// Sistema robusto de detecção de conectividade

class ConnectivityManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.callbacks = [];
        this.checkInterval = null;
        this.lastCheck = Date.now();
        this.consecutiveFailures = 0;
        
        this.init();
    }
    
    init() {
        // Listeners nativos do navegador
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Verificação periódica mais inteligente
        this.startPeriodicCheck();
    }
    
    startPeriodicCheck() {
        // Verifica conectividade a cada 30 segundos quando online
        // ou a cada 10 segundos quando offline
        const interval = this.isOnline ? 30000 : 10000;
        
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        
        this.checkInterval = setInterval(() => {
            this.checkConnectivity();
        }, interval);
    }
    
    async checkConnectivity() {
        try {
            // Tenta fazer uma requisição leve para verificar conectividade real
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch('https://www.google.com/favicon.ico', {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-cache',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (this.consecutiveFailures > 0) {
                this.consecutiveFailures = 0;
                this.handleOnline();
            }
            
            return true;
        } catch (error) {
            this.consecutiveFailures++;
            
            // Só considera offline após 2 falhas consecutivas
            if (this.consecutiveFailures >= 2 && this.isOnline) {
                this.handleOffline();
            }
            
            return false;
        }
    }
    
    handleOnline() {
        if (!this.isOnline) {
            // Log removido
            this.isOnline = true;
            this.consecutiveFailures = 0;
            this.notifyCallbacks('online');
            this.startPeriodicCheck(); // Reinicia com intervalo para online
        }
    }
    
    handleOffline() {
        if (this.isOnline) {
            // Log removido
            this.isOnline = false;
            this.notifyCallbacks('offline');
            this.startPeriodicCheck(); // Reinicia com intervalo para offline
        }
    }
    
    notifyCallbacks(status) {
        this.callbacks.forEach(callback => {
            try {
                callback(status);
            } catch (error) {
                // Log removido
            }
        });
    }
    
    onStatusChange(callback) {
        this.callbacks.push(callback);
        
        // Chama imediatamente com o status atual
        callback(this.isOnline ? 'online' : 'offline');
    }
    
    removeCallback(callback) {
        const index = this.callbacks.indexOf(callback);
        if (index > -1) {
            this.callbacks.splice(index, 1);
        }
    }
    
    getStatus() {
        return this.isOnline ? 'online' : 'offline';
    }
    
    destroy() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
        this.callbacks = [];
    }
}

// Instância singleton
const connectivityManager = new ConnectivityManager();

export default connectivityManager;
export { ConnectivityManager };
