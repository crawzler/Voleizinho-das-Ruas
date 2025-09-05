// js/ui/players-ui.js
// Lógica de interface para a lista de jogadores.

import { getCurrentUser } from '../firebase/auth.js';
import * as Elements from './elements.js';
import { displayMessage } from './messages.js';

let updatePlayerCountCallback = () => {}
let currentFilter = 'todos'; // Filtro ativo atual
let deleteZoneSetup = false; // Flag para evitar múltiplas configurações
let dropZonesSetup = false; // Flag para controlar se as drop zones já foram configuradas

/**
 * Renderiza a lista de jogadores na UI.
 * @param {Array<Object>} players - A lista de jogadores a ser renderizada.
 */
export function renderPlayersList(players) {
    const playersListContainer = Elements.playersListContainer();
    if (!playersListContainer) return;

    // Carrega o estado de seleção dos jogadores
    let selectedPlayerIds = [];
    try {
        ['principais', 'esporadicos', 'random'].forEach(category => {
            const saved = localStorage.getItem(`selectedPlayers_${category}`);
            if (saved) {
                const ids = JSON.parse(saved);
                selectedPlayerIds.push(...ids);
            }
        });
    } catch (e) {
        // Log removido
        selectedPlayerIds = [];
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
        // Log removido
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
            // Log removido
            players = [];
        }
    }
    
    // Migração: adiciona categoria padrão para jogadores sem categoria
    let needsUpdate = false;
    players = players.map(player => {
        if (!player.category) {
            needsUpdate = true;
            return { ...player, category: 'principais' };
        }
        return player;
    });
    
    // Salva a migração se necessário
    if (needsUpdate) {
        localStorage.setItem('volleyballPlayers', JSON.stringify(players));
    }

    playersListContainer.innerHTML = '';

    if (!players || players.length === 0) {
        playersListContainer.innerHTML = '<p class="empty-list-message">Nenhum jogador cadastrado.</p>';
        return;
    }

    // Filtra jogadores baseado no filtro atual
    let filteredPlayers;
    if (currentFilter === 'marcados') {
        filteredPlayers = players.filter(player => selectedPlayerIds.includes(player.id));
    } else if (currentFilter === 'desmarcados') {
        filteredPlayers = players.filter(player => !selectedPlayerIds.includes(player.id));
    } else {
        filteredPlayers = players; // Todos ou fallback
    }
    
    // Ordenação alfabética
    filteredPlayers.sort((a, b) => a.name.localeCompare(b.name));
    
    filteredPlayers.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.className = 'player-list-item';
        const isLocal = !navigator.onLine || player.isLocal;
        
        // Configura dados do jogador (sem draggable padrão)
        playerElement.dataset.playerId = player.id;
        playerElement.dataset.playerCategory = player.category || 'principais';
        
        // Botão de excluir removido - usa apenas drag and drop
        let showDeleteButton = false;
        
        // Verifica se este jogador estava selecionado anteriormente
        const isChecked = selectedPlayerIds.includes(player.id) ? 'checked' : '';
        
        // Determina a foto do usuário - só para jogadores Google (não manuais)
        let userPhoto = 'assets/default-user-icon.svg'; // Ícone padrão
        if (!player.isManual && player.photoURL) {
            userPhoto = player.photoURL;
        }
        
        // Adiciona badge de role se necessário
        let roleBadge = '';
        if (!player.isManual && player.uid) {
            import('./users.js').then(({ createRoleBadge }) => {
                createRoleBadge(player.uid).then(badge => {
                    if (badge) {
                        const nameSpan = playerElement.querySelector('.player-avatar-name span');
                        if (nameSpan && !nameSpan.querySelector('.role-badge-small')) {
                            nameSpan.innerHTML += badge;
                        }
                    }
                });
            }).catch(() => {});
        }
        
        playerElement.innerHTML = `
            <div class="player-info">
                <div class="player-avatar-name">
                    <img src="${userPhoto}" alt="Foto do jogador" class="player-avatar" onerror="this.src='assets/default-user-icon.svg'">
                    <span data-local="${isLocal}">${player.name.replace(' [local]', '')}</span>
                </div>
                <label class="modern-switch">
                    <input type="checkbox" class="player-checkbox" data-player-id="${player.id}" ${isChecked}>
                    <span class="switch-slider"></span>
                </label>
            </div>
            <button class="remove-button ${showDeleteButton ? 'visible' : ''}" data-player-id="${player.id}">
                <span class="material-icons">delete</span>
            </button>
        `;
        
        // SEMPRE configura drag and drop
        setupDragAndDrop(playerElement);
        
        // Configura drag and drop para o botão de excluir se estiver visível
        if (showDeleteButton) {
            const removeButton = playerElement.querySelector('.remove-button');
            if (removeButton) {
                setupRemoveButtonDropZone(removeButton);
            }
        }
        
        playersListContainer.appendChild(playerElement);
    });
    
    // Adiciona event listeners para os checkboxes
    document.querySelectorAll('#players-list-container .player-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', savePlayerSelectionState);
    });
    
    // Configura o toggle "Selecionar Todos"
    setupSelectAllToggle();

    updatePlayerCount();
    
    // Configurar busca de jogadores e abas de categoria
    setupPlayerSearch();
    setupCategoryTabs();
    updateCategoryCounters();
    
    // Configurar drop zones apenas uma vez
    if (!dropZonesSetup) {
        setupDropZones();
    }

}

/**
 * Configura o toggle "Selecionar Todos"
 */
function setupSelectAllToggle() {
    const selectAllToggle = document.getElementById('select-all-players-toggle');
    if (!selectAllToggle) return;
    
    // Remove listener anterior se existir
    selectAllToggle.removeEventListener('change', handleSelectAllToggle);
    
    // Adiciona novo listener
    selectAllToggle.addEventListener('change', handleSelectAllToggle);
    
    // Atualiza o estado inicial
    updateSelectAllToggle();
}

/**
 * Manipula o evento de mudança do toggle "Selecionar Todos"
 */
function handleSelectAllToggle(e) {
    const isChecked = e.target.checked;
    const checkboxes = document.querySelectorAll('#players-list-container .player-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = isChecked;
    });
    
    // Salva o estado
    savePlayerSelectionState();
}

