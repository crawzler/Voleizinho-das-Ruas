// js/ui/players-ui.js
// Lógica de interface para a lista de jogadores.

import * as Elements from './elements.js';
import { updatePlayerModificationAbility } from './pages.js'; // Importa a função de pages.js
import { getCurrentUser } from '../firebase/auth.js'; // Importa para verificar o estado de autenticação

/**
 * Renderiza a lista de jogadores na UI.
 * @param {Array<Object>} players - A lista de jogadores a ser renderizada.
 */
export function renderPlayersList(players) {
    if (!Elements.playersListContainer()) return; // Chamada da função

    Elements.playersListContainer().innerHTML = ''; // Chamada da função

    players.forEach((player) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-list-item';
        playerDiv.innerHTML = `
            <div class="player-info">
                <label class="switch">
                    <input type="checkbox" checked="checked" class="player-checkbox" data-player-id="${player.id}">
                    <span class="slider round"></span>
                </label>
                <span class="player-name-display">${player.name}</span>
            </div>
            <button class="remove-button" data-player-id="${player.id}">
                <span class="material-icons">delete</span>
            </button>
        `;
        Elements.playersListContainer().appendChild(playerDiv); // Chamada da função
    });
    updatePlayerCount();
    updateSelectAllToggle();

    // CORREÇÃO: Sempre exibe os elementos de modificação para fins de UX.
    // A segurança para adicionar/remover do Firestore é garantida pelas regras do Firebase
    // e pela lógica de verificação em addPlayer/removePlayer.
    updatePlayerModificationAbility(true);
}

/**
 * Atualiza a contagem de jogadores selecionados/total.
 */
export function updatePlayerCount() {
    if (!Elements.playerCountSpan()) return; // Chamada da função
    const checkboxes = document.querySelectorAll('#players-list-container .player-checkbox');
    const selectedPlayers = Array.from(checkboxes).filter(checkbox => checkbox.checked).length;
    Elements.playerCountSpan().textContent = `${selectedPlayers}/${checkboxes.length}`; // Chamada da função
}

/**
 * Atualiza o estado do toggle "Selecionar Todos".
 */
export function updateSelectAllToggle() {
    if (!Elements.selectAllPlayersToggle()) return; // Chamada da função
    const checkboxes = document.querySelectorAll('#players-list-container .player-checkbox');
    const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
    Elements.selectAllPlayersToggle().checked = allChecked; // Chamada da função
}
