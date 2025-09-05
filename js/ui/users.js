// js/ui/users.js
// Interface para gerenciamento de usuários autenticados

import { getCurrentUser } from '../firebase/auth.js';
import firestoreRecovery from '../firebase/recovery.js';
import { safeFirestoreRead, safeFirestoreWrite } from '../firebase/wrapper.js';

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

// Cache para status online dos usuários
const onlineStatusCache = new Map();
let presenceListener = null;

/**
 * Verifica se um usuário está online
 */
export async function checkUserOnlineStatus(uid) {
    if (!uid) return false;
    
    // Se é o usuário atual, está online
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.uid === uid && !currentUser.isAnonymous) {
        return true;
    }
    
    // Verifica cache primeiro
    if (onlineStatusCache.has(uid)) {
        const cached = onlineStatusCache.get(uid);
        // Cache válido por 30 segundos
        if (Date.now() - cached.timestamp < 30000) {
            return cached.isOnline;
        }
    }
    
    // Busca status no Firebase com timeout e retry
    try {
        const { initFirebaseApp } = await import('../firebase/config.js');
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        
        const { db } = await initFirebaseApp();
        const appId = localStorage.getItem('appId') || 'default';
        
        const presenceDoc = await safeFirestoreRead(
            () => getDoc(doc(db, 'artifacts', appId, 'presence', uid))
        );
        
        let isOnline = false;
        if (presenceDoc.exists()) {
            const data = presenceDoc.data();
            const lastSeen = new Date(data.lastSeen || 0);
            const now = new Date();
            // Considera online se visto nos últimos 5 minutos
            isOnline = (now - lastSeen) < 300000;
        }
        
        // Atualiza cache
        onlineStatusCache.set(uid, {
            isOnline,
            timestamp: Date.now()
        });
        
        return isOnline;
    } catch (error) {
        // Em caso de erro, assume offline e usa cache se disponível
        if (onlineStatusCache.has(uid)) {
            return onlineStatusCache.get(uid).isOnline;
        }
        return false;
    }
}

/**
 * Atualiza presença do usuário atual
 */
export async function updateUserPresence() {
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.isAnonymous) return;
    
    try {
        const { initFirebaseApp } = await import('../firebase/config.js');
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        
        const { db } = await initFirebaseApp();
        const appId = localStorage.getItem('appId') || 'default';
        
        await safeFirestoreWrite(
            () => setDoc(doc(db, 'artifacts', appId, 'presence', currentUser.uid), {
                lastSeen: new Date().toISOString(),
                isOnline: true
            })
        );
    } catch (error) {
        // Silencioso - não loga para evitar spam
    }
}

/**
 * Inicia o sistema de presença
 */
export function startPresenceSystem() {
    // Atualiza presença a cada 2 minutos
    if (presenceListener) clearInterval(presenceListener);
    
    updateUserPresence();
    presenceListener = setInterval(updateUserPresence, 120000);
    
    // Atualiza ao sair da página
    window.addEventListener('beforeunload', () => {
        const currentUser = getCurrentUser();
        if (currentUser && !currentUser.isAnonymous) {
            navigator.sendBeacon('/api/offline', JSON.stringify({ uid: currentUser.uid }));
        }
    });
}

/**
 * Obtém o role de um usuário baseado no UID
 */