/**
 * Atualiza o estado do toggle "Selecionar Todos"
 */
export function updateSelectAllToggle() {
    const selectAllToggle = document.getElementById('select-all-players-toggle');
    if (!selectAllToggle) return;
    
    const checkboxes = document.querySelectorAll('#players-list-container .player-checkbox');
    const checkedBoxes = document.querySelectorAll('#players-list-container .player-checkbox:checked');
    
    if (checkboxes.length === 0) {
        selectAllToggle.checked = false;
        selectAllToggle.indeterminate = false;
    } else if (checkedBoxes.length > 0) {
        // Ativa o toggle quando há pelo menos um jogador selecionado
        selectAllToggle.checked = true;
        selectAllToggle.indeterminate = false;
    } else {
        selectAllToggle.checked = false;
        selectAllToggle.indeterminate = false;
    }
}

/**
 * Configura as abas de categoria de jogadores
 */
function setupCategoryTabs() {
    const tabs = document.querySelectorAll('.category-tab');
    if (tabs.length === 0) return;
    
    // Não clona as abas aqui, pois isso será feito em setupDropZones
    // Apenas configura os event listeners de clique se as drop zones não foram configuradas ainda
    if (!dropZonesSetup) {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active de todas as abas
                document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
                // Adiciona active na aba clicada
                tab.classList.add('active');
                
                // Atualiza filtro atual
                currentFilter = tab.dataset.category;
                
                // Re-renderiza apenas se a categoria mudou
                const players = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
                renderPlayersList(players);
            });
        });
    }
}

/**
 * Atualiza os contadores de jogadores nas abas de filtro
 */
function updateCategoryCounters() {
    const players = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
    
    // Carrega jogadores selecionados
    let selectedPlayerIds = [];
    try {
        ['principais', 'esporadicos', 'random'].forEach(category => {
            const saved = localStorage.getItem(`selectedPlayers_${category}`);
            if (saved) {
                const ids = JSON.parse(saved);
                selectedPlayerIds.push(...ids);
            }
        });
    } catch (e) {
        selectedPlayerIds = [];
    }
    
    const totalCount = players.length;
    const marcadosCount = players.filter(p => selectedPlayerIds.includes(p.id)).length;
    const desmarcadosCount = totalCount - marcadosCount;
    
    // Atualiza o texto das abas com os contadores
    const tabTodos = document.getElementById('tab-todos');
    const tabMarcados = document.getElementById('tab-marcados');
    const tabDesmarcados = document.getElementById('tab-desmarcados');
    
    if (tabTodos) tabTodos.innerHTML = `<span>Todos</span><span>${totalCount}</span>`;
    if (tabMarcados) tabMarcados.innerHTML = `<span>Marcados</span><span>${marcadosCount}</span>`;
    if (tabDesmarcados) tabDesmarcados.innerHTML = `<span>Desmarcados</span><span>${desmarcadosCount}</span>`;
}

/**
 * Configura a funcionalidade de busca de jogadores
 */
function setupPlayerSearch() {
    const playerInput = document.getElementById('player-input');
    const clearButton = document.getElementById('clear-input-button');
    
    if (playerInput) {
        playerInput.addEventListener('input', (e) => {
            const hasValue = e.target.value.length > 0;
            if (clearButton) {
                clearButton.style.display = hasValue ? 'flex' : 'none';
            }
            filterPlayers();
        });
    }
    
    if (clearButton) {
        clearButton.addEventListener('click', clearSearch);
    }
}

/**
 * Limpa a busca e mostra todos os jogadores
 */
function clearSearch() {
    const playerInput = document.getElementById('player-input');
    const clearButton = document.getElementById('clear-input-button');
    
    if (playerInput) {
        playerInput.value = '';
        if (clearButton) {
            clearButton.style.display = 'none';
        }
        // Reseta o toggle antes de re-renderizar - removido (toggle antigo)
        // Re-renderiza a lista completa da categoria atual
        const players = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
        renderPlayersList(players);
    }
}

/**
 * Filtra jogadores baseado no texto de busca
 */
