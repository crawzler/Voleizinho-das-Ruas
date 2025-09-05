import { getCurrentUser } from '../firebase/auth.js';

let permissionsCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Função para obter o role do usuário atual
function getCurrentUserRole() {
    const user = getCurrentUser();
    if (!user) return 'user';
    
    // Em desenvolvimento, sempre retorna 'dev'
    return 'dev';
}

// Função para obter permissões do role
function getRolePermissions(role) {
    const saved = localStorage.getItem('rolePermissions');
    let rolePermissions = {};
    
    if (saved) {
        try {
            rolePermissions = JSON.parse(saved);
        } catch (e) {}
    }
    
    // Permissões padrão se não houver salvas
    const defaultPermissions = {
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
    
    return rolePermissions[role] || defaultPermissions[role] || defaultPermissions.user;
}

async function getUserPermissions() {
    const now = Date.now();
    if (permissionsCache && (now - cacheTimestamp) < CACHE_DURATION) {
        return permissionsCache;
    }

    const userRole = getCurrentUserRole();
    permissionsCache = getRolePermissions(userRole);
    cacheTimestamp = now;
    return permissionsCache;
}

export function clearPermissionsCache() {
    permissionsCache = null;
    cacheTimestamp = 0;
}

// Scheduling permissions
export async function canCreateSchedule() {
    const perms = await getUserPermissions();
    return perms.scheduling?.createSchedule || false;
}

export async function canEditSchedule() {
    const perms = await getUserPermissions();
    return perms.scheduling?.editSchedule || false;
}

export async function canCancelSchedule() {
    const perms = await getUserPermissions();
    return perms.scheduling?.cancelSchedule || false;
}

export async function canRedispatchNotification() {
    const perms = await getUserPermissions();
    return perms.scheduling?.redispatchNotification || false;
}

export async function canDeleteSchedule() {
    const perms = await getUserPermissions();
    return perms.scheduling?.deleteSchedule || false;
}

// Users permissions
export async function canViewUsersPage() {
    const perms = await getUserPermissions();
    return perms.users?.viewUsersPage || false;
}

export async function canViewUserIds() {
    const perms = await getUserPermissions();
    return perms.users?.viewUserIds || false;
}

export async function canEditUserRoles() {
    const perms = await getUserPermissions();
    return perms.users?.editUserRoles || false;
}

// Configs permissions
export async function canEditCustomTeams() {
    const perms = await getUserPermissions();
    return perms.configs?.editCustomTeams || false;
}

// Others permissions
export async function canAccessDebug() {
    const perms = await getUserPermissions();
    return perms.others?.debugAccess || false;
}