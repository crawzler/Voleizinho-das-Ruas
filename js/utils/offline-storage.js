// js/utils/offline-storage.js
// Sistema de armazenamento offline inteligente

class OfflineStorage {
    constructor() {
        this.dbName = 'VoleizinhoOfflineDB';
        this.version = 1;
        this.db = null;
        this.isSupported = this.checkSupport();
    }
    
    checkSupport() {
        return 'indexedDB' in window && 'localStorage' in window;
    }
    
    async init() {
        if (!this.isSupported) {
            // Log removido
            return;
        }
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Store para dados de jogadores
                if (!db.objectStoreNames.contains('players')) {
                    db.createObjectStore('players', { keyPath: 'id' });
                }
                
                // Store para configurações
                if (!db.objectStoreNames.contains('config')) {
                    db.createObjectStore('config', { keyPath: 'key' });
                }
                
                // Store para histórico de jogos
                if (!db.objectStoreNames.contains('history')) {
                    db.createObjectStore('history', { keyPath: 'id' });
                }
                
                // Store para times
                if (!db.objectStoreNames.contains('teams')) {
                    db.createObjectStore('teams', { keyPath: 'id' });
                }
                
                // Store para cache de recursos
                if (!db.objectStoreNames.contains('resources')) {
                    db.createObjectStore('resources', { keyPath: 'url' });
                }
            };
        });
    }
    
    async saveData(storeName, data) {
        if (!this.db) {
            // Fallback para localStorage
            try {
                const key = `${this.dbName}_${storeName}`;
                localStorage.setItem(key, JSON.stringify(data));
                return true;
            } catch (error) {
                // Log removido
                return false;
            }
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            const request = Array.isArray(data) 
                ? this.saveMultiple(store, data)
                : store.put(data);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => {
                // Log removido
                reject(request.error);
            };
        });
    }
    
    saveMultiple(store, dataArray) {
        dataArray.forEach(item => store.put(item));
        return { onsuccess: null, onerror: null };
    }
    
    async getData(storeName, key = null) {
        if (!this.db) {
            // Fallback para localStorage
            try {
                const storageKey = `${this.dbName}_${storeName}`;
                const data = localStorage.getItem(storageKey);
                return data ? JSON.parse(data) : null;
            } catch (error) {
                // Log removido
                return null;
            }
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            const request = key ? store.get(key) : store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => {
                // Log removido
                reject(request.error);
            };
        });
    }
    
    async clearStore(storeName) {
        if (!this.db) {
            try {
                const key = `${this.dbName}_${storeName}`;
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                // Log removido
                return false;
            }
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            const request = store.clear();
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }
    
    // Métodos específicos para dados do app
    async savePlayers(players) {
        return this.saveData('players', players);
    }
    
    async getPlayers() {
        return this.getData('players') || [];
    }
    
    async saveConfig(config) {
        return this.saveData('config', { key: 'app_config', ...config });
    }
    
    async getConfig() {
        const result = await this.getData('config', 'app_config');
        return result || {};
    }
    
    async saveGameHistory(history) {
        return this.saveData('history', history);
    }
    
    async getGameHistory() {
        return this.getData('history') || [];
    }
    
    async saveTeams(teams) {
        return this.saveData('teams', teams);
    }
    
    async getTeams() {
        return this.getData('teams') || [];
    }
    
    // Cache de recursos (ícones, imagens, etc.)
    async cacheResource(url, data, type = 'text') {
        const resource = {
            url,
            data,
            type,
            timestamp: Date.now(),
            expires: Date.now() + (24 * 60 * 60 * 1000) // 24 horas
        };
        
        return this.saveData('resources', resource);
    }
    
    async getCachedResource(url) {
        const resource = await this.getData('resources', url);
        
        if (!resource) return null;
        
        // Verifica se o recurso expirou
        if (Date.now() > resource.expires) {
            this.deleteCachedResource(url);
            return null;
        }
        
        return resource;
    }
    
    async deleteCachedResource(url) {
        if (!this.db) return;
        
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['resources'], 'readwrite');
            const store = transaction.objectStore('resources');
            
            const request = store.delete(url);
            request.onsuccess = () => resolve(true);
            request.onerror = () => resolve(false);
        });
    }
    
    // Limpeza geral
    async clearAll() {
        const stores = ['players', 'config', 'history', 'teams', 'resources'];
        
        for (const store of stores) {
            try {
                await this.clearStore(store);
            } catch (error) {
                // Log removido
            }
        }
    }
    
    // Estatísticas de uso
    async getStorageStats() {
        if (!this.db) return { supported: false };
        
        const stats = { supported: true, stores: {} };
        const stores = ['players', 'config', 'history', 'teams', 'resources'];
        
        for (const storeName of stores) {
            try {
                const data = await this.getData(storeName);
                stats.stores[storeName] = {
                    count: Array.isArray(data) ? data.length : (data ? 1 : 0),
                    size: JSON.stringify(data || {}).length
                };
            } catch (error) {
                stats.stores[storeName] = { count: 0, size: 0, error: error.message };
            }
        }
        
        return stats;
    }
}

// Instância singleton
const offlineStorage = new OfflineStorage();

export default offlineStorage;
export { OfflineStorage };