function filterPlayers() {
    const playerInput = document.getElementById('player-input');
    const searchTerm = playerInput ? playerInput.value.toLowerCase() : '';
    
    if (!searchTerm) {
        // Se não há termo de busca, re-renderiza a lista da categoria atual
        const players = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
        renderPlayersList(players);
        return;
    }
    
    // Se há termo de busca, busca em todas as categorias
    const playersListContainer = Elements.playersListContainer();
    if (!playersListContainer) return;
    
    const allPlayers = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
    const matchingPlayers = allPlayers.filter(player => 
        player.name.toLowerCase().includes(searchTerm)
    );
    
    // Renderiza apenas os jogadores que correspondem à busca
    playersListContainer.innerHTML = '';
    
    if (matchingPlayers.length === 0) {
        playersListContainer.innerHTML = '<p class="empty-list-message">Nenhum jogador encontrado.</p>';
        return;
    }
    
    // Carrega estado de seleção de TODAS as categorias para busca
    let selectedPlayerIds = [];
    try {
        ['principais', 'esporadicos', 'random'].forEach(category => {
            const key = `selectedPlayers_${category}`;
            const savedSelection = localStorage.getItem(key);
            if (savedSelection) {
                const categoryIds = JSON.parse(savedSelection);
                selectedPlayerIds.push(...categoryIds);
            }
        });
    } catch (e) {
        // Log removido
        selectedPlayerIds = [];
    }
    
    // Verifica permissões de exclusão
    const config = JSON.parse(localStorage.getItem('volleyballConfig') || '{}');
    let user = null;
    let canDelete = false;
    try {
        user = getCurrentUser();
        const isAdminKey = config.adminKey === 'admin998939';
        const isGoogleUser = user && !user.isAnonymous;
        canDelete = isAdminKey && isGoogleUser;
    } catch (error) {
        // Log removido
    }
    
    // Ordenação alfabética na busca
    matchingPlayers.sort((a, b) => a.name.localeCompare(b.name));
    
    matchingPlayers.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.className = 'player-list-item';
        const isLocal = !navigator.onLine || player.isLocal;
        
        playerElement.dataset.playerId = player.id;
        playerElement.dataset.playerCategory = player.category || 'principais';
        
        // Botão de excluir removido - usa apenas drag and drop
        let showDeleteButton = false;
        
        const isChecked = selectedPlayerIds.includes(player.id) ? 'checked' : '';
        
        // Determina a foto do usuário para busca também - só para jogadores Google (não manuais)
        let userPhoto = 'assets/default-user-icon.svg'; // Ícone padrão
        if (!player.isManual && player.photoURL) {
            userPhoto = player.photoURL;
        }
        
        playerElement.innerHTML = `
            <div class="player-info">
                <div class="player-avatar-name">
                    <img src="${userPhoto}" alt="Foto do jogador" class="player-avatar" onerror="this.src='assets/default-user-icon.svg'">
                    <span data-local="${isLocal}">${player.name.replace(' [local]', '')}</span>
                </div>
                <label class="modern-switch">
                    <input type="checkbox" class="player-checkbox" data-player-id="${player.id}" ${isChecked}>
                    <span class="switch-slider"></span>
                </label>
            </div>
            <button class="remove-button ${showDeleteButton ? 'visible' : ''}" data-player-id="${player.id}">
                <span class="material-icons">delete</span>
            </button>
        `;
        
        setupDragAndDrop(playerElement);
        
        // Configura drag and drop para o botão de excluir se estiver visível
        if (showDeleteButton) {
            const removeButton = playerElement.querySelector('.remove-button');
            if (removeButton) {
                setupRemoveButtonDropZone(removeButton);
            }
        }
        
        playersListContainer.appendChild(playerElement);
    });
    
    // Adiciona event listeners para os checkboxes
    document.querySelectorAll('#players-list-container .player-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', savePlayerSelectionState);
    });
    
    updatePlayerCount();
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
    
    // Atualiza o toggle "Selecionar Todos"
    updateSelectAllToggle();
    
    // Atualizar também o contador na tela de times usando a função correta
    import('./pages.js').then(({ updateSelectedPlayersCount }) => {
        updateSelectedPlayersCount();
    }).catch(() => {
        // Se não conseguir importar, atualiza diretamente
        const selectedPlayersCountElement = document.getElementById('selected-players-count');
        if (selectedPlayersCountElement) {
            const players = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
            const totalPlayers = players.length;
            let selectedPlayers = 0;
            ['principais', 'esporadicos', 'random'].forEach(category => {
                const categorySelections = localStorage.getItem(`selectedPlayers_${category}`);
                if (categorySelections) {
                    const ids = JSON.parse(categorySelections);
                    selectedPlayers += ids.length;
                }
            });
            selectedPlayersCountElement.textContent = `${selectedPlayers}/${totalPlayers}`;
        }
    });
}

/**
 * Salva o estado de seleção dos jogadores no localStorage por categoria
 */
export function savePlayerSelectionState(e) {
    try {
        // Detecta se a busca está ativa
        const playerInput = document.getElementById('player-input');
        const isSearchActive = playerInput && playerInput.value.trim().length > 0;

        // Quando a busca está ativa, atualiza SOMENTE o checkbox alterado,
        // preservando o restante das seleções já salvas por categoria.
        if (isSearchActive && e && e.target && e.target.classList && e.target.classList.contains('player-checkbox')) {
            const playerId = e.target.dataset.playerId;
            const isChecked = e.target.checked;

            const players = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
            const player = players.find(p => p.id === playerId);
            const playerCategory = (player && player.category) ? player.category : 'principais';

            let categoryIds = [];
            try {
                const saved = localStorage.getItem(`selectedPlayers_${playerCategory}`);
                if (saved) categoryIds = JSON.parse(saved);
            } catch (_) { categoryIds = []; }

            const idx = categoryIds.indexOf(playerId);
            if (isChecked && idx === -1) categoryIds.push(playerId);
            if (!isChecked && idx !== -1) categoryIds.splice(idx, 1);

            localStorage.setItem(`selectedPlayers_${playerCategory}`, JSON.stringify(categoryIds));

            // Atualiza seleções globais e contadores
            updateGlobalSelections();
            import('./pages.js').then(({ updateSelectedPlayersCount }) => {
                updateSelectedPlayersCount();
            }).catch(() => {});
            autoAddPlayersToTeams();
            autoRemoveDeselectedPlayersFromTeams();

            // Atualiza UI local (contador)
            updatePlayerCount();

            // NOVO: reordenar imediatamente a lista enquanto busca está ativa
            const playersPage = document.getElementById('players-page');
            if (playersPage && playersPage.classList.contains('app-page--active')) {
                // Aguarda um pouco antes de reordenar para garantir que o estado foi salvo
                setTimeout(() => {
                    filterPlayers();
                    // Loop de verificação para garantir que o jogador está marcado
                    setTimeout(() => {
                        const checkbox = document.querySelector(`#players-list-container .player-checkbox[data-player-id="${playerId}"]`);
                        if (checkbox && checkbox.checked !== isChecked) {
                            checkbox.checked = isChecked;
                        }
                    }, 100);
                }, 50);
            }
            return; // Evita sobrescrever seleções usando os checkboxes visíveis do filtro
        }

        if (currentFilter === 'todos') {
            // Na aba "Todos", atualiza as categorias específicas dos jogadores
            const players = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
            const categorySelections = {
                principais: [],
                esporadicos: [],
                random: []
            };
            
            document.querySelectorAll('#players-list-container .player-checkbox:checked').forEach(checkbox => {
                const playerId = checkbox.dataset.playerId;
                const player = players.find(p => p.id === playerId);
                if (player) {
                    const playerCategory = player.category || 'principais';
                    categorySelections[playerCategory].push(playerId);
                }
            });
            
            // Salva as seleções nas categorias específicas
            Object.keys(categorySelections).forEach(category => {
                localStorage.setItem(`selectedPlayers_${category}`, JSON.stringify(categorySelections[category]));
            });
        } else {
            // Para filtros de marcados/desmarcados, atualiza baseado nos checkboxes visíveis
            const players = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
            const categorySelections = {
                principais: [],
                esporadicos: [],
                random: []
            };
            
            // Carrega seleções existentes
            ['principais', 'esporadicos', 'random'].forEach(category => {
                const saved = localStorage.getItem(`selectedPlayers_${category}`);
                if (saved) {
                    categorySelections[category] = JSON.parse(saved);
                }
            });
            
            // Atualiza baseado nos checkboxes visíveis
            document.querySelectorAll('#players-list-container .player-checkbox').forEach(checkbox => {
                const playerId = checkbox.dataset.playerId;
                const player = players.find(p => p.id === playerId);
                if (player) {
                    const playerCategory = player.category || 'principais';
                    const index = categorySelections[playerCategory].indexOf(playerId);
                    
                    if (checkbox.checked && index === -1) {
                        categorySelections[playerCategory].push(playerId);
                    } else if (!checkbox.checked && index !== -1) {
                        categorySelections[playerCategory].splice(index, 1);
                    }
                }
            });
            
            // Salva as seleções atualizadas
            Object.keys(categorySelections).forEach(category => {
                localStorage.setItem(`selectedPlayers_${category}`, JSON.stringify(categorySelections[category]));
            });
        }
        
        // Atualiza seleções globais para a aba "Todos"
        updateGlobalSelections();
        
        // Atualiza o contador na tela de times
        import('./pages.js').then(({ updateSelectedPlayersCount }) => {
            updateSelectedPlayersCount();
        }).catch(() => {});
        
        // Adiciona automaticamente novos jogadores aos times existentes
        autoAddPlayersToTeams();
        // Remove automaticamente dos times os jogadores desmarcados
        autoRemoveDeselectedPlayersFromTeams();

        // NOVO: reordenar imediatamente a lista quando a página de jogadores estiver visível
        const playersPage = document.getElementById('players-page');
        if (playersPage && playersPage.classList.contains('app-page--active')) {
            const playerInputNow = document.getElementById('player-input');
            const isSearchActiveNow = playerInputNow && playerInputNow.value.trim().length > 0;
            
            // Aguarda um pouco antes de reordenar para garantir que o estado foi salvo
            setTimeout(() => {
                if (isSearchActiveNow) {
                    filterPlayers();
                } else {
                    const allPlayers = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
                    renderPlayersList(allPlayers);
                }
                
                // Loop de verificação para garantir que todos os checkboxes estão corretos
                setTimeout(() => {
                    document.querySelectorAll('#players-list-container .player-checkbox').forEach(checkbox => {
                        const playerId = checkbox.dataset.playerId;
                        const players = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
                        const player = players.find(p => p.id === playerId);
                        if (player) {
                            const playerCategory = player.category || 'principais';
                            const savedSelection = localStorage.getItem(`selectedPlayers_${playerCategory}`);
                            if (savedSelection) {
                                const selectedIds = JSON.parse(savedSelection);
                                const shouldBeChecked = selectedIds.includes(playerId);
                                if (checkbox.checked !== shouldBeChecked) {
                                    checkbox.checked = shouldBeChecked;
                                }
                            }
                        }
                    });
                    updatePlayerCount();
                }, 100);
            }, 50);
        }
    } catch (e) {
        // Log removido
    }
}

