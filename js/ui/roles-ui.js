import { displayMessage } from './messages.js';
import { clearPermissionsCache } from '../utils/permissions.js';

let selectedRole = null;
let documentClickListener = null;

const ROLES = {
    dev: { title: 'Desenvolvedor', color: 'linear-gradient(135deg, #FF6B6B, #FF8E53)', icon: 'code' },
    admin: { title: 'Administrador', color: 'linear-gradient(135deg, #E74C3C, #8E44AD)', icon: 'admin_panel_settings' },
    moderator: { title: 'Moderador', color: 'linear-gradient(135deg, #F39C12, #E67E22)', icon: 'shield' },
    user: { title: 'Usuário', color: 'linear-gradient(135deg, #6C5CE7, #A29BFE)', icon: 'person' },
    anonymous: { title: 'Anônimo', color: 'linear-gradient(135deg, #9CA3AF, #D1D5DB)', icon: 'person_outline' }
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
    players: {
        title: 'Jogadores',
        icon: 'sports_volleyball',
        permissions: {
            create: {
                label: 'Cadastrar jogadores',
                description: 'Permite cadastrar novos jogadores (local ou servidor)'
            },
            createServer: {
                label: 'Cadastrar no servidor',
                description: 'Salva no Firestore (requer "Cadastrar jogadores")'
            },
            delete: {
                label: 'Excluir jogador',
                description: 'Permite excluir jogadores (remotos)'
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
        players: { create: true, createServer: true, delete: true },
        others: { debugAccess: true }
    },
    admin: {
        scheduling: { createSchedule: true, editSchedule: true, cancelSchedule: true, redispatchNotification: true, deleteSchedule: true },
        users: { viewUsersPage: true, viewUserIds: false, editUserRoles: false },
        configs: { editCustomTeams: true },
        players: { create: true, createServer: true, delete: true },
        others: { debugAccess: false }
    },
    moderator: {
        scheduling: { createSchedule: true, editSchedule: true, cancelSchedule: false, redispatchNotification: false, deleteSchedule: false },
        users: { viewUsersPage: false, viewUserIds: false, editUserRoles: false },
        configs: { editCustomTeams: false },
        players: { create: true, createServer: false, delete: false },
        others: { debugAccess: false }
    },
    user: {
        scheduling: { createSchedule: false, editSchedule: false, cancelSchedule: false, redispatchNotification: false, deleteSchedule: false },
        users: { viewUsersPage: false, viewUserIds: false, editUserRoles: false },
        configs: { editCustomTeams: false },
        players: { create: true, createServer: false, delete: false },
        others: { debugAccess: false }
    },
    anonymous: {
        scheduling: { createSchedule: false, editSchedule: false, cancelSchedule: false, redispatchNotification: false, deleteSchedule: false },
        users: { viewUsersPage: false, viewUserIds: false, editUserRoles: false },
        configs: { editCustomTeams: false },
        players: { create: true, createServer: false, delete: false },
        others: { debugAccess: false }
    }
};

export async function setupRolesPage() {
    showRolesNavigation();
    loadRolePermissions();
    renderRolesList();
}

function showRolesNavigation() {
    // A visibilidade é controlada pelo sistema de autenticação
    // Esta função não precisa mais fazer nada
}

async function loadRolePermissions() {
    // Carrega do Firebase primeiro
    try {
        await loadRolePermissionsFromFirebase();
    } catch (e) {
        console.warn('Erro ao carregar permissões do Firebase, usando localStorage');
    }
    
    // Fallback para localStorage
    const saved = localStorage.getItem('rolePermissions');
    if (saved) {
        try {
            const savedPermissions = JSON.parse(saved);
            // Migra chave antiga 'mod' para 'moderator' se necessário
            if (savedPermissions.mod && !savedPermissions.moderator) {
                savedPermissions.moderator = savedPermissions.mod;
                delete savedPermissions.mod;
            }
            // Apenas aplica se não carregou do Firebase
            Object.keys(savedPermissions).forEach(role => {
                if (!DEFAULT_ROLE_PERMISSIONS[role] || Object.keys(DEFAULT_ROLE_PERMISSIONS[role]).length === 0) {
                    DEFAULT_ROLE_PERMISSIONS[role] = savedPermissions[role];
                }
            });
        } catch (e) {}
    }
}

// Função para carregar permissões do Firebase
async function loadRolePermissionsFromFirebase() {
    const { initFirebaseApp } = await import('../firebase/config.js');
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const { safeFirestoreRead } = await import('../firebase/wrapper.js');
    
    const { db } = await initFirebaseApp();
    const appId = localStorage.getItem('appId') || 'default';
    
    const rolePermissionsRef = collection(db, `artifacts/${appId}/public/data/rolePermissions`);
    const snapshot = await safeFirestoreRead(
        () => getDocs(rolePermissionsRef)
    );
    
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.role && data.permissions) {
            DEFAULT_ROLE_PERMISSIONS[data.role] = data.permissions;
        }
    });
}

