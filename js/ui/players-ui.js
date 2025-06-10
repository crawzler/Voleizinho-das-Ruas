// js/ui/players-ui.js
// Lógica de interface para a lista de jogadores.

import { getCurrentUser } from '../firebase/auth.js';
import * as Elements from './elements.js';
import { displayMessage } from './messages.js';

let updatePlayerCountCallback = () => {}

/**
 * Renderiza a lista de jogadores na UI.
 * @param {Array<Object>} players - A lista de jogadores a ser renderizada.
 */
export function renderPlayersList(players) {
    const playersListContainer = Elements.playersListContainer();
    if (!playersListContainer) return;

    // Carrega o estado de seleção dos jogadores do localStorage ou usa os selecionados atualmente
    let selectedPlayerIds = [];
    try {
        const savedSelection = localStorage.getItem('selectedPlayers');
        if (savedSelection) {
            selectedPlayerIds = JSON.parse(savedSelection);
        } else {
            // Se não houver seleção salva, usa os selecionados atualmente
            document.querySelectorAll('#players-list-container .player-checkbox:checked').forEach(checkbox => {
                selectedPlayerIds.push(checkbox.dataset.playerId);
            });
        }
    } catch (e) {
        console.warn('Erro ao carregar estado de seleção dos jogadores:', e);
        // Em caso de erro, usa os selecionados atualmente
        document.querySelectorAll('#players-list-container .player-checkbox:checked').forEach(checkbox => {
            selectedPlayerIds.push(checkbox.dataset.playerId);
        });
    }

    // Verifica autenticação e chave admin
    const config = JSON.parse(localStorage.getItem('volleyballConfig') || '{}');

    // Tenta obter o usuário, mas com proteção contra erros de inicialização
    let user = null;
    let canDelete = false;
    try {
        user = getCurrentUser();
        const isAdminKey = config.adminKey === 'admin998939';
        const isGoogleUser = user && !user.isAnonymous;
        canDelete = isAdminKey && isGoogleUser;
    } catch (error) {
        console.warn('Erro ao obter usuário atual:', error);
        // Continue mesmo com erro, tratando como usuário não autenticado
    }

    // Se não houver jogadores, tenta carregar do localStorage
    if (!players || players.length === 0) {
        try {
            const stored = localStorage.getItem('volleyballPlayers');
            if (stored) {
                players = JSON.parse(stored);
                if (!navigator.onLine) {
                    players = players.map(player => ({
                        ...player,
                        name: player.name.includes('[local]') ?
                            player.name :
                            `${player.name} [local]`,
                        isLocal: true
                    }));
                }
            }
        } catch (e) {
            console.warn('Erro ao ler jogadores do localStorage:', e);
            players = [];
        }
    }

    playersListContainer.innerHTML = '';

    if (!players || players.length === 0) {
        playersListContainer.innerHTML = '<p class="empty-list-message">Nenhum jogador cadastrado.</p>';
        return;
    }

    // Ordena os jogadores por nome em ordem alfabética
    players.sort((a, b) => a.name.localeCompare(b.name));
    
    players.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.className = 'player-list-item';
        const isLocal = !navigator.onLine || player.isLocal;
        
        // Verifica se o usuário atual pode excluir este jogador específico
        let showDeleteButton = canDelete; // Admin pode excluir qualquer jogador

        // Se não for admin, verifica se foi o criador deste jogador
        if (!showDeleteButton && user) {
            // Verifica se o jogador foi criado pelo usuário atual
            if (player.createdBy && player.createdBy === user.uid) {
                showDeleteButton = true;
            }
        }
        
        // Verifica se este jogador estava selecionado anteriormente ou é novo
        // Jogadores novos são identificados pela data de criação recente (últimos 5 segundos)
        const isNew = player.createdAt && (new Date() - new Date(player.createdAt) < 5000);
        const isChecked = selectedPlayerIds.includes(player.id) || isNew ? 'checked' : '';
        
        playerElement.innerHTML = `
            <div class="player-info">
                <span data-local="${isLocal}">${player.name}</span>
                <label class="switch">
                    <input type="checkbox" class="player-checkbox" data-player-id="${player.id}" ${isChecked}>
                    <span class="slider round"></span>
                </label>
            </div>
            <button class="remove-button ${showDeleteButton ? 'visible' : ''}" data-player-id="${player.id}">
                <span class="material-icons">delete</span>
            </button>
        `;
        playersListContainer.appendChild(playerElement);
    });
    
    // Adiciona event listeners para os checkboxes
    document.querySelectorAll('#players-list-container .player-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', savePlayerSelectionState);
    });
    
    // Adiciona event listener para o botão "Selecionar Todos"
    const selectAllToggle = Elements.selectAllPlayersToggle();
    if (selectAllToggle) {
        selectAllToggle.addEventListener('change', () => {
            // Marca ou desmarca todos os checkboxes
            const checkboxes = document.querySelectorAll('#players-list-container .player-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = selectAllToggle.checked;
            });
            
            // Salva o estado
            savePlayerSelectionState();
            updatePlayerCount();
        });
    }

    updatePlayerCount();
    updateSelectAllToggle();
}

/**
 * Atualiza a contagem de jogadores selecionados/total.
 */
export function updatePlayerCount() {
    const selectedCount = document.querySelectorAll('#players-list-container .player-checkbox:checked').length;
    const totalCount = document.querySelectorAll('#players-list-container .player-checkbox').length;
    const playerCountDisplay = document.getElementById('player-count');
    if (playerCountDisplay) {
        playerCountDisplay.textContent = `${selectedCount}/${totalCount}`;
    }
}

/**
 * Salva o estado de seleção dos jogadores no localStorage
 */
export function savePlayerSelectionState() {
    try {
        const selectedPlayerIds = [];
        document.querySelectorAll('#players-list-container .player-checkbox:checked').forEach(checkbox => {
            selectedPlayerIds.push(checkbox.dataset.playerId);
        });
        
        localStorage.setItem('selectedPlayers', JSON.stringify(selectedPlayerIds));
    } catch (e) {
        console.warn('Erro ao salvar estado de seleção dos jogadores:', e);
    }
}

/**
 * Atualiza o estado do toggle "Selecionar Todos".
 */
export function updateSelectAllToggle() {
    const selectAllToggle = Elements.selectAllPlayersToggle();
    if (!selectAllToggle) return;

    const checkboxes = document.querySelectorAll('#players-list-container .player-checkbox');
    const checkedBoxes = document.querySelectorAll('#players-list-container .player-checkbox:checked');

    if (checkboxes.length === 0) {
        selectAllToggle.checked = false;
        selectAllToggle.indeterminate = false;
    } else if (checkedBoxes.length === 0) {
        selectAllToggle.checked = false;
        selectAllToggle.indeterminate = false;
    } else if (checkedBoxes.length === checkboxes.length) {
        selectAllToggle.checked = true;
        selectAllToggle.indeterminate = false;
    } else {
        selectAllToggle.checked = false;
        selectAllToggle.indeterminate = true;
    }
}

