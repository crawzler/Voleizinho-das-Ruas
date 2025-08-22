/**
 * Safe Areas Utility - Gerenciamento de inset areas para dispositivos móveis
 */

class SafeAreasManager {
    constructor() {
        this.init();
    }

    init() {
        this.detectSafeAreas();
        this.setupEventListeners();
        this.applySafeAreas();
    }

    /**
     * Detecta se o dispositivo suporta safe areas
     */
    detectSafeAreas() {
        try {
            this.hasSafeAreas = window.CSS && CSS.supports && CSS.supports('padding', 'env(safe-area-inset-top)');
        } catch (error) {
            // Log removido
            this.hasSafeAreas = false;
        }
        
        if (this.hasSafeAreas) {
            document.documentElement.classList.add('has-safe-areas');
        }
    }

    /**
     * Configura event listeners para mudanças de orientação
     */
    setupEventListeners() {
        // Timeout mais longo para dispositivos mais lentos
        const ORIENTATION_TIMEOUT = 250;
        
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.applySafeAreas();
            }, ORIENTATION_TIMEOUT);
        });

        // Debounce para resize events
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.applySafeAreas();
            }, 100);
        });
    }

    /**
     * Aplica safe areas dinamicamente
     */
    applySafeAreas() {
        if (!this.hasSafeAreas) return;

        const root = document.documentElement;
        
        // Atualiza as variáveis CSS
        root.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top, 0px)');
        root.style.setProperty('--safe-area-inset-right', 'env(safe-area-inset-right, 0px)');
        root.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom, 0px)');
        root.style.setProperty('--safe-area-inset-left', 'env(safe-area-inset-left, 0px)');

        // Aplica classe no body para indicar que safe areas estão ativas
        document.body.classList.add('safe-areas-active');
    }

    /**
     * Obtém os valores das safe areas
     */
    getSafeAreaValues() {
        const computedStyle = getComputedStyle(document.documentElement);
        
        return {
            top: computedStyle.getPropertyValue('--safe-area-inset-top'),
            right: computedStyle.getPropertyValue('--safe-area-inset-right'),
            bottom: computedStyle.getPropertyValue('--safe-area-inset-bottom'),
            left: computedStyle.getPropertyValue('--safe-area-inset-left')
        };
    }

    /**
     * Verifica se está em modo PWA
     */
    isPWA() {
        return window.matchMedia('(display-mode: standalone)').matches ||
               window.matchMedia('(display-mode: fullscreen)').matches ||
               window.navigator.standalone === true;
    }

    /**
     * Aplica ajustes específicos para PWA
     */
    applyPWAAdjustments() {
        const PWA_TOP_OFFSET = '10px';
        const PWA_BOTTOM_OFFSET = '30px';
        
        if (this.isPWA()) {
            document.body.classList.add('pwa-mode');
            
            const root = document.documentElement;
            root.style.setProperty('--pwa-top-offset', PWA_TOP_OFFSET);
            root.style.setProperty('--pwa-bottom-offset', PWA_BOTTOM_OFFSET);
            
            // Força padding bottom para PWA
            document.body.style.paddingBottom = `max(var(--safe-area-inset-bottom), ${PWA_BOTTOM_OFFSET})`;
        }
    }

    /**
     * Debug: mostra as safe areas visualmente
     */
    debugSafeAreas(show = true) {
        if (show) {
            document.body.classList.add('debug-safe-areas');
        } else {
            document.body.classList.remove('debug-safe-areas');
        }
    }

    /**
     * Aplica safe areas a um elemento específico
     */
    applySafeAreaToElement(element, sides = ['top', 'right', 'bottom', 'left']) {
        if (!element || !this.hasSafeAreas) return;

        sides.forEach(side => {
            const property = `padding-${side}`;
            const value = `var(--safe-area-inset-${side})`;
            element.style.setProperty(property, value);
        });
    }

    /**
     * Remove safe areas de um elemento específico
     */
    removeSafeAreaFromElement(element, sides = ['top', 'right', 'bottom', 'left']) {
        if (!element || !this.hasSafeAreas) return;

        sides.forEach(side => {
            const property = `padding-${side}`;
            element.style.removeProperty(property);
        });
    }
}

// Inicializa o gerenciador de safe areas
const safeAreasManager = new SafeAreasManager();

// Exporta para uso em outros módulos
export default safeAreasManager;