/**
 * Adiciona automaticamente novos jogadores selecionados às vagas existentes nos times.
 */
function autoAddPlayersToTeams() {
    import('../game/logic.js').then(({ getAllGeneratedTeams, setAllGeneratedTeams }) => {
        import('../utils/helpers.js').then(({ salvarTimesGerados }) => {
            import('./messages.js').then(({ displayMessage }) => {
                const teams = getAllGeneratedTeams();
                if (!teams || teams.length === 0) return;
                
                // Obter jogadores selecionados
                const allSelectedIds = [];
                ['principais', 'esporadicos', 'random'].forEach(category => {
                    const categorySelections = localStorage.getItem(`selectedPlayers_${category}`);
                    if (categorySelections) {
                        const ids = JSON.parse(categorySelections);
                        allSelectedIds.push(...ids);
                    }
                });
                
                const players = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
                const selectedPlayers = players.filter(p => allSelectedIds.includes(p.id));
                
                // Obter jogadores já nos times
                const playersInTeams = new Set();
                teams.forEach(team => {
                    team.players.forEach(player => {
                        if (!player.startsWith('[Vaga')) {
                            playersInTeams.add(player);
                        }
                    });
                });
                
                // Encontrar novos jogadores selecionados
                const newPlayers = selectedPlayers.filter(p => !playersInTeams.has(p.name));
                if (newPlayers.length === 0) return;
                
                let addedCount = 0;
                
                // Adicionar aos espaços vazios existentes
                for (const newPlayer of newPlayers) {
                    let added = false;
                    
                    for (let teamIndex = 0; teamIndex < teams.length && !added; teamIndex++) {
                        for (let playerIndex = 0; playerIndex < teams[teamIndex].players.length && !added; playerIndex++) {
                            if (teams[teamIndex].players[playerIndex].startsWith('[Vaga')) {
                                teams[teamIndex].players[playerIndex] = newPlayer.name;
                                added = true;
                                addedCount++;
                            }
                        }
                    }
                    
                    // Se não encontrou vaga, criar novo time
                    if (!added) {
                        const config = JSON.parse(localStorage.getItem('volleyballConfig') || '{}');
                        const playersPerTeam = config.playersPerTeam || 4;
                        const newTeamIndex = teams.length;
                        const teamNameKey = `customTeam${newTeamIndex + 1}Name`;
                        const teamDisplayName = config[teamNameKey] || `Time ${newTeamIndex + 1}`;
                        
                        const newTeamPlayers = [newPlayer.name];
                        for (let i = 1; i < playersPerTeam; i++) {
                            newTeamPlayers.push(`[Vaga ${i + 1}]`);
                        }
                        
                        teams.push({
                            name: teamDisplayName,
                            players: newTeamPlayers,
                            createdAt: Date.now()
                        });
                        addedCount++;
                    }
                }
                
                if (addedCount > 0) {
                    setAllGeneratedTeams(teams);
                    salvarTimesGerados(teams);
                    
                    // Re-renderizar times se estiver na página de times
                    import('./game-ui.js').then(({ renderTeams }) => {
                        renderTeams(teams);
                    }).catch(() => {});
                    
                    displayMessage(`${addedCount} jogador(es) adicionado(s) aos times!`, 'success');
                }
            });
        });
    });
}

