// Navegação da página de configurações
document.addEventListener('DOMContentLoaded', function() {
    // Função utilitária para query selector seguro
    function safeQuerySelector(selector, parent = document) {
        try {
            return parent.querySelector(selector);
        } catch (e) {
            console.warn(`Erro ao buscar elemento: ${selector}`, e);
            return null;
        }
    }
    const navItems = document.querySelectorAll('.config-nav-item');
    const sections = document.querySelectorAll('.config-section');
    
    // Função para mostrar seção
    function showSection(sectionId) {
        // Remove active de todas as seções
        sections.forEach(section => section.classList.remove('active'));
        navItems.forEach(item => item.classList.remove('active'));
        
        // Ativa a seção selecionada
        const targetSection = document.getElementById(sectionId);
        const targetNavItem = document.querySelector(`[data-section="${sectionId}"]`);
        
        if (targetSection) targetSection.classList.add('active');
        if (targetNavItem) targetNavItem.classList.add('active');
    }
    
    // Event listeners para navegação
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = item.getAttribute('data-section');
            if (sectionId) {
                showSection(sectionId);
            }
        });
    });
    
    // Atualizar preview das cores dos times
    function updateTeamPreview(teamNumber, color) {
        // Validar entrada de cor para prevenir injeção CSS
        if (!isValidColor(color) || !isValidTeamNumber(teamNumber)) {
            return;
        }
        
        const preview = safeQuerySelector(`[data-team="${teamNumber}"] .team-preview`) || 
                       safeQuerySelector(`#team-${teamNumber} .team-preview`);
        if (preview) {
            preview.style.background = color;
        }
    }
    
    // Validar se é uma cor CSS válida
    function isValidColor(color) {
        return /^#[0-9A-Fa-f]{6}$/.test(color);
    }
    
    // Validar se é um número de time válido
    function isValidTeamNumber(teamNumber) {
        return Number.isInteger(teamNumber) && teamNumber >= 1 && teamNumber <= 6;
    }
    
    // Event listeners para inputs de cor
    for (let i = 1; i <= 6; i++) {
        const colorInput = document.getElementById(`custom-team-${i}-color`);
        if (colorInput) {
            colorInput.addEventListener('input', (e) => {
                updateTeamPreview(i, e.target.value);
            });
        }
    }
    
    // Navegação para tela de roles
    const rolesNavButton = document.getElementById('nav-roles');
    if (rolesNavButton) {
        rolesNavButton.addEventListener('click', () => {
            if (window.showPage) {
                window.showPage('roles-page');
            }
        });
    }
});