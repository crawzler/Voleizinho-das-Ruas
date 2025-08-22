// pwa-manager.js
// Gerenciamento de funcionalidades PWA

class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.init();
    }

    init() {
        this.checkInstallStatus();
        this.setupInstallPrompt();
        this.setupIconUpdate();
    }

    // Verifica se o app já está instalado
    checkInstallStatus() {
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        const isIosStandalone = window.navigator.standalone === true;
        this.isInstalled = isStandalone || isIosStandalone;
    }

    // Configura o prompt de instalação
    setupInstallPrompt() {
        // Captura o evento beforeinstallprompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            setTimeout(() => this.showLoginInstallButton(), 100);
        });
        
        // Fallback: mostra botão mesmo sem o evento
        setTimeout(() => {
            if (!this.deferredPrompt && !this.isInstalled) {
                this.showLoginInstallButton();
            }
        }, 3000);

        // Escuta quando o app é instalado
        window.addEventListener('appinstalled', () => {
            this.isInstalled = true;
            this.deferredPrompt = null;
            this.hideLoginInstallButton();
            localStorage.setItem('pwa-was-installed', 'true');
        });
    }

    // Mostra o prompt de instalação
    async showInstallPrompt() {
        if (!this.deferredPrompt) return;

        try {
            const result = await this.deferredPrompt.prompt();
        } catch (error) {
            // Silencioso
        }
        
        this.deferredPrompt = null;
    }

    // Força instalação manual (para botão)
    async forceInstall() {
        if (this.deferredPrompt) {
            await this.showInstallPrompt();
        } else {
            const userAgent = navigator.userAgent;
            let instructions = 'Para instalar manualmente:\n\n';
            
            if (userAgent.includes('Chrome')) {
                instructions += 'Chrome: Menu (⋮) → "Instalar app"\n\n';
            } else if (userAgent.includes('Safari')) {
                instructions += 'Safari: Compartilhar → "Adicionar à Tela Inicial"\n\n';
            } else if (userAgent.includes('Edge')) {
                instructions += 'Edge: Menu → Apps → "Instalar este site"\n\n';
            }
            
            instructions += 'Se não aparecer, recarregue a página e tente novamente.';
            alert(instructions);
        }
    }

    // Configura atualização de ícones
    setupIconUpdate() {
        this.forceManifestUpdate();
        
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                this.updateAppIcons();
            });
        }
    }

    // Força atualização do manifest
    forceManifestUpdate() {
        const manifestLink = document.querySelector('link[rel="manifest"]');
        if (manifestLink) {
            const timestamp = Date.now();
            const href = manifestLink.href.split('?')[0];
            manifestLink.href = `${href}?v=${timestamp}`;
        }
    }

    // Atualiza ícones do app
    updateAppIcons() {
        const timestamp = Date.now();
        
        const favicon = document.querySelector('link[rel="icon"]');
        if (favicon) {
            favicon.href = `${favicon.href.split('?')[0]}?v=${timestamp}`;
        }

        const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
        if (appleIcon) {
            appleIcon.href = `${appleIcon.href.split('?')[0]}?v=${timestamp}`;
        }

        this.clearIconCache();
    }

    // Limpa cache de ícones
    async clearIconCache() {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            try {
                const channel = new MessageChannel();
                
                channel.port1.onmessage = (event) => {
                    if (event.data.success) {
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    }
                };

                navigator.serviceWorker.controller.postMessage(
                    { type: 'CLEAR_ICON_CACHE' },
                    [channel.port2]
                );
            } catch (error) {
                // Silencioso
            }
        }
    }

    // Verifica se pode mostrar prompt de instalação
    canShowInstallPrompt() {
        return !this.isInstalled && this.deferredPrompt !== null;
    }

    // Mostra botão de instalação na tela de login
    showLoginInstallButton() {
        const loginButton = document.getElementById('install-pwa-login-button');
        
        if (loginButton && !this.isInstalled) {
            loginButton.style.display = 'flex';
            
            const newButton = loginButton.cloneNode(true);
            loginButton.parentNode.replaceChild(newButton, loginButton);
            
            newButton.addEventListener('click', () => {
                this.forceInstall();
            });
        }
    }

    // Esconde botão de instalação na tela de login
    hideLoginInstallButton() {
        const loginButton = document.getElementById('install-pwa-login-button');
        if (loginButton) {
            loginButton.style.display = 'none';
        }
    }
}

// Inicializa o PWA Manager
const pwaManager = new PWAManager();

// Exporta para uso global
window.pwaManager = pwaManager;

export default pwaManager;
