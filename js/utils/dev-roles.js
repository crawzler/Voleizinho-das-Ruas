// Utilitário para definir roles durante desenvolvimento
import { getCurrentUser } from '../firebase/auth.js';
import { setUserRole, USER_ROLES } from '../ui/users.js';

// Função para definir role do usuário atual
export async function setCurrentUserRole(role) {
    const user = getCurrentUser();
    if (!user) {
        console.error('Nenhum usuário logado');
        return false;
    }
    
    try {
        await setUserRole(user.uid, role);
        console.log(`Role ${role} definida para o usuário atual:`, user.uid);
        
        // Limpa cache de permissões para forçar atualização
        const { clearPermissionsCache } = await import('./permissions.js');
        clearPermissionsCache();
        
        return true;
    } catch (error) {
        console.error('Erro ao definir role:', error);
        return false;
    }
}

// Funções de conveniência
export const setAsAdmin = () => setCurrentUserRole(USER_ROLES.ADMIN);
export const setAsDev = () => setCurrentUserRole(USER_ROLES.DEV);
export const setAsMod = () => setCurrentUserRole(USER_ROLES.MODERATOR);
export const setAsUser = () => setCurrentUserRole(USER_ROLES.USER);

// Expor globalmente para uso no console
if (typeof window !== 'undefined') {
    window.setCurrentUserRole = setCurrentUserRole;
    window.setAsAdmin = setAsAdmin;
    window.setAsDev = setAsDev;
    window.setAsMod = setAsMod;
    window.setAsUser = setAsUser;
}