/**
 * Atualiza as seleções globais combinando todas as categorias
 */
function autoRemoveDeselectedPlayersFromTeams() {
    import('../game/logic.js').then(({ getAllGeneratedTeams, setAllGeneratedTeams }) => {
        import('../utils/helpers.js').then(({ salvarTimesGerados }) => {
            import('./messages.js').then(({ displayMessage }) => {
                const teams = getAllGeneratedTeams();
                if (!teams || teams.length === 0) return;

                // Obter todos os IDs selecionados atualmente (todas as categorias)
                const allSelectedIds = [];
                ['principais', 'esporadicos', 'random'].forEach(category => {
                    const categorySelections = localStorage.getItem(`selectedPlayers_${category}`);
                    if (categorySelections) {
                        try {
                            const ids = JSON.parse(categorySelections);
                            allSelectedIds.push(...ids);
                        } catch (_) {}
                    }
                });

                // Mapear IDs selecionados para nomes
                const players = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
                const selectedIdsSet = new Set(allSelectedIds);
                const selectedNamesSet = new Set(
                    players.filter(p => selectedIdsSet.has(p.id)).map(p => p.name)
                );

                let removedCount = 0;

                // Remover dos times todos os jogadores que não estão selecionados
                for (let t = 0; t < teams.length; t++) {
                    const team = teams[t];
                    for (let i = 0; i < team.players.length; i++) {
                        const name = team.players[i];
                        if (typeof name === 'string' && !name.startsWith('[Vaga')) {
                            if (!selectedNamesSet.has(name)) {
                                team.players[i] = `[Vaga ${i + 1}]`;
                                removedCount++;
                            }
                        }
                    }
                }

                if (removedCount > 0) {
                    setAllGeneratedTeams(teams);
                    salvarTimesGerados(teams);
                    import('./game-ui.js').then(({ renderTeams }) => {
                        renderTeams(teams);
                    }).catch(() => {});
                    
                    // NOVO: limpar times vazios (exceto recém-criados)
                    import('./game-ui.js').then(({ pruneEmptyTeamsExceptNewlyCreated }) => {
                        pruneEmptyTeamsExceptNewlyCreated();
                    }).catch(() => {});
                    
                    displayMessage(`${removedCount} jogador(es) removido(s) dos times!`, 'info');
                }
            });
        });
    });
}

function updateGlobalSelections() {
    try {
        const allSelected = [];
        ['principais', 'esporadicos', 'random'].forEach(category => {
            const categorySelections = localStorage.getItem(`selectedPlayers_${category}`);
            if (categorySelections) {
                const ids = JSON.parse(categorySelections);
                allSelected.push(...ids);
            }
        });
        localStorage.setItem('selectedPlayers_todos', JSON.stringify(allSelected));
    } catch (e) {
        // Log removido
    }
}

/**
 * Muda o filtro ativo de jogadores
 * @param {string} filter - O filtro para aplicar ('todos', 'marcados', 'desmarcados')
 */
export function setCurrentFilter(filter) {
    currentFilter = filter;
    const players = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
    renderPlayersList(players);
}

/**
 * Reseta as configurações de drag and drop (útil para reinicialização)
 */
export function resetDragAndDropSetup() {
    deleteZoneSetup = false;
    dropZonesSetup = false;
}

/**
 * Configura clique longo para drag and drop
 */
