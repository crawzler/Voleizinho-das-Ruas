// js/ui/players-ui.js
// Lógica de interface para a lista de jogadores.

import { getCurrentUser } from '../firebase/auth.js';
import * as Elements from './elements.js';
import { displayMessage } from './messages.js';

let updatePlayerCountCallback = () => {}
let currentCategory = 'todos'; // Categoria ativa atual

/**
 * Renderiza a lista de jogadores na UI.
 * @param {Array<Object>} players - A lista de jogadores a ser renderizada.
 */
export function renderPlayersList(players) {
    const playersListContainer = Elements.playersListContainer();
    if (!playersListContainer) return;

    // Carrega o estado de seleção dos jogadores por categoria
    let selectedPlayerIds = [];
    try {
        const key = `selectedPlayers_${currentCategory}`;
        const savedSelection = localStorage.getItem(key);
        if (savedSelection) {
            selectedPlayerIds = JSON.parse(savedSelection);
        }
    } catch (e) {
        console.warn('Erro ao carregar estado de seleção dos jogadores:', e);
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

    // Filtra jogadores por categoria atual e ordena por nome
    const filteredPlayers = currentCategory === 'todos' 
        ? players // Mostra todos se categoria for 'todos'
        : players.filter(player => {
            const playerCategory = player.category || 'principais'; // Categoria padrão para jogadores antigos
            return playerCategory === currentCategory;
          });
    
    filteredPlayers.sort((a, b) => a.name.localeCompare(b.name));
    
    filteredPlayers.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.className = 'player-list-item';
        const isLocal = !navigator.onLine || player.isLocal;
        
        // Configura dados do jogador (sem draggable padrão)
        playerElement.dataset.playerId = player.id;
        playerElement.dataset.playerCategory = player.category || 'principais';
        
        // Verifica se o usuário atual pode excluir este jogador específico
        let showDeleteButton = canDelete; // Admin pode excluir qualquer jogador

        // Se não for admin, verifica se foi o criador deste jogador
        if (!showDeleteButton && user) {
            // Verifica se o jogador foi criado pelo usuário atual
            if (player.createdBy && player.createdBy === user.uid) {
                showDeleteButton = true;
            }
        }
        
        // Verifica se este jogador estava selecionado anteriormente
        const isChecked = selectedPlayerIds.includes(player.id) ? 'checked' : '';
        
        playerElement.innerHTML = `
            <div class="player-info">
                <span data-local="${isLocal}">${player.name.replace(' [local]', '')}</span>
                <label class="switch">
                    <input type="checkbox" class="player-checkbox" data-player-id="${player.id}" ${isChecked}>
                    <span class="slider round"></span>
                </label>
            </div>
            <button class="remove-button ${showDeleteButton ? 'visible' : ''}" data-player-id="${player.id}">
                <span class="material-icons">delete</span>
            </button>
        `;
        
        // SEMPRE configura drag and drop
        setupDragAndDrop(playerElement);
        playersListContainer.appendChild(playerElement);
    });
    
    // Adiciona event listeners para os checkboxes
    document.querySelectorAll('#players-list-container .player-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', savePlayerSelectionState);
    });
    
    // Adiciona event listener para o botão "Selecionar Todos"
    const selectAllToggle = Elements.selectAllPlayersToggle();
    if (selectAllToggle) {
        // Remove listener antigo para evitar duplicação
        selectAllToggle.replaceWith(selectAllToggle.cloneNode(true));
        const newSelectAllToggle = Elements.selectAllPlayersToggle();
        
        if (newSelectAllToggle) {
            newSelectAllToggle.addEventListener('change', () => {
                // Marca ou desmarca todos os checkboxes APENAS da categoria atual
                const checkboxes = document.querySelectorAll('#players-list-container .player-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = newSelectAllToggle.checked;
                });
                
                // Salva o estado
                savePlayerSelectionState();
                updatePlayerCount();
            });
        }
    }

    updatePlayerCount();
    updateSelectAllToggle();
    
    // Configurar busca de jogadores e abas de categoria
    setupPlayerSearch();
    setupCategoryTabs();
    setupDropZones();
    updateCategoryCounters();

}

/**
 * Configura as abas de categoria de jogadores
 */
