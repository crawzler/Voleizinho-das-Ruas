// js/ui/users.js
// Interface para gerenciamento de usuários autenticados

import { getCurrentUser } from '../firebase/auth.js';

// Sistema de roles/tags para usuários
export const USER_ROLES = {
    DEV: 'dev',
    ADMIN: 'admin', 
    MODERATOR: 'moderator',
    USER: 'user'
};

export const ROLE_CONFIG = {
    [USER_ROLES.DEV]: {
        name: 'Dev',
        shortName: 'Dev',
        color: '#FF6B6B',
        icon: 'code',
        gradient: 'linear-gradient(135deg, #FF6B6B, #FF8E53)'
    },
    [USER_ROLES.ADMIN]: {
        name: 'Admin',
        shortName: 'Admin',
        color: '#E74C3C',
        icon: 'admin_panel_settings',
        gradient: 'linear-gradient(135deg, #E74C3C, #8E44AD)'
    },
    [USER_ROLES.MODERATOR]: {
        name: 'Moderador',
        shortName: 'Mod',
        color: '#F39C12',
        icon: 'shield',
        gradient: 'linear-gradient(135deg, #F39C12, #E67E22)'
    },
    [USER_ROLES.USER]: {
        name: 'Usuário',
        shortName: 'User',
        color: '#6C5CE7',
        icon: 'person',
        gradient: 'linear-gradient(135deg, #6C5CE7, #A29BFE)'
    }
};

// UIDs específicos por role
export const ROLE_UIDS = {
    [USER_ROLES.DEV]: [
        "fVTPCFEN5KSKt4me7FgPyNtXHMx1",
        "Q7cjHJcQoMV9J8IEaxnFFbWNXw22"
    ],
    [USER_ROLES.ADMIN]: [],
    [USER_ROLES.MODERATOR]: []
};

// Cache local para roles
const roleCache = new Map();

/**
 * Obtém o role de um usuário baseado no UID
 */
export async function getUserRole(uid) {
    if (!uid) return USER_ROLES.USER;
    
    // Verifica cache primeiro
    if (roleCache.has(uid)) {
        return roleCache.get(uid);
    }
    
    // Tenta buscar no Firebase
    try {
        const { initFirebaseApp } = await import('../firebase/config.js');
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        
        const { db } = await initFirebaseApp();
        const appId = localStorage.getItem('appId') || 'default';
        const roleDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'userRoles', uid));
        
        if (roleDoc.exists()) {
            const role = roleDoc.data().role;
            roleCache.set(uid, role);
            return role;
        }
    } catch (error) {
        console.error('Erro ao buscar role no Firebase:', error);
    }
    
    // Fallback para verificação local
    for (const [role, uids] of Object.entries(ROLE_UIDS)) {
        if (uids.includes(uid)) {
            roleCache.set(uid, role);
            return role;
        }
    }
    
    roleCache.set(uid, USER_ROLES.USER);
    return USER_ROLES.USER;
}

/**
 * Define o role de um usuário
 */
export async function setUserRole(uid, newRole) {
    if (!uid || !USER_ROLES[newRole.toUpperCase()]) return;
    
    // Atualiza cache
    roleCache.set(uid, newRole);
    
    // Salva no Firebase
    try {
        const { initFirebaseApp } = await import('../firebase/config.js');
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        
        const { db } = await initFirebaseApp();
        const appId = localStorage.getItem('appId') || 'default';
        
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'userRoles', uid), {
            role: newRole,
            updatedAt: new Date().toISOString()
        });
        
        console.log('Role salva no Firebase:', uid, newRole);
    } catch (error) {
        console.error('Erro ao salvar role no Firebase:', error);
        // Remove do cache se falhou
        roleCache.delete(uid);
        throw error;
    }
}

/**
 * Verifica se o usuário tem permissão específica
 */
export async function hasPermission(uid, requiredRole) {
    const userRole = await getUserRole(uid);
    const hierarchy = [USER_ROLES.USER, USER_ROLES.MODERATOR, USER_ROLES.ADMIN, USER_ROLES.DEV];
    
    const userLevel = hierarchy.indexOf(userRole);
    const requiredLevel = hierarchy.indexOf(requiredRole);
    
    return userLevel >= requiredLevel;
}

/**
 * Cria um badge de role para um usuário
 */
export async function createRoleBadge(uid, useShortName = true) {
    if (!uid || uid.startsWith('manual_')) return '';
    
    const userRole = await getUserRole(uid);
    if (userRole === USER_ROLES.USER) return '';
    
    const roleConfig = ROLE_CONFIG[userRole];
    const displayName = useShortName ? (roleConfig.shortName || roleConfig.name) : roleConfig.name;
    
    return `<div class="role-badge" style="background: ${roleConfig.gradient}; position: relative; top: 0; right: 0; margin-left: 8px; display: inline-flex; font-size: 0.65rem; padding: 0.2rem 0.4rem;">
        <span class="material-icons" style="font-size: 0.8rem;">${roleConfig.icon}</span>
        ${displayName}
    </div>`;
}

/**
 * Renderiza a lista de usuários autenticados em formato de cards
 */
