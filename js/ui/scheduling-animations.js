// js/ui/scheduling-animations.js
// Animações e melhorias visuais para a página de agendamentos redesenhada

/**
 * Inicializa as animações da página de agendamentos
 */
export function initSchedulingAnimations() {
    setupTabAnimations();
    setupCardAnimations();
    setupModalAnimations();
}

/**
 * Configura animações das abas
 */
function setupTabAnimations() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabIndicator = document.querySelector('.section-tabs::after');
    
    tabButtons.forEach((button, index) => {
        button.addEventListener('click', () => {
            // Atualiza posição do indicador
            updateTabIndicator(index);
            
            // Adiciona efeito de ripple
            createRippleEffect(button);
        });
    });
}

/**
 * Atualiza a posição do indicador das abas
 */
function updateTabIndicator(activeIndex) {
    const tabsContainer = document.querySelector('.section-tabs');
    if (tabsContainer) {
        const translateX = activeIndex * 100;
        tabsContainer.style.setProperty('--tab-indicator-position', `${translateX}%`);
    }
}

/**
 * Cria efeito ripple nos botões
 */
function createRippleEffect(element) {
    const ripple = document.createElement('span');
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (rect.width / 2 - size / 2) + 'px';
    ripple.style.top = (rect.height / 2 - size / 2) + 'px';
    ripple.classList.add('ripple');
    
    element.appendChild(ripple);
    
    setTimeout(() => {
        ripple.remove();
    }, 600);
}

/**
 * Configura animações dos cards
 */
function setupCardAnimations() {
    // Observa quando novos cards são adicionados
    const gamesList = document.querySelectorAll('.games-list');
    
    gamesList.forEach(list => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node.classList.contains('scheduled-game-card')) {
                        animateCardEntry(node);
                    }
                });
            });
        });
        
        observer.observe(list, { childList: true });
    });
}

/**
 * Anima a entrada de um card
 */
function animateCardEntry(card) {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    
    requestAnimationFrame(() => {
        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    });
}

/**
 * Configura animações do modal
 */
function setupModalAnimations() {
    // Removido monkey patch de classList para evitar conflitos e manter compatibilidade com usos padrões
    // de classList.add/remove em outros módulos.
}

/**
 * Anima abertura do modal
 */
function animateModalOpen(modalContent) {
    modalContent.style.transform = 'translateY(-20px) scale(0.95)';
    modalContent.style.opacity = '0';
    
    requestAnimationFrame(() => {
        modalContent.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        modalContent.style.transform = 'translateY(0) scale(1)';
        modalContent.style.opacity = '1';
    });
}

/**
 * Anima fechamento do modal
 */
function animateModalClose(modalContent, callback) {
    modalContent.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    modalContent.style.transform = 'translateY(-10px) scale(0.98)';
    modalContent.style.opacity = '0';
    
    setTimeout(callback, 200);
}

/**
 * Adiciona efeitos de hover melhorados
 */
export function enhanceHoverEffects() {
    // Efeito de hover nos cards
    document.addEventListener('mouseover', (e) => {
        const card = e.target.closest('.scheduled-game-card');
        if (card) {
            card.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
        }
    });
    
    // Efeito de hover nos botões
    document.addEventListener('mouseover', (e) => {
        const button = e.target.closest('.card-action-button, .floating-add-btn, .schedule-btn');
        if (button) {
            button.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
        }
    });
}

/**
 * Configura animações de loading
 */
export function setupLoadingAnimations() {
    const gamesList = document.querySelectorAll('.games-list');
    
    gamesList.forEach(list => {
        // Adiciona skeleton loading quando lista está vazia
        if (list.children.length === 0) {
            showSkeletonLoading(list);
        }
    });
}

/**
 * Mostra skeleton loading
 */
function showSkeletonLoading(container) {
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton-loading';
    skeleton.innerHTML = `
        <div class="skeleton-card">
            <div class="skeleton-line skeleton-title"></div>
            <div class="skeleton-line skeleton-text"></div>
            <div class="skeleton-line skeleton-text short"></div>
        </div>
        <div class="skeleton-card">
            <div class="skeleton-line skeleton-title"></div>
            <div class="skeleton-line skeleton-text"></div>
            <div class="skeleton-line skeleton-text short"></div>
        </div>
    `;
    
    container.appendChild(skeleton);
    
    // Remove skeleton quando dados reais chegam
    const observer = new MutationObserver(() => {
        if (container.querySelector('.scheduled-game-card')) {
            skeleton.remove();
            observer.disconnect();
        }
    });
    
    observer.observe(container, { childList: true });
}

// CSS para skeleton loading (será injetado dinamicamente)
const skeletonCSS = `
.skeleton-loading {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1rem 0;
}

.skeleton-card {
    background: var(--new-bg-secondary);
    border: 1px solid var(--new-border-color);
    border-radius: 12px;
    padding: 1.5rem;
    animation: skeleton-pulse 1.5s ease-in-out infinite alternate;
}

.skeleton-line {
    height: 1rem;
    background: var(--new-bg-tertiary);
    border-radius: 4px;
    margin-bottom: 0.75rem;
    animation: skeleton-shimmer 1.5s ease-in-out infinite alternate;
}

.skeleton-title {
    height: 1.5rem;
    width: 60%;
}

.skeleton-text {
    width: 80%;
}

.skeleton-text.short {
    width: 40%;
}

@keyframes skeleton-pulse {
    0% { opacity: 1; }
    100% { opacity: 0.7; }
}

@keyframes skeleton-shimmer {
    0% { background-color: var(--new-bg-tertiary); }
    100% { background-color: var(--new-border-light); }
}

.ripple {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    transform: scale(0);
    animation: ripple-animation 0.6s linear;
    pointer-events: none;
}

@keyframes ripple-animation {
    to {
        transform: scale(4);
        opacity: 0;
    }
}
`;

// Injeta CSS do skeleton
function injectSkeletonCSS() {
    const style = document.createElement('style');
    style.textContent = skeletonCSS;
    document.head.appendChild(style);
}

// Inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        injectSkeletonCSS();
        initSchedulingAnimations();
        enhanceHoverEffects();
    });
} else {
    injectSkeletonCSS();
    initSchedulingAnimations();
    enhanceHoverEffects();
}