function renderRolesList() {
    const dropdown = document.getElementById('role-dropdown');
    const optionsContainer = document.getElementById('dropdown-options');
    const selectedElement = document.getElementById('dropdown-selected');
    
    if (!dropdown || !optionsContainer || !selectedElement) return;
    
    // Remove listeners antigos
    selectedElement.replaceWith(selectedElement.cloneNode(true));
    const newSelectedElement = document.getElementById('dropdown-selected');
    
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
    newSelectedElement.addEventListener('click', (e) => {
        e.stopPropagation();
        const isActive = newSelectedElement.classList.contains('active');
        if (isActive) {
            closeDropdown();
        } else {
            openDropdown();
        }
    });
    
    // Remove listener anterior se existir
    if (documentClickListener) {
        document.removeEventListener('click', documentClickListener);
    }
    
    // Fechar dropdown ao clicar fora
    documentClickListener = (e) => {
        if (!dropdown.contains(e.target)) {
            closeDropdown();
        }
    };
    document.addEventListener('click', documentClickListener);
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
    
    // Dependência: players.createServer depende de players.create
    try {
        const createCb = container.querySelector('input[type="checkbox"][data-category="players"][data-permission="create"]');
        const createServerCb = container.querySelector('input[type="checkbox"][data-category="players"][data-permission="createServer"]');
        const updateCreateServerState = () => {
            if (!createCb || !createServerCb) return;
            if (!createCb.checked) {
                createServerCb.checked = false;
                createServerCb.disabled = true;
            } else {
                createServerCb.disabled = false;
            }
        };
        if (createCb && createServerCb) {
            updateCreateServerState();
            createCb.addEventListener('change', updateCreateServerState);
        }
    } catch (_) { /* ignore */ }
}

window.saveRolePermissions = async function() {
    if (!selectedRole) return;

    // Confirmação antes de salvar
    const roleTitle = ROLES[selectedRole]?.title || selectedRole;
    const confirmed = window.confirm(`Deseja salvar as permissões do role \"${roleTitle}\"?`);
    if (!confirmed) {
        displayMessage('Operação cancelada.', 'info');
        return;
    }
    
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

    // Enforce dependency: players.createServer only if players.create is true
    if (permissions.players && permissions.players.create !== true) {
        permissions.players.createServer = false;
    }
    
    try {
        // Salva no Firebase
        await saveRolePermissionsToFirebase(selectedRole, permissions);
        
        // Atualiza localmente
        DEFAULT_ROLE_PERMISSIONS[selectedRole] = permissions;
        localStorage.setItem('rolePermissions', JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
        
        // Limpa o cache de permissões para forçar atualização
        clearPermissionsCache();
        
        // Atualiza visibilidade das abas no sidebar
        if (typeof window.updateAdminTabsVisibility === 'function') {
            setTimeout(() => window.updateAdminTabsVisibility(), 500);
        }
        
        displayMessage(`Permissões do role ${ROLES[selectedRole].title} salvas!`, 'success');
    } catch (error) {
        displayMessage('Erro ao salvar permissões no servidor', 'error');
        console.error('Erro ao salvar permissões:', error);
    }
};

// Função para salvar permissões no Firebase
async function saveRolePermissionsToFirebase(role, permissions) {
    const { initFirebaseApp } = await import('../firebase/config.js');
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
    const { safeFirestoreWrite } = await import('../firebase/wrapper.js');
    
    const { db } = await initFirebaseApp();
    const appId = localStorage.getItem('appId') || 'default';
    
    const rolePermissionsRef = doc(db, `artifacts/${appId}/public/data/rolePermissions`, role);
    await safeFirestoreWrite(
        () => setDoc(rolePermissionsRef, {
            role,
            permissions,
            updatedAt: new Date().toISOString()
        })
    );
}

export function updateRolesVisibility() {
    setupRolesPage();
}

export function getRolePermissions(role) {
    return DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.user;
}

