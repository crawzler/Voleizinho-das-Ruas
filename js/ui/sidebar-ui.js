// Sidebar UI - Funcionalidades modernas

export function setupSidebar() {
    const menuButton = document.getElementById('menu-button');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const navItems = document.querySelectorAll('.sidebar-nav-item');
    const profileHeader = document.getElementById('user-profile-header');
    const profileMenu = document.getElementById('profile-menu');
    
    // Variáveis para swipe
    let startX = 0;
    let currentX = 0;
    let isDragging = false;

    // Toggle do sidebar
    if (menuButton && sidebar && overlay) {
        menuButton.addEventListener('click', () => {


            const isOpen = sidebar.classList.contains('open');
            
            if (isOpen) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });

        // Fechar ao clicar no overlay
        overlay.addEventListener('click', closeSidebar);
    }

    // Navegação dos itens
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active de todos
            navItems.forEach(nav => nav.classList.remove('active'));
            // Adiciona active no clicado
            item.classList.add('active');
            
            // Fecha sidebar em mobile após navegação
            if (window.innerWidth < 768) {
                setTimeout(closeSidebar, 150);
            }
        });
    });

    // Menu do perfil
    if (profileHeader && profileMenu) {
        profileHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            profileMenu.classList.toggle('show');
        });

        // Fechar menu ao clicar fora
        document.addEventListener('click', (e) => {
            if (!profileHeader.contains(e.target)) {
                profileMenu.classList.remove('show');
            }
        });
    }

    // Fechar sidebar com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('open')) {
            closeSidebar();
        }
    });
    
    // Swipe para fechar sidebar - versão simplificada
    if (sidebar) {
        sidebar.addEventListener('touchstart', (e) => {
            if (!sidebar.classList.contains('open')) return;
            startX = e.touches[0].clientX;
            isDragging = true;
        }, { passive: true });
        
        sidebar.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            currentX = e.touches[0].clientX;
        }, { passive: true });
        
        sidebar.addEventListener('touchend', (e) => {
            if (!isDragging) return;
            
            const deltaX = currentX - startX;
            
            // Se swipe for maior que 50px para direita, fecha o sidebar
            if (deltaX > 50) {
                closeSidebar();
            }
            
            isDragging = false;
            startX = 0;
            currentX = 0;
        }, { passive: true });
    }

    // Responsivo - fechar/ajustar sidebar ao redimensionar
    window.addEventListener('resize', () => {
        updateMenuAvailability();
        // Não fechar automaticamente em nenhum breakpoint; manter sempre sob controle do usuário
    });

    // Avalia disponibilidade do menu no load
    updateMenuAvailability();
}

// Helper: verifica se a tela de pontuação está ativa
function isScoringActiveLocal() {
    const scoringEl = document.getElementById('scoring-page');
    return !!(scoringEl && scoringEl.classList.contains('app-page--active'));
}

// Atualiza disponibilidade do botão/menu: manter sempre habilitado e controlado por clique
function updateMenuAvailability() {
    const menuButton = document.getElementById('menu-button');
    if (menuButton) {
        menuButton.classList.remove('disabled');
        menuButton.removeAttribute('aria-disabled');
        menuButton.style.pointerEvents = 'auto';
        menuButton.style.opacity = '';
    }
}

function openSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const menuButton = document.getElementById('menu-button');
    
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('active');
    if (menuButton) menuButton.classList.add('active');
    
    // Previne scroll do body
    document.body.style.overflow = 'hidden';
    
    // Adiciona classe para indicar sidebar aberto
    document.body.classList.add('sidebar-open');
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const menuButton = document.getElementById('menu-button');
    const profileMenu = document.getElementById('profile-menu');
    
    if (sidebar) {
        sidebar.classList.remove('open');
        sidebar.classList.remove('active');
    }
    if (overlay) overlay.classList.remove('active');
    if (menuButton) menuButton.classList.remove('active');
    
    // Limpa estilos de swipe
    if (sidebar) {
        sidebar.style.transform = '';
        sidebar.style.opacity = '';
    }
    
    // Fecha menu do perfil também
    if (profileMenu) {
        profileMenu.classList.remove('show');
    }
    
    // Restaura scroll do body
    document.body.style.overflow = '';
    
    // Remove classe do sidebar aberto
    document.body.classList.remove('sidebar-open');
}

// Adicionar notificação a um item do menu
export function addNotificationToMenuItem(itemId) {
    const item = document.getElementById(itemId);
    if (item) {
        item.classList.add('has-notification');
    }
}

// Remover notificação de um item do menu
export function removeNotificationFromMenuItem(itemId) {
    const item = document.getElementById(itemId);
    if (item) {
        item.classList.remove('has-notification');
    }
}

// Definir item ativo
export function setActiveMenuItem(itemId) {
    const navItems = document.querySelectorAll('.sidebar-nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    const activeItem = document.getElementById(itemId);
    if (activeItem) {
        activeItem.classList.add('active');
    }
}

// Fechar sidebar quando voltar para login
export function closeSidebarOnLogin() {
    const loginPage = document.getElementById('login-page');
    if (loginPage && loginPage.classList.contains('app-page--active')) {
        closeSidebar();
    }
}

// Observer para detectar mudanças na página ativa
const pageObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            const target = mutation.target;
            if (target.id === 'login-page' && target.classList.contains('app-page--active')) {
                closeSidebar();
            }
        }
    });
});

// Iniciar observação da página de login
const loginPage = document.getElementById('login-page');
if (loginPage) {
    pageObserver.observe(loginPage, { attributes: true, attributeFilter: ['class'] });
}