// Navegação da página de configurações
document.addEventListener('DOMContentLoaded', function() {
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
            showSection(sectionId);
        });
    });
    
    // Atualizar preview das cores dos times
    function updateTeamPreview(teamNumber, color) {
        const preview = document.querySelector(`#teams .team-card:nth-child(${teamNumber}) .team-preview`);
        if (preview) {
            preview.style.background = color;
        }
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
});