// js/ui/profile-menu.js
// Gerencia o menu do perfil do usuário

import { getCurrentUser } from '../firebase/auth.js';
import { getFirestoreDb, getAppId } from '../firebase/config.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import { displayMessage } from './messages.js';

// Função para alterar foto do perfil
window.changeProfilePhoto = async function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const photoURL = event.target.result;
                await updateUserPhoto(photoURL);
            };
            reader.readAsDataURL(file);
        }
    };
    input.click();
};

async function updateUserPhoto(photoURL) {
    try {
        const user = getCurrentUser();
        if (!user || user.isAnonymous) return;
        
        const db = getFirestoreDb();
        const appId = getAppId();
        
        if (db && appId) {
            const playerDocRef = doc(db, `artifacts/${appId}/public/data/players`, user.uid);
            await updateDoc(playerDocRef, { photoURL });
            
            // Atualiza foto no menu
            const profilePicture = document.getElementById('user-profile-picture');
            if (profilePicture) profilePicture.src = photoURL;
            
            displayMessage('Foto atualizada com sucesso!', 'success');
        }
    } catch (error) {
        // Log removido
        displayMessage('Erro ao atualizar foto', 'error');
    }
}
