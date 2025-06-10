// js/ui/players-ui.js
// Lógica de interface para a lista de jogadores.

import * as Elements from './elements.js';
import { updatePlayerModificationAbility } from './pages.js'; // Importa a função de pages.js
import { getCurrentUser } from '../firebase/auth.js';
import { loadConfig } from './config-ui.js';
import { showConfirmationModal } from './pages.js'; // Importa o modal de confirmação

/**
 * Renderiza a lista de jogadores na UI.
 * @param {Array<Object>} players - A lista de jogadores a ser renderizada.
 */
export function renderPlayersList(players) {
    if (!Elements.playersListContainer()) return;

    Elements.playersListContainer().innerHTML = '';

    const user = getCurrentUser();
    const config = loadConfig();
    const isGoogleUser = user && !user.isAnonymous;
    const isAdminKey = config && config.adminKey === "admin998939";
    const canDeleteGlobal = isGoogleUser && isAdminKey;

    players.forEach((player) => {
        const isLocalTag = player.name && /\[local\]/i.test(player.name);
        const canDeleteThis = isLocalTag || canDeleteGlobal;

        let displayName = player.name || '';
        if (isLocalTag) {
            displayName = displayName.replace(/\[local\]/ig, '').trim();
        }

        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-list-item';
        playerDiv.innerHTML = `
            <div class="player-info">
                <label class="switch">
                    <input type="checkbox" checked="checked" class="player-checkbox" data-player-id="${player.id}">
                    <span class="slider round"></span>
                </label>
                <span class="player-name-display">${displayName}${isLocalTag ? ' <span class="local-tag" style="color:#888;font-size:0.85em;">[local]</span>' : ''}</span>
            </div>
            ${canDeleteThis ? `
            <button class="remove-button" data-player-id="${player.id}">
                <span class="material-icons delete-icon">delete</span>
            </button>
            ` : ''}
        `;
        Elements.playersListContainer().appendChild(playerDiv);
    });
    updatePlayerCount();
    updateSelectAllToggle();
    updatePlayerModificationAbility(true);

    // Remove listeners antigos para evitar múltiplos binds
    Elements.playersListContainer().querySelectorAll('.remove-button').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });

    // Adiciona confirmação ao excluir jogador SEM disparar exclusão imediata
    Elements.playersListContainer().querySelectorAll('.remove-button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const playerId = btn.getAttribute('data-player-id');
            showConfirmationModal(
                'Tem certeza que deseja excluir este jogador?',
                () => {
                    // Remove o jogador diretamente aqui, sem simular clique
                    // O handler global do container está em pages.js
                    const event = new CustomEvent('remove-player-confirmed', {
                        bubbles: true,
                        detail: { playerId }
                    });
                    Elements.playersListContainer().dispatchEvent(event);
                }
            );
        });
    });

    // Handler para remoção real após confirmação
    // Este evento será capturado no pages.js, não precisa simular clique no botão!
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