function setupDragAndDrop(playerElement) {
    if (!playerElement) return;
    
    let longPressTimer;
    let isDragging = false;
    let touchStartY = 0;
    let isMouseDown = false;
    let dragGhost = null;
    let ghostOffsetX = 50;
    let ghostOffsetY = 25;
    const deleteZone = document.getElementById('delete-zone');
    
    // Função para mostrar zona de exclusão
    const showDeleteZone = () => {
        if (deleteZone) {
            deleteZone.style.display = 'flex';
            setTimeout(() => deleteZone.classList.add('active'), 10);
        }
    };
    
    // Função para criar elemento fantasma
    const createDragGhost = (x, y) => {
        dragGhost = playerElement.cloneNode(true);
        const rect = playerElement.getBoundingClientRect();
        ghostOffsetX = rect.width / 2;
        ghostOffsetY = rect.height / 2;
        dragGhost.style.position = 'fixed';
        dragGhost.style.width = rect.width + 'px';
        dragGhost.style.height = rect.height + 'px';
        dragGhost.style.left = (x - ghostOffsetX) + 'px';
        dragGhost.style.top = (y - ghostOffsetY) + 'px';
        dragGhost.style.zIndex = '9999';
        dragGhost.style.pointerEvents = 'none';
        dragGhost.style.opacity = '0.6';
        try {
            dragGhost.style.setProperty('transform', 'none', 'important');
            dragGhost.style.setProperty('animation', 'none', 'important');
        } catch (e) { /* ignore */ }
        // Copia estilos visuais do card original para evitar fallback escuro e borda
        try {
            const cs = window.getComputedStyle(playerElement);
            const bg = cs.background || cs.backgroundColor;
            if (bg) {
                dragGhost.style.setProperty('background', bg, 'important');
                dragGhost.style.setProperty('background-color', cs.backgroundColor, 'important');
            }
            if (cs.borderRadius) dragGhost.style.setProperty('border-radius', cs.borderRadius, 'important');
            if (cs.boxShadow) dragGhost.style.setProperty('box-shadow', cs.boxShadow, 'important');
            // Sem borda no fantasma
            
        } catch (err) { /* ignore */ }
        dragGhost.classList.add('drag-ghost');
        document.body.appendChild(dragGhost);
    };
    
    // Função para atualizar posição do fantasma
    const updateDragGhost = (x, y) => {
        if (dragGhost) {
            dragGhost.style.left = (x - ghostOffsetX) + 'px';
            dragGhost.style.top = (y - ghostOffsetY) + 'px';
        }
    };
    
    // Função para remover fantasma
    const removeDragGhost = () => {
        if (dragGhost) {
            dragGhost.remove();
            dragGhost = null;
        }
    };
    // Desktop helper para manter o ghost sincronizado durante drag nativo
    const onDocDragOver = (e) => {
        if (isDragging && dragGhost) {
            e.preventDefault();
            updateDragGhost(e.clientX, e.clientY);
        }
    };
    
    // Touch events para mobile
    playerElement.addEventListener('touchstart', (e) => {
        if (isMouseDown) return; // Evita conflito com mouse events
        
        touchStartY = e.touches[0].clientY;
        longPressTimer = setTimeout(() => {
            isDragging = true;
            try { playerElement.style.setProperty('transform', 'none', 'important'); playerElement.style.setProperty('animation', 'none', 'important'); } catch (err) {}
            createDragGhost(e.touches[0].clientX, e.touches[0].clientY);
            showDeleteZone();
            // Previne scroll apenas quando inicia o drag
            e.preventDefault();
        }, 500);
    });
    
    playerElement.addEventListener('touchmove', (e) => {
        if (isDragging) {
            e.preventDefault();
            const touch = e.touches[0];
            
            // Atualiza posição do fantasma
            updateDragGhost(touch.clientX, touch.clientY);
            
            // Esconde temporariamente o fantasma para detectar elemento abaixo
            if (dragGhost) dragGhost.style.display = 'none';
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            if (dragGhost) dragGhost.style.display = 'block';
            
            // Verifica se está sobre a zona de exclusão
            if (elementBelow && elementBelow.closest('#delete-zone')) {
                if (deleteZone) deleteZone.classList.add('drag-over');
            } else {
                if (deleteZone) deleteZone.classList.remove('drag-over');
            }
            
            // Verifica se está sobre um botão de excluir
            const removeButton = elementBelow && (elementBelow.classList.contains('remove-button') || elementBelow.closest('.remove-button'));
            if (removeButton && removeButton.classList.contains('visible')) {
                removeButton.classList.add('highlight');
                // Remove highlight de outros botões
                document.querySelectorAll('.remove-button').forEach(btn => {
                    if (btn !== removeButton) {
                        btn.classList.remove('highlight');
                    }
                });
            } else {
                // Remove highlight de todos os botões
                document.querySelectorAll('.remove-button').forEach(btn => {
                    btn.classList.remove('highlight');
                });
            }
            
            // Verifica se está sobre uma aba de categoria
            const categoryTab = elementBelow && elementBelow.closest('.category-tab');
            if (categoryTab) {
                categoryTab.classList.add('drag-over');
                // Remove drag-over de outras abas
                document.querySelectorAll('.category-tab').forEach(tab => {
                    if (tab !== categoryTab) {
                        tab.classList.remove('drag-over');
                    }
                });
            } else {
                // Remove drag-over de todas as abas
                document.querySelectorAll('.category-tab').forEach(tab => {
                    tab.classList.remove('drag-over');
                });
            }
        } else {
            // Cancela o timer se o usuário mover muito (scroll normal)
            const touch = e.touches[0];
            const deltaY = Math.abs(touch.clientY - touchStartY);
            if (deltaY > 10) {
                clearTimeout(longPressTimer);
            }
        }
    });
    
    playerElement.addEventListener('touchend', (e) => {
        clearTimeout(longPressTimer);
        if (isDragging) {
            const touch = e.changedTouches[0];
            
            // Esconde temporariamente o fantasma para detectar elemento abaixo
            if (dragGhost) dragGhost.style.display = 'none';
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            if (dragGhost) dragGhost.style.display = 'block';
            
            // Verifica se foi solto na zona de exclusão
            if (elementBelow && elementBelow.closest('#delete-zone')) {
                deletePlayer(playerElement.dataset.playerId);
            } else {
                // Verifica se foi solto em um botão de excluir
                const removeButton = elementBelow && (elementBelow.classList.contains('remove-button') || elementBelow.closest('.remove-button'));
                if (removeButton && removeButton.classList.contains('visible')) {
                    const targetPlayerId = removeButton.dataset.playerId;
                    if (targetPlayerId) {
                        deletePlayer(targetPlayerId);
                    }
                } else {
                    // Verifica se foi solto em uma aba de categoria
                    const categoryTab = elementBelow && elementBelow.closest('.category-tab');
                    if (categoryTab && categoryTab.dataset.category) {
                        const newCategory = categoryTab.dataset.category;
                        const playerId = playerElement.dataset.playerId;
                        if (playerId && newCategory) {
                            movePlayerToCategory(playerId, newCategory).catch(error => {
                                // Log removido
                            });
                        }
                    }
                }
            }
            
            isDragging = false;
            try { playerElement.style.removeProperty('transform'); playerElement.style.removeProperty('animation'); } catch (err) {}
            playerElement.classList.remove('dragging');
            removeDragGhost();
            hideDeleteZone();
            // Remove drag-over de todas as abas e highlight dos botões
            document.querySelectorAll('.category-tab').forEach(tab => {
                tab.classList.remove('drag-over');
            });
            document.querySelectorAll('.remove-button').forEach(btn => {
                btn.classList.remove('highlight');
            });
        }
    });
    
    // Mouse events para desktop
    playerElement.addEventListener('mousedown', (e) => {
        isMouseDown = true;
        const startX = e.clientX;
        const startY = e.clientY;
        longPressTimer = setTimeout(() => {
            isDragging = true;
            playerElement.draggable = true;
            try { playerElement.style.setProperty('transform', 'none', 'important'); playerElement.style.setProperty('animation', 'none', 'important'); } catch (err) {}
            playerElement.classList.add('dragging');
            createDragGhost(startX, startY);
            document.addEventListener('dragover', onDocDragOver);
            showDeleteZone();
        }, 500);
    });
    
    playerElement.addEventListener('mouseup', () => {
        isMouseDown = false;
        clearTimeout(longPressTimer);
    });
    
    playerElement.addEventListener('mouseleave', () => {
        isMouseDown = false;
        clearTimeout(longPressTimer);
    });
    
    playerElement.addEventListener('dragstart', (e) => {
        if (e.dataTransfer) {
            e.dataTransfer.setData('text/plain', playerElement.dataset.playerId);
            e.dataTransfer.effectAllowed = 'move';
            try {
                const transparentImg = new Image();
                transparentImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
                e.dataTransfer.setDragImage(transparentImg, 0, 0);
            } catch (err) { /* ignore */ }
        }
    });
    
    playerElement.addEventListener('dragend', () => {
        isDragging = false;
        try { playerElement.style.removeProperty('transform'); playerElement.style.removeProperty('animation'); } catch (err) {}
        playerElement.classList.remove('dragging');
        playerElement.draggable = false;
        removeDragGhost();
        document.removeEventListener('dragover', onDocDragOver);
        hideDeleteZone();
        // Remove drag-over de todas as abas e highlight dos botões
        document.querySelectorAll('.category-tab').forEach(tab => {
            tab.classList.remove('drag-over');
        });
        document.querySelectorAll('.remove-button').forEach(btn => {
            btn.classList.remove('highlight');
        });
    });
    
    // Adiciona listener para mousemove durante drag (desktop)
    document.addEventListener('mousemove', (e) => {
        if (isDragging && dragGhost) {
            updateDragGhost(e.clientX, e.clientY);
            
            // Verifica se está sobre um botão de excluir durante drag no desktop
            const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
            const removeButton = elementBelow && elementBelow.closest('.remove-button');
            if (removeButton && removeButton.classList.contains('visible')) {
                removeButton.classList.add('highlight');
                // Remove highlight de outros botões
                document.querySelectorAll('.remove-button').forEach(btn => {
                    if (btn !== removeButton) {
                        btn.classList.remove('highlight');
                    }
                });
            } else {
                // Remove highlight de todos os botões
                document.querySelectorAll('.remove-button').forEach(btn => {
                    btn.classList.remove('highlight');
                });
            }
        }
    });
}