function setupCategoryTabs() {
    const tabs = document.querySelectorAll('.category-tab');
    
    tabs.forEach(tab => {
        // Remove listeners antigos para evitar duplicação
        tab.replaceWith(tab.cloneNode(true));
    });
    
    // Re-seleciona as abas após clonagem
    const newTabs = document.querySelectorAll('.category-tab');
    
    newTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active de todas as abas
            newTabs.forEach(t => t.classList.remove('active'));
            // Adiciona active na aba clicada
            tab.classList.add('active');
            
            // Atualiza categoria atual
            currentCategory = tab.dataset.category;
            
            // Re-renderiza apenas se a categoria mudou
            const players = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
            renderPlayersList(players);
        });
    });
}

/**
 * Atualiza os contadores de jogadores nas abas de categoria
 */
function updateCategoryCounters() {
    const players = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
    const counts = {
        principais: 0,
        esporadicos: 0,
        random: 0
    };
    
    players.forEach(player => {
        const category = player.category || 'principais';
        if (counts.hasOwnProperty(category)) {
            counts[category]++;
        }
    });
    
    const totalCount = players.length;
    
    // Atualiza o texto das abas com os contadores
    const tabTodos = document.getElementById('tab-todos');
    const tabPrincipais = document.getElementById('tab-principais');
    const tabEsporadicos = document.getElementById('tab-esporadicos');
    const tabRandom = document.getElementById('tab-random');
    
    if (tabTodos) tabTodos.innerHTML = `<span>Todos</span><span>${totalCount}</span>`;
    if (tabPrincipais) tabPrincipais.innerHTML = `<span>Principais</span><span>${counts.principais}</span>`;
    if (tabEsporadicos) tabEsporadicos.innerHTML = `<span>Esporádicos</span><span>${counts.esporadicos}</span>`;
    if (tabRandom) tabRandom.innerHTML = `<span>Random</span><span>${counts.random}</span>`;
}

/**
 * Configura a funcionalidade de busca de jogadores
 */
function setupPlayerSearch() {
    const playerInput = document.getElementById('player-input');
    const clearButton = document.getElementById('clear-search-button');
    
    if (playerInput) {
        playerInput.addEventListener('input', filterPlayers);
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
    if (playerInput) {
        playerInput.value = '';
        filterPlayers();
    }
}

/**
 * Filtra jogadores baseado no texto de busca
 */
function filterPlayers() {
    const playerInput = document.getElementById('player-input');
    const searchTerm = playerInput ? playerInput.value.toLowerCase() : '';
    
    if (!searchTerm) {
        // Se não há termo de busca, mostra apenas jogadores da categoria atual
        const playerItems = document.querySelectorAll('.player-list-item');
        playerItems.forEach(item => {
            item.style.display = 'flex';
        });
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
    
    // Carrega estado de seleção da categoria atual
    let selectedPlayerIds = [];
    try {
        const key = `selectedPlayers_${currentCategory}`;
        const savedSelection = localStorage.getItem(key);
        if (savedSelection) {
            selectedPlayerIds = JSON.parse(savedSelection);
        }
    } catch (e) {
        console.warn('Erro ao carregar estado de seleção:', e);
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
        console.warn('Erro ao obter usuário atual:', error);
    }
    
    matchingPlayers.sort((a, b) => a.name.localeCompare(b.name));
    
    matchingPlayers.forEach(player => {
        const playerElement = document.createElement('div');
        playerElement.className = 'player-list-item';
        const isLocal = !navigator.onLine || player.isLocal;
        
        playerElement.dataset.playerId = player.id;
        playerElement.dataset.playerCategory = player.category || 'principais';
        
        let showDeleteButton = canDelete;
        if (!showDeleteButton && user && player.createdBy === user.uid) {
            showDeleteButton = true;
        }
        
        const isChecked = selectedPlayerIds.includes(player.id) ? 'checked' : '';
        
        playerElement.innerHTML = `
            <div class="player-info">
                <span data-local="${isLocal}">${player.name.replace(' [local]', '')}</span>
                <label class="switch">
                    <input type="checkbox" class="player-checkbox" data-player-id="${player.id}" ${isChecked}>
                    <span class="slider round"></span>
                </label>
            </div>
            <button class="remove-button ${showDeleteButton ? 'visible' : ''}" data-player-id="${player.id}">
                <span class="material-icons">delete</span>
            </button>
        `;
        
        setupDragAndDrop(playerElement);
        playersListContainer.appendChild(playerElement);
    });
    
    // Adiciona event listeners para os checkboxes
    document.querySelectorAll('#players-list-container .player-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', savePlayerSelectionState);
    });
    
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
    
    // Atualizar também o contador na tela de times
    const selectedPlayersCountElement = document.getElementById('selected-players-count');
    if (selectedPlayersCountElement) {
        selectedPlayersCountElement.textContent = `${selectedCount}/${totalCount}`;
    }
}