export async function getUserRole(uid) {
    if (!uid) return USER_ROLES.USER;
    
    // Verifica cache primeiro
    if (roleCache.has(uid)) {
        return roleCache.get(uid);
    }
    
    // Fallback para verificação local primeiro (mais rápido)
    for (const [role, uids] of Object.entries(ROLE_UIDS)) {
        if (uids.includes(uid)) {
            roleCache.set(uid, role);
            return role;
        }
    }
    
    // Tenta buscar no Firebase com timeout
    try {
        const { initFirebaseApp } = await import('../firebase/config.js');
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        
        const { db } = await initFirebaseApp();
        const appId = localStorage.getItem('appId') || 'default';
        
        const roleDoc = await safeFirestoreRead(
            () => getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'userRoles', uid))
        );
        
        if (roleDoc.exists()) {
            const role = roleDoc.data().role;
            roleCache.set(uid, role);
            return role;
        }
    } catch (error) {
        // Silencioso - não loga erro para evitar spam no console
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
    
    // Salva no Firebase com timeout e retry
    try {
        const { initFirebaseApp } = await import('../firebase/config.js');
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
        
        const { db } = await initFirebaseApp();
        const appId = localStorage.getItem('appId') || 'default';
        
        await safeFirestoreWrite(
            () => setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'userRoles', uid), {
                role: newRole,
                updatedAt: new Date().toISOString()
            })
        );
        
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

    // Mostra loading enquanto carrega roles
    usersGrid.innerHTML = `
        <div class="loading-users">
            <span class="material-icons">hourglass_empty</span>
            <p>Carregando usuários...</p>
        </div>
    `;

    try {
        // Ordena por importância das roles e depois por nome com timeout
        const usersWithRoles = await Promise.allSettled(
            authenticatedUsers.map(async (user) => {
                try {
                    const role = await getUserRole(user.uid);
                    return { ...user, role };
                } catch (e) {
                    // Em caso de erro, usa role padrão
                    return { ...user, role: USER_ROLES.USER };
                }
            })
        );
        
        // Filtra apenas resultados bem-sucedidos
        const validUsers = usersWithRoles
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value);
        
        const roleOrder = [USER_ROLES.DEV, USER_ROLES.ADMIN, USER_ROLES.MODERATOR, USER_ROLES.USER];
        validUsers.sort((a, b) => {
            const aIndex = roleOrder.indexOf(a.role);
            const bIndex = roleOrder.indexOf(b.role);
            if (aIndex !== bIndex) return aIndex - bIndex;
            return a.name.localeCompare(b.name);
        });

        // Limpa loading
        usersGrid.innerHTML = '';

        // Renderiza cards com delay para melhor UX
        for (let i = 0; i < validUsers.length; i++) {
            try {
                const card = await createUserCard(validUsers[i], i);
                usersGrid.appendChild(card);
                
                // Pequeno delay entre cards para evitar travamento
                if (i < validUsers.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } catch (e) {
                console.warn('Erro ao criar card do usuário:', validUsers[i].name, e);
            }
        }
    } catch (error) {
        console.error('Erro ao renderizar usuários:', error);
        usersGrid.innerHTML = `
            <div class="error-users">
                <span class="material-icons">error_outline</span>
                <h3>Erro ao carregar usuários</h3>
                <p>Tente recarregar a página ou verifique sua conexão.</p>
            </div>
        `;
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
    const isOnline = await checkUserOnlineStatus(player.uid);

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
                <span>ID: ${await getDisplayableUserId(player.uid, currentUser)}</span>
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

    // Configura listener para recuperação de conexão
    firestoreRecovery.addListener((event) => {
        const usersGrid = document.getElementById('users-grid');
        if (!usersGrid) return;
        
        switch (event) {
            case 'recovery-start':
                usersGrid.innerHTML = `
                    <div class="loading-users">
                        <span class="material-icons">sync</span>
                        <p>Reconectando...</p>
                    </div>
                `;
                break;
            case 'recovery-success':
                // Recarrega a página de usuários
                setTimeout(() => initializeUsersPage(), 1000);
                break;
            case 'recovery-failed':
                usersGrid.innerHTML = `
                    <div class="error-users">
                        <span class="material-icons">wifi_off</span>
                        <h3>Problema de conexão</h3>
                        <p>Tentando reconectar automaticamente...</p>
                    </div>
                `;
                break;
        }
    });

    // Inicializa com delay para evitar conflitos de conexão
    setTimeout(() => {
        try {
            startPresenceSystem();
        } catch (e) {
            console.warn('Erro ao iniciar sistema de presença:', e);
        }
    }, 500);
    
    renderUsersCards(players);
    setupUsersPageGestures();
}

/**
 * Configura gestos de slide para a página de usuários
 */
function setupUsersPageGestures() {
    const usersPage = document.getElementById('users-page');
    if (!usersPage) return;

    let startY = 0;
    let startX = 0;
    let isScrolling = false;

    usersPage.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        startX = e.touches[0].clientX;
        isScrolling = false;
    }, { passive: true });

    usersPage.addEventListener('touchmove', (e) => {
        if (!isScrolling) {
            const currentY = e.touches[0].clientY;
            const currentX = e.touches[0].clientX;
            const deltaY = Math.abs(currentY - startY);
            const deltaX = Math.abs(currentX - startX);
            
            // Se o movimento vertical for maior que o horizontal, é scroll
            if (deltaY > deltaX) {
                isScrolling = true;
            }
        }
    }, { passive: true });

    // Melhora a responsividade do scroll
    usersPage.addEventListener('scroll', () => {
        usersPage.style.scrollBehavior = 'smooth';
    }, { passive: true });
}

/**
 * Atualiza a página de usuários quando há mudanças nos dados
 */
export function updateUsersPage(players) {
    const usersPage = document.getElementById('users-page');
    if (usersPage && usersPage.classList.contains('app-page--active')) {
        // Verifica saúde da conexão antes de atualizar
        firestoreRecovery.checkConnectionHealth().then(isHealthy => {
            if (isHealthy) {
                renderUsersCards(players);
            } else {
                console.warn('Conexão Firestore instável, pulando atualização');
            }
        }).catch(() => {
            // Em caso de erro, ainda tenta renderizar com dados locais
            renderUsersCards(players);
        });
    }
}

/**
 * Determina qual ID mostrar baseado nas permissões do usuário
 */
async function getDisplayableUserId(targetUid, currentUser) {
    if (!currentUser || !targetUid) return 'Oculto';
    
    // Se é o próprio usuário, mostra o ID completo
    if (currentUser.uid === targetUid) {
        return targetUid;
    }
    
    // Se é dev, mostra o ID completo de todos
    const currentUserRole = await getUserRole(currentUser.uid);
    if (currentUserRole === USER_ROLES.DEV) {
        return targetUid;
    }
    
    // Para outros usuários, mostra apenas os primeiros 8 caracteres
    return targetUid.substring(0, 8) + '...';
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