import { displayMessage } from './messages.js';

let selectedRole = null;

const ROLES = {
    dev: { title: 'Desenvolvedor', color: 'linear-gradient(135deg, #FF6B6B, #FF8E53)', icon: 'code' },
    admin: { title: 'Administrador', color: 'linear-gradient(135deg, #E74C3C, #8E44AD)', icon: 'admin_panel_settings' },
    mod: { title: 'Moderador', color: 'linear-gradient(135deg, #F39C12, #E67E22)', icon: 'shield' },
    user: { title: 'Usuário', color: 'linear-gradient(135deg, #6C5CE7, #A29BFE)', icon: 'person' }
};

const PERMISSIONS = {
    scheduling: {
        title: 'Scheduling',
        icon: 'calendar_month',
        permissions: {
            createSchedule: {
                label: 'Criar agendamentos',
                description: 'Permite criar novos jogos agendados'
            },
            editSchedule: {
                label: 'Editar agendamentos',
                description: 'Permite modificar jogos já agendados'
            },
            cancelSchedule: {
                label: 'Cancelar agendamentos',
                description: 'Permite cancelar jogos com motivo'
            },
            redispatchNotification: {
                label: 'Redisparar notificação',
                description: 'Permite reenviar notificações de jogos'
            },
            deleteSchedule: {
                label: 'Excluir agendamento',
                description: 'Permite remover permanentemente jogos'
            }
        }
    },
    users: {
        title: 'Users',
        icon: 'people',
        permissions: {
            viewUsersPage: {
                label: 'Ver tela de usuários',
                description: 'Acesso à página de gerenciamento de usuários'
            },
            viewUserIds: {
                label: 'Ver ID dos outros usuários',
                description: 'Visualizar IDs completos de outros usuários'
            },
            editUserRoles: {
                label: 'Editar roles de usuários',
                description: 'Modificar permissões de outros usuários'
            }
        }
    },
    configs: {
        title: 'Configs',
        icon: 'settings',
        permissions: {
            editCustomTeams: {
                label: 'Editar Times personalizados',
                description: 'Modificar nomes e cores dos times'
            }
        }
    },
    others: {
        title: 'Outros',
        icon: 'bug_report',
        permissions: {
            debugAccess: {
                label: 'Acesso ao módulo de debug',
                description: 'Ferramentas avançadas de desenvolvimento'
            }
        }
    }
};

// Permissões padrão por role
const DEFAULT_ROLE_PERMISSIONS = {
    dev: {
        scheduling: { createSchedule: true, editSchedule: true, cancelSchedule: true, redispatchNotification: true, deleteSchedule: true },
        users: { viewUsersPage: true, viewUserIds: true, editUserRoles: true },
        configs: { editCustomTeams: true },
        others: { debugAccess: true }
    },
    admin: {
        scheduling: { createSchedule: true, editSchedule: true, cancelSchedule: true, redispatchNotification: true, deleteSchedule: true },
        users: { viewUsersPage: true, viewUserIds: false, editUserRoles: false },
        configs: { editCustomTeams: true },
        others: { debugAccess: false }
    },
    mod: {
        scheduling: { createSchedule: true, editSchedule: true, cancelSchedule: false, redispatchNotification: false, deleteSchedule: false },
        users: { viewUsersPage: false, viewUserIds: false, editUserRoles: false },
        configs: { editCustomTeams: false },
        others: { debugAccess: false }
    },
    user: {
        scheduling: { createSchedule: false, editSchedule: false, cancelSchedule: false, redispatchNotification: false, deleteSchedule: false },
        users: { viewUsersPage: false, viewUserIds: false, editUserRoles: false },
        configs: { editCustomTeams: false },
        others: { debugAccess: false }
    }
};

export async function setupRolesPage() {
    showRolesNavigation();
    loadRolePermissions();
    renderRolesList();
}

function showRolesNavigation() {
    const navButton = document.getElementById('nav-roles');
    if (navButton) {
        navButton.style.display = 'flex';
        navButton.style.visibility = 'visible';
    }
}

function loadRolePermissions() {
    const saved = localStorage.getItem('rolePermissions');
    if (saved) {
        try {
            const savedPermissions = JSON.parse(saved);
            Object.assign(DEFAULT_ROLE_PERMISSIONS, savedPermissions);
        } catch (e) {}
    }
}