export async function renderUsersCards(players) {
    const usersGrid = document.getElementById('users-grid');
    if (!usersGrid) return;

    // Filtra apenas jogadores autenticados (não manuais e não anônimos)
    const authenticatedUsers = players.filter(player => 
        !player.isManual && 
        player.uid && 
        !player.uid.startsWith('manual_') &&
        player.photoURL
    );

    usersGrid.innerHTML = '';

    if (authenticatedUsers.length === 0) {
        usersGrid.innerHTML = `
            <div class="empty-users">
                <span class="material-icons">admin_panel_settings</span>
                <h3>Nenhum usuário autenticado encontrado</h3>
                <p>Os usuários que fizerem login com conta Google aparecerão aqui para gerenciamento.</p>
            </div>
        `;
        return;
    }

    authenticatedUsers.sort((a, b) => a.name.localeCompare(b.name));

    for (let i = 0; i < authenticatedUsers.length; i++) {
        const card = await createUserCard(authenticatedUsers[i], i);
        usersGrid.appendChild(card);
    }
}

/**
 * Cria um card individual para um usuário
 */
async function createUserCard(player, index) {
    const card = document.createElement('div');
    card.className = 'user-card';
    card.style.animationDelay = `${(index + 1) * 0.1}s`;

    const currentUser = getCurrentUser();
    const isCurrentUser = currentUser && currentUser.uid === player.uid;
    const isOnline = isCurrentUser && !currentUser.isAnonymous;

    const email = extractEmailFromPlayer(player);
    const joinDate = formatJoinDate(player.createdAt);
    
    const userRole = await getUserRole(player.uid);
    const roleConfig = ROLE_CONFIG[userRole];
    const currentUserRole = getCurrentUser() ? await getUserRole(getCurrentUser().uid) : USER_ROLES.USER;
    const canEditRoles = currentUserRole === USER_ROLES.DEV && userRole !== USER_ROLES.DEV;

    card.innerHTML = `
        <div class="role-badge" style="background: ${roleConfig.gradient}">
            <span class="material-icons">${roleConfig.icon}</span>
            ${roleConfig.name}
        </div>
        
        <div class="user-header">
            <img src="${player.photoURL || 'assets/default-user-icon.svg'}" 
                 alt="Foto de ${player.name}" 
                 class="user-avatar"
                 onerror="this.src='assets/default-user-icon.svg'">
            <div class="user-info">
                <h3 class="user-name">${player.name}</h3>
                ${email ? `<p class="user-email">${email}</p>` : ''}
            </div>
        </div>

        <div class="user-details">
            ${joinDate ? `
                <div class="user-detail">
                    <span class="material-icons">event</span>
                    <span>Entrou em ${joinDate}</span>
                </div>
            ` : ''}
            
            <div class="user-detail">
                <span class="material-icons">fingerprint</span>
                <span>ID: ${player.uid.substring(0, 8)}...</span>
            </div>
            
            ${isCurrentUser ? `
                <div class="user-detail">
                    <span class="material-icons">person</span>
                    <span>Você</span>
                </div>
            ` : ''}
        </div>

        <div class="user-status">
            <div class="status-indicator ${isOnline ? 'online' : 'offline'}"></div>
            <span class="status-text">${isOnline ? 'Online' : 'Offline'}</span>
        </div>
        
        ${canEditRoles && !isCurrentUser ? `
            <button class="edit-role-icon" onclick="editUserRole('${player.uid}', '${player.name}')">
                <span class="material-icons">edit</span>
            </button>
        ` : ''}
    `;

    return card;
}

function extractEmailFromPlayer(player) {
    return player.email || null;
}

function formatJoinDate(createdAt) {
    if (!createdAt) return null;
    
    try {
        const date = new Date(createdAt);
        return date.toLocaleDateString('pt-BR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (e) {
        return null;
    }
}

/**
 * Inicializa a página de usuários
 */
export function initializeUsersPage() {
    let players = [];
    try {
        const stored = localStorage.getItem('volleyballPlayers');
        if (stored) {
            players = JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Erro ao carregar jogadores:', e);
        players = [];
    }

    renderUsersCards(players);
}

/**
 * Atualiza a página de usuários quando há mudanças nos dados
 */
export function updateUsersPage(players) {
    const usersPage = document.getElementById('users-page');
    if (usersPage && usersPage.classList.contains('app-page--active')) {
        renderUsersCards(players);
    }
}

/**
 * Função global para editar role do usuário
 */
window.editUserRole = async function(uid, userName) {
    const currentRole = await getUserRole(uid);
    
    // Remove DEV das opções disponíveis
    const availableRoles = Object.values(USER_ROLES).filter(role => role !== USER_ROLES.DEV);
    
    const roleCards = availableRoles.map(role => {
        const config = ROLE_CONFIG[role];
        const isSelected = role === currentRole;
        return `
            <div class="role-option-card ${isSelected ? 'selected' : ''}" onclick="selectRole('${role}', this)">
                <div class="role-option-badge" style="background: ${config.gradient}">
                    <span class="material-icons">${config.icon}</span>
                </div>
                <div class="role-option-info">
                    <h4>${config.name}</h4>
                    <div class="role-option-check">
                        <span class="material-icons">${isSelected ? 'radio_button_checked' : 'radio_button_unchecked'}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    const modal = document.createElement('div');
    modal.className = 'role-edit-modal';
    modal.dataset.uid = uid;
    modal.innerHTML = `
        <div class="role-edit-content">
            <div class="role-edit-header">
                <h3>Definir Role</h3>
                <p>${userName}</p>
            </div>
            <div class="role-options-grid">
                ${roleCards}
            </div>
        </div>
    `;
    
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    document.body.appendChild(modal);
};

window.selectRole = async function(role, element) {
    const uid = element.closest('.role-edit-modal').dataset.uid;
    
    console.log('Definindo role:', uid, role);
    try {
        await setUserRole(uid, role);
        document.querySelector('.role-edit-modal').remove();
        initializeUsersPage();
    } catch (error) {
        alert('Erro ao salvar role. Verifique suas permissões.');
    }
};