function hideDeleteZone() {
    const deleteZone = document.getElementById('delete-zone');
    if (deleteZone) {
        deleteZone.classList.remove('active', 'drag-over');
        setTimeout(() => {
            deleteZone.style.display = 'none';
        }, 300);
    }
}

function deletePlayer(playerId) {
    // Log removido
    
    // Encontra o jogador
    const players = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
    const player = players.find(p => p.id === playerId);
    const playerName = player ? player.name.replace(' [local]', '') : 'este jogador';
    
    // Log removido
    
    if (!player) {
        import('./messages.js').then(({ displayMessage }) => {
            displayMessage('Jogador não encontrado', 'error');
        });
        return;
    }
    
    // Verifica permissões
    import('../firebase/auth.js').then(({ getCurrentUser }) => {
        const currentUser = getCurrentUser();
        const config = JSON.parse(localStorage.getItem('volleyballConfig') || '{}');
        const ADMIN_UIDS = ["fVTPCFEN5KSKt4me7FgPyNtXHMx1", "Q7cjHJcQoMV9J8IEaxnFFbWNXw22"];
        
        const isAdmin = currentUser && ADMIN_UIDS.includes(currentUser.uid);
        const isCreator = currentUser && player.createdBy === currentUser.uid;
        const isLocal = player.isLocal;
        
        // Log removido
        
        // Se não tem permissão para excluir
        if (!isLocal && !isAdmin && !isCreator) {
            // Log removido
            import('./messages.js').then(({ displayMessage }) => {
                displayMessage('Você não tem autorização para remover este jogador', 'error');
            });
            return;
        }
        
        // Mostra modal de confirmação
        const modal = document.getElementById('confirmation-modal');
        const message = document.getElementById('confirmation-message');
        const confirmBtn = document.getElementById('confirm-yes-button');
        const cancelBtn = document.getElementById('confirm-no-button');
        
        if (modal && message && confirmBtn && cancelBtn) {
            message.textContent = `Tem certeza que deseja excluir ${playerName}?`;
            modal.classList.add('active');
            
            // Remove listeners antigos
            const newConfirmBtn = confirmBtn.cloneNode(true);
            const newCancelBtn = cancelBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            
            // Confirmar exclusão
            newConfirmBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                // Log removido
                
                import('./messages.js').then(({ displayMessage }) => {
                    import('../data/players.js').then(({ removePlayer }) => {
                        // Obtém o appId correto
                        const appId = localStorage.getItem('appId') || 'default';
                        // Log removido
                        
                        removePlayer(playerId, currentUser ? currentUser.uid : null, appId)
                            .then(() => {
                                // Log removido
                                displayMessage('Jogador removido com sucesso!', 'success');
                            })
                            .catch((error) => {
                                // Log removido
                                displayMessage(`Erro ao remover jogador: ${error.message}`, 'error');
                            });
                    }).catch(error => {
                        // Log removido
                        displayMessage('Erro interno ao remover jogador', 'error');
                    });
                }).catch(error => {
                    // Log removido
                });
            });
            
            // Cancelar exclusão
            newCancelBtn.addEventListener('click', () => {
                // Log removido
                modal.classList.remove('active');
            });
        } else {
            // Log removido
        }
    }).catch(error => {
        // Log removido
    });
}

function setupDeleteZone() {
    if (deleteZoneSetup) return; // Evita múltiplas configurações
    
    const deleteZone = document.getElementById('delete-zone');
    if (!deleteZone) return;
    
    // Garante que a zona de exclusão esteja anexada ao body para que position: fixed
    // seja relativo à viewport e não a um container com transform/scroll
    try {
        if (deleteZone.parentElement !== document.body) {
            document.body.appendChild(deleteZone);
        }
    } catch (e) { /* ignore */ }
    
    // Desktop drag and drop
    deleteZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        deleteZone.classList.add('drag-over');
    });
    
    deleteZone.addEventListener('dragleave', (e) => {
        // Só remove se realmente saiu da zona
        if (!deleteZone.contains(e.relatedTarget)) {
            deleteZone.classList.remove('drag-over');
        }
    });
    
    deleteZone.addEventListener('drop', (e) => {
        e.preventDefault();
        deleteZone.classList.remove('drag-over');
        
        const playerId = e.dataTransfer.getData('text/plain');
        if (playerId && playerId.trim()) {
            deletePlayer(playerId);
        }
        
        hideDeleteZone();
    });
    
    deleteZoneSetup = true;
}