/**
 * Salva o estado de seleção dos jogadores no localStorage por categoria
 */
export function savePlayerSelectionState() {
    try {
        if (currentCategory === 'todos') {
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
            // Para categorias específicas, salva normalmente
            const selectedPlayerIds = [];
            document.querySelectorAll('#players-list-container .player-checkbox:checked').forEach(checkbox => {
                selectedPlayerIds.push(checkbox.dataset.playerId);
            });
            
            const key = `selectedPlayers_${currentCategory}`;
            localStorage.setItem(key, JSON.stringify(selectedPlayerIds));
        }
        
        // Atualiza seleções globais para a aba "Todos"
        updateGlobalSelections();
    } catch (e) {
        console.warn('Erro ao salvar estado de seleção dos jogadores:', e);
    }
}

/**
 * Atualiza as seleções globais combinando todas as categorias
 */
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
        console.warn('Erro ao atualizar seleções globais:', e);
    }
}

/**
 * Muda a categoria ativa de jogadores
 * @param {string} category - A categoria para filtrar ('principais', 'esporadicos', 'random')
 */
export function setCurrentCategory(category) {
    currentCategory = category;
    const players = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
    renderPlayersList(players);
}

/**
 * Configura clique longo para drag and drop
 */
function setupDragAndDrop(playerElement) {
    let longPressTimer;
    let isDragging = false;
    
    playerElement.addEventListener('touchstart', (e) => {
        longPressTimer = setTimeout(() => {
            isDragging = true;
            playerElement.draggable = true;
            playerElement.classList.add('dragging');
            
            // Simula dragstart
            const dragEvent = new Event('dragstart');
            dragEvent.dataTransfer = {
                setData: () => {},
                getData: () => playerElement.dataset.playerId
            };
            playerElement.dispatchEvent(dragEvent);
        }, 500); // 500ms para clique longo
    });
    
    playerElement.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
        if (isDragging) {
            isDragging = false;
            playerElement.draggable = false;
            playerElement.classList.remove('dragging');
        }
    });
    
    playerElement.addEventListener('touchmove', () => {
        if (!isDragging) {
            clearTimeout(longPressTimer);
        }
    });
    
    // Para desktop
    playerElement.addEventListener('mousedown', (e) => {
        longPressTimer = setTimeout(() => {
            playerElement.draggable = true;
            playerElement.classList.add('dragging');
        }, 500);
    });
    
    playerElement.addEventListener('mouseup', () => {
        clearTimeout(longPressTimer);
    });
    
    playerElement.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', playerElement.dataset.playerId);
    });
    
    playerElement.addEventListener('dragend', () => {
        playerElement.classList.remove('dragging');
        playerElement.draggable = false;
    });
}

/**
 * Configura as abas como drop zones
 */
function setupDropZones() {
    const tabs = document.querySelectorAll('.category-tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('dragover', (e) => {
            e.preventDefault();
            tab.classList.add('drag-over');
        });
        
        tab.addEventListener('dragleave', () => {
            tab.classList.remove('drag-over');
        });
        
        tab.addEventListener('drop', async (e) => {
            e.preventDefault();
            tab.classList.remove('drag-over');
            
            const playerId = e.dataTransfer.getData('text/plain');
            const newCategory = tab.dataset.category;
            
            await movePlayerToCategory(playerId, newCategory);
        });
    });
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
                console.warn('Erro ao atualizar categoria no Firebase:', error);
            }
        }
        
        const { displayMessage } = await import('./messages.js');
        displayMessage(`Jogador movido para ${getCategoryDisplayName(newCategory)}!`, 'success');
        
    } catch (error) {
        console.error('Erro ao mover jogador:', error);
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
 * Atualiza o estado do toggle "Selecionar Todos".
 */
export function updateSelectAllToggle() {
    const selectAllToggle = Elements.selectAllPlayersToggle();
    if (!selectAllToggle) return;

    const checkboxes = document.querySelectorAll('#players-list-container .player-checkbox');
    const checkedBoxes = document.querySelectorAll('#players-list-container .player-checkbox:checked');

    // Apenas atualiza o estado visual do toggle, sem alterar as seleções
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