function renderRolesList() {
    const dropdown = document.getElementById('role-dropdown');
    const optionsContainer = document.getElementById('dropdown-options');
    const selectedElement = document.getElementById('dropdown-selected');
    
    if (!dropdown || !optionsContainer || !selectedElement) return;
    
    // Limpa opções existentes
    optionsContainer.innerHTML = '';
    
    // Adiciona opções dos roles
    Object.entries(ROLES).forEach(([roleKey, role]) => {
        const option = document.createElement('div');
        option.className = 'dropdown-option';
        option.dataset.value = roleKey;
        option.innerHTML = `
            <div class="role-icon" style="background: ${role.color}">
                <span class="material-icons">${role.icon}</span>
            </div>
            <span class="role-name">${role.title}</span>
        `;
        
        option.addEventListener('click', () => {
            selectRoleFromDropdown(roleKey, role.title, role.color);
        });
        
        optionsContainer.appendChild(option);
    });
    
    // Event listener para abrir/fechar dropdown
    selectedElement.addEventListener('click', () => {
        const isActive = selectedElement.classList.contains('active');
        if (isActive) {
            closeDropdown();
        } else {
            openDropdown();
        }
    });
    
    // Fechar dropdown ao clicar fora
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
            closeDropdown();
        }
    });
}

function openDropdown() {
    const selectedElement = document.getElementById('dropdown-selected');
    const optionsContainer = document.getElementById('dropdown-options');
    
    selectedElement.classList.add('active');
    optionsContainer.classList.add('show');
}

function closeDropdown() {
    const selectedElement = document.getElementById('dropdown-selected');
    const optionsContainer = document.getElementById('dropdown-options');
    
    selectedElement.classList.remove('active');
    optionsContainer.classList.remove('show');
}

function selectRoleFromDropdown(roleKey, roleTitle, roleColor) {
    const selectedText = document.querySelector('.selected-text');
    
    // Atualiza o texto selecionado com ícone
    const roleData = Object.values(ROLES).find(r => r.title === roleTitle);
    const roleIcon = roleData ? roleData.icon : 'admin_panel_settings';
    
    selectedText.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <div class="role-icon" style="background: ${roleColor}; width: 28px; height: 28px; font-size: 16px;">
                <span class="material-icons">${roleIcon}</span>
            </div>
            <span>${roleTitle}</span>
        </div>
    `;
    
    closeDropdown();
    selectRoleHandler(roleKey);
}

function selectRoleHandler(roleKey) {
    if (!roleKey) return;
    
    selectedRole = roleKey;
    renderPermissionsPanel(roleKey);
}

function renderPermissionsPanel(roleKey) {
    const container = document.getElementById('permissions-content');
    if (!container) return;
    
    const role = ROLES[roleKey];
    const rolePermissions = DEFAULT_ROLE_PERMISSIONS[roleKey] || {};
    
    container.innerHTML = `
        ${Object.entries(PERMISSIONS).map(([categoryKey, category]) => `
            <div class="permission-category">
                <h3 class="category-title">
                    <span class="material-icons">${category.icon}</span>
                    ${category.title}
                </h3>
                ${Object.entries(category.permissions).map(([permKey, permData]) => `
                    <div class="permission-item">
                        <div class="permission-info">
                            <h4 class="permission-label">${permData.label}</h4>
                            <p class="permission-description">${permData.description}</p>
                        </div>
                        <label class="modern-switch">
                            <input type="checkbox" 
                                   data-category="${categoryKey}" 
                                   data-permission="${permKey}"
                                   ${rolePermissions[categoryKey]?.[permKey] ? 'checked' : ''}>
                            <span class="switch-slider"></span>
                        </label>
                    </div>
                `).join('')}
            </div>
        `).join('')}
        <button class="save-permissions-btn" onclick="saveRolePermissions()">
            Salvar Permissões
        </button>
    `;
    
    // Implementar scroll manual para página de roles
    const rolesPage = document.getElementById('roles-page');
    if (rolesPage) {
        let startY = 0;
        let currentY = 0;
        let isScrolling = false;
        
        rolesPage.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
            currentY = rolesPage.scrollTop;
            isScrolling = true;
        }, { passive: true });
        
        rolesPage.addEventListener('touchmove', (e) => {
            if (!isScrolling) return;
            
            const touchY = e.touches[0].clientY;
            const deltaY = startY - touchY;
            const newScrollTop = currentY + deltaY;
            
            rolesPage.scrollTop = Math.max(0, Math.min(newScrollTop, rolesPage.scrollHeight - rolesPage.clientHeight));
        }, { passive: true });
        
        rolesPage.addEventListener('touchend', () => {
            isScrolling = false;
        }, { passive: true });
    }
}

window.saveRolePermissions = function() {
    if (!selectedRole) return;
    
    const checkboxes = document.querySelectorAll('#permissions-content input[type="checkbox"]');
    const permissions = {};
    
    checkboxes.forEach(checkbox => {
        const category = checkbox.dataset.category;
        const permission = checkbox.dataset.permission;
        
        if (!permissions[category]) {
            permissions[category] = {};
        }
        
        permissions[category][permission] = checkbox.checked;
    });
    
    DEFAULT_ROLE_PERMISSIONS[selectedRole] = permissions;
    localStorage.setItem('rolePermissions', JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
    
    displayMessage(`Permissões do role ${ROLES[selectedRole].title} salvas!`, 'success');
};

export function updateRolesVisibility() {
    setupRolesPage();
}

export function getRolePermissions(role) {
    return DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.user;
}