// Configura a zona de exclusão uma única vez quando o módulo é carregado
setupDeleteZone();

/**
 * Configura um botão de excluir como zona de drop
 */
function setupRemoveButtonDropZone(removeButton) {
    if (!removeButton) return;
    
    // Desktop drag and drop
    removeButton.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        removeButton.classList.add('highlight');
    });
    
    removeButton.addEventListener('dragleave', (e) => {
        // Só remove se realmente saiu do botão
        if (!removeButton.contains(e.relatedTarget)) {
            removeButton.classList.remove('highlight');
        }
    });
    
    removeButton.addEventListener('drop', (e) => {
        e.preventDefault();
        removeButton.classList.remove('highlight');
        
        const playerId = e.dataTransfer.getData('text/plain');
        if (playerId && playerId.trim()) {
            deletePlayer(playerId);
        }
    });
}

/**
 * Configura as abas como drop zones
 */
function setupDropZones() {
    if (dropZonesSetup) return; // Evita múltiplas configurações
    
    const tabs = document.querySelectorAll('.category-tab');
    if (tabs.length === 0) return;
    
    tabs.forEach(tab => {
        // Remove listeners antigos se existirem
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);
        
        newTab.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            newTab.classList.add('drag-over');
        });
        
        newTab.addEventListener('dragleave', (e) => {
            // Só remove se realmente saiu da aba
            if (!newTab.contains(e.relatedTarget)) {
                newTab.classList.remove('drag-over');
            }
        });
        
        newTab.addEventListener('drop', async (e) => {
            e.preventDefault();
            newTab.classList.remove('drag-over');
            
            const playerId = e.dataTransfer.getData('text/plain');
            const newCategory = newTab.dataset.category;
            
            if (playerId && newCategory) {
                try {
                    await movePlayerToCategory(playerId, newCategory);
                } catch (error) {
                    // Log removido
                    const { displayMessage } = await import('./messages.js');
                    displayMessage('Erro ao mover jogador', 'error');
                }
            }
        });
        
        // Reconfigurar o event listener de clique para mudança de categoria
        newTab.addEventListener('click', () => {
            // Remove active de todas as abas
            document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            // Adiciona active na aba clicada
            newTab.classList.add('active');
            
            // Atualiza filtro atual
            currentFilter = newTab.dataset.category;
            
            // Re-renderiza apenas se a categoria mudou
            const players = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
            renderPlayersList(players);
        });
    });
    
    dropZonesSetup = true;
}

/**
 * Move um jogador para uma nova categoria
 */
async function movePlayerToCategory(playerId, newCategory) {
    try {
        let players = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
        const playerIndex = players.findIndex(p => p.id === playerId);
        
        if (playerIndex === -1) return;
        
        const player = players[playerIndex];
        const oldCategory = player.category || 'principais';
        
        if (oldCategory === newCategory) return;
        
        // Atualiza a categoria do jogador
        players[playerIndex].category = newCategory;
        
        // Salva no localStorage
        localStorage.setItem('volleyballPlayers', JSON.stringify(players));
        
        // Re-renderiza para atualizar em tempo real
        renderPlayersList(players);
        
        // Tenta salvar no Firebase se for admin
        if (navigator.onLine && !player.isLocal) {
            try {
                const { getCurrentUser } = await import('../firebase/auth.js');
                const currentUser = getCurrentUser();
                
                // Verifica se é admin
                const config = JSON.parse(localStorage.getItem('volleyballConfig') || '{}');
                const isAdminKey = config.adminKey === 'admin998939';
                const isGoogleUser = currentUser && !currentUser.isAnonymous;
                const isAdmin = isAdminKey && isGoogleUser;
                
                if (isAdmin) {
                    const { getFirestoreDb } = await import('../firebase/config.js');
                    const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js');
                    const { getAppId } = await import('../firebase/config.js');
                    
                    const db = getFirestoreDb();
                    const appId = getAppId();
                    
                    if (db && appId) {
                        const playerDocRef = doc(db, `artifacts/${appId}/public/data/players`, playerId);
                        await updateDoc(playerDocRef, { category: newCategory });
                    }
                }
            } catch (error) {
                // Log removido
            }
        }
        
        const { displayMessage } = await import('./messages.js');
        displayMessage(`Jogador movido para ${getCategoryDisplayName(newCategory)}!`, 'success');
        
    } catch (error) {
        // Log removido
        const { displayMessage } = await import('./messages.js');
        displayMessage('Erro ao mover jogador', 'error');
    }
}

/**
 * Retorna o nome de exibição da categoria
 */
function getCategoryDisplayName(category) {
    const names = {
        principais: 'Principais',
        esporadicos: 'Esporádicos', 
        random: 'Random'
    };
    return names[category] || category;
}



/**
 * Desmarca um jogador na tela de jogadores quando removido de um time.
 * @param {string} playerName - Nome do jogador a ser desmarcado.
 */
export function unselectPlayerInUI(playerName) {
    const allPlayers = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
    const playerData = allPlayers.find(p => p.name === playerName);

    if (playerData) {
        const playerCategory = playerData.category || 'principais';
        const key = `selectedPlayers_${playerCategory}`;
        let selectedPlayerIds = [];
        try {
            const savedSelection = localStorage.getItem(key);
            if (savedSelection) {
                selectedPlayerIds = JSON.parse(savedSelection);
            }
        } catch (e) {
            selectedPlayerIds = [];
        }

        const index = selectedPlayerIds.indexOf(playerData.id);
        if (index > -1) {
            selectedPlayerIds.splice(index, 1);
            localStorage.setItem(key, JSON.stringify(selectedPlayerIds));

            // ATUALIZADO: Chamar updateGlobalSelections para manter a aba "Todos" em sincronia
            updateGlobalSelections();

            // Atualiza a contagem de jogadores
            updatePlayerCount();

            // Se a página de jogadores estiver visível, re-renderiza a lista
            const playersPage = document.getElementById('players-page');
            if (playersPage && playersPage.classList.contains('app-page--active')) {
                renderPlayersList(allPlayers);
            }
        }
    }
}



