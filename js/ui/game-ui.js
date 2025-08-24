// js/ui/game-ui.js
// Lógica de interface para a tela de jogo (placares, timer, times).

import * as Elements from './elements.js';
import { formatTime } from '../utils/helpers.js';
import { getIsGameInProgress } from '../game/logic.js';
import { loadConfig } from './config-ui.js'; // Importa loadConfig para obter nomes e cores personalizados

/**
 * Atualiza o placar exibido na tela.
 * @param {number} team1Score - Pontuação do Time 1.
 * @param {number} team2Score - Pontuação do Time 2.
 */
let lastTeam1Score = null;
let lastTeam2Score = null;
export function updateScoreDisplay(team1Score, team2Score, skipAnimation = false) {
    const team1El = Elements.team1ScoreDisplay();
    const team2El = Elements.team2ScoreDisplay();

    if (team1El) {
        team1El.textContent = team1Score;
        team1El.classList.remove('score-animate-up', 'score-animate-down');
        void team1El.offsetWidth;
        if (!skipAnimation && lastTeam1Score !== null) {
            if (team1Score > lastTeam1Score) {
                team1El.classList.add('score-animate-up');
            } else if (team1Score < lastTeam1Score) {
                team1El.classList.add('score-animate-down');
            }
        }
        lastTeam1Score = team1Score;
    }
    if (team2El) {
        team2El.textContent = team2Score;
        team2El.classList.remove('score-animate-up', 'score-animate-down');
        void team2El.offsetWidth;
        if (!skipAnimation && lastTeam2Score !== null) {
            if (team2Score > lastTeam2Score) {
                team2El.classList.add('score-animate-up');
            } else if (team2Score < lastTeam2Score) {
                team2El.classList.add('score-animate-down');
            }
        }
        lastTeam2Score = team2Score;
    }
}

/**
 * Atualiza o display do timer geral.
 * @param {number} timeElapsed - Tempo total decorrido em segundos.
 */
export function updateTimerDisplay(timeElapsed) {
    if (Elements.timerText()) Elements.timerText().textContent = formatTime(timeElapsed);
}

/**
 * Atualiza o display do timer do set.
 * @param {number} setElapsedTime - Tempo decorrido no set atual em segundos.
 */
export function updateSetTimerDisplay(setElapsedTime) {
    if (Elements.setTimerText()) Elements.setTimerText().textContent = formatTime(setElapsedTime);
}

/**
 * Atualiza a exibição de sets vencidos (estrelas) para cada time.
 * @param {number} team1Sets - Número de sets vencidos pelo Time 1.
 * @param {number} team2Sets - Número de sets vencidos pelo Time 2.
 */
export function updateSetsDisplay(team1Sets, team2Sets) {
    const team1StarsContainer = Elements.team1Stars();
    const team2StarsContainer = Elements.team2Stars();

    if (!team1StarsContainer || !team2StarsContainer) {
        return;
    }

    const createStars = (count) => {
        let starsHtml = '';
        for (let i = 0; i < count; i++) {
            starsHtml += '<span class="material-icons star-icon">star</span>';
        }
        return starsHtml;
    };

    team1StarsContainer.innerHTML = createStars(team1Sets);
    team2StarsContainer.innerHTML = createStars(team2Sets);
}

/**
 * Renderiza os nomes dos jogadores para os times na página de pontuação.
 * @param {Array<string>} team1Players - Nomes dos jogadores do Time 1.
 * @param {Array<string>} team2Players - Nomes dos jogadores do Time 2.
 * @param {boolean} shouldDisplayPlayers - Se os jogadores devem ser exibidos.
 */
export function renderScoringPagePlayers(team1Players, team2Players, shouldDisplayPlayers) {
    const team1Column = Elements.team1PlayersColumn();
    const team2Column = Elements.team2PlayersColumn();

    if (!team1Column || !team2Column) {
        return;
    }

    // Sempre oculta se shouldDisplayPlayers for false
    if (!shouldDisplayPlayers) {
        team1Column.innerHTML = '';
        team2Column.innerHTML = '';
        team1Column.style.display = 'none';
        team2Column.style.display = 'none';
        return;
    }

    // Oculta se não há jogadores em nenhum time
    if (team1Players.length === 0 && team2Players.length === 0) {
        team1Column.innerHTML = '';
        team2Column.innerHTML = '';
        team1Column.style.display = 'none';
        team2Column.style.display = 'none';
        return;
    }

    team1Column.style.display = 'block';
    team2Column.style.display = 'block';

    const renderPlayers = (columnElement, playersArray, teamId) => {
        columnElement.innerHTML = '';
        
        const ul = document.createElement('ul');
        playersArray.forEach(player => {
            const li = document.createElement('li');
            li.textContent = player;
            ul.appendChild(li);
        });
        columnElement.appendChild(ul);
        
        // Adiciona botão no painel do time
        const teamPanel = document.getElementById(`${teamId}-panel`);
        if (teamPanel && !teamPanel.querySelector('.team-change-button')) {
            const changeButton = document.createElement('button');
            changeButton.id = `${teamId}-change-button`;
            changeButton.className = 'team-change-button';
            changeButton.innerHTML = '<span class="material-icons">swap_horiz</span>';
            changeButton.addEventListener('click', (event) => {
                event.stopPropagation();
                import('./pages.js').then(({ openTeamSelectionModal }) => {
                    openTeamSelectionModal(teamId);
                });
            });
            teamPanel.appendChild(changeButton);
        }
    };

    renderPlayers(team1Column, team1Players, 'team1');
    renderPlayers(team2Column, team2Players, 'team2');
}

/**
 * Atualiza os nomes e as cores dos times exibidos na UI.
 * @param {string} team1Name - Nome a ser exibido para o Time 1.
 * @param {string} team2Name - Nome a ser exibido para o Time 2.
 * @param {string} team1Color - Cor a ser exibida para o Time 1 (hex).
 * @param {string} team2Color - Cor a ser exibida para o Time 2 (hex).
 */
export function updateTeamDisplayNamesAndColors(team1Name, team2Name, team1Color, team2Color) {
    const team1NameElement = Elements.team1NameDisplay();
    const team2NameElement = Elements.team2NameDisplay();
    const team1PanelElement = Elements.team1Panel();
    const team2PanelElement = Elements.team2Panel();

    if (team1NameElement) {
        team1NameElement.textContent = team1Name;
    }

    if (team2NameElement) {
        team2NameElement.textContent = team2Name;
    }

    if (team1PanelElement) {
        team1PanelElement.style.backgroundColor = team1Color;
    }

    if (team2PanelElement) {
        team2PanelElement.style.backgroundColor = team2Color;
    }
}

/**
 * Atualiza o estado do botão de navegação "Pontuação" (Novo Jogo vs. Pontuação).
 * @param {boolean} isGameInProgress - Se um jogo está em andamento.
 * @param {string} currentPageId - O ID da página atualmente ativa.
 */
export function updateNavScoringButton(isGameInProgress, currentPageId) {
    const navScoringButtonElement = Elements.navScoringButton();
    if (navScoringButtonElement) {
        const iconSpan = navScoringButtonElement.querySelector('.material-icons');
        if (iconSpan) {
            if (isGameInProgress && currentPageId !== 'scoring-page') {
                navScoringButtonElement.innerHTML = `<span class="material-icons sidebar-nav-icon">sports_volleyball</span> Pontuação`;
            } else if (isGameInProgress && currentPageId === 'scoring-page') {
                navScoringButtonElement.innerHTML = `<span class="material-icons sidebar-nav-icon">add_box</span> Novo Jogo`;
            } else {
                navScoringButtonElement.innerHTML = `<span class="material-icons sidebar-nav-icon">sports_volleyball</span> Pontuação`;
            }
        }
    }
}

/**
 * Renderiza os times gerados na grade de times.
 * @param {Array<Object>} teams - Array de objetos de time.
 */
export function renderTeams(teams) {
    const teamsGridLayoutElement = Elements.teamsGridLayout();
    if (!teamsGridLayoutElement) return;

    teamsGridLayoutElement.innerHTML = '';

    const config = loadConfig();
    const defaultColors = ['#325fda', '#f03737', '#28a745', '#ffc107', '#6f42c1', '#17a2b8'];

    teams.forEach((team, index) => {
        const teamCard = document.createElement('div');
        teamCard.className = 'team-card';

        const teamNameKey = `customTeam${index + 1}Name`;
        const teamColorKey = `customTeam${index + 1}Color`;
        const defaultTeamName = `Time ${index + 1}`;
        const teamDisplayName = config[teamNameKey] || defaultTeamName;
        const teamDisplayColor = config[teamColorKey] || defaultColors[index] || '#6c757d';

        teamCard.style.borderLeft = `0.25rem solid ${teamDisplayColor}`;

        const teamTitle = document.createElement('h3');
        teamTitle.className = 'team-card-title';
        teamTitle.textContent = teamDisplayName;
        teamCard.appendChild(teamTitle);

        // NOVO: Ícone para preencher vagas do time (canto superior direito)
        const hasVacancy = team.players.some(p => typeof p === 'string' && p.startsWith('[Vaga'));
        if (hasVacancy) {
            if (!teamCard.style.position) teamCard.style.position = 'relative';
            const fillBtn = document.createElement('button');
            fillBtn.className = 'fill-team-button';
            fillBtn.title = 'Preencher vagas com jogadores aleatórios';
            fillBtn.innerHTML = '<span class="material-icons">group_add</span>';
            fillBtn.style.position = 'absolute';
            fillBtn.style.top = '8px';
            fillBtn.style.right = '8px';
            fillBtn.style.border = 'none';
            fillBtn.style.background = 'transparent';
            fillBtn.style.cursor = 'pointer';
            fillBtn.style.padding = '4px';
            fillBtn.style.borderRadius = '6px';
            fillBtn.style.color = '#666';
            fillBtn.addEventListener('mouseenter', () => { fillBtn.style.background = 'rgba(0,0,0,0.08)'; });
            fillBtn.addEventListener('mouseleave', () => { fillBtn.style.background = 'transparent'; });
            fillBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openOpponentSelect(index);
            });
            teamCard.appendChild(fillBtn);
        }

        const teamList = document.createElement('ul');
        teamList.className = 'team-card-list';
        team.players.forEach((player, playerIndex) => {
            const playerItem = document.createElement('li');
            playerItem.className = 'player-item';
            
            const playerName = document.createElement('span');
            const isEmptySlot = player.startsWith('[Vaga');
            
            if (isEmptySlot) {
                playerName.textContent = player;
                playerName.className = 'empty-slot';
                playerItem.classList.add('empty-slot-item');
            } else {
                playerName.textContent = player;
            }
            
            playerItem.appendChild(playerName);
            
            const substituteBtn = document.createElement('button');
            substituteBtn.className = 'substitute-btn';
            
            if (isEmptySlot) {
                substituteBtn.innerHTML = '+';
                substituteBtn.title = 'Adicionar jogador';
            } else {
                substituteBtn.innerHTML = '↔';
                substituteBtn.title = 'Substituir jogador';
            }
            
            substituteBtn.onclick = (e) => showSubstituteOptions(e, index, playerIndex, player);
            playerItem.appendChild(substituteBtn);
            
            teamList.appendChild(playerItem); 
        });
        teamCard.appendChild(teamList);

        teamsGridLayoutElement.appendChild(teamCard);
    });

    // Adiciona card para criar novo time
    const addTeamCard = document.createElement('div');
    addTeamCard.className = 'team-card add-team-card';
    addTeamCard.innerHTML = `
        <div class="add-team-content">
            <span class="material-icons add-team-icon">add</span>
            <span class="add-team-text">Adicionar Time</span>
        </div>
    `;
    addTeamCard.onclick = () => addNewTeam();
    teamsGridLayoutElement.appendChild(addTeamCard);
}

/**
 * Renderiza os times no modal de seleção.
 * @param {Array<Object>} teams - Array de objetos de time.
 * @param {string} panelId - O ID do painel de time ('team1' ou 'team2') que acionou o modal.
 * @param {function} selectTeamCallback - Função de callback a ser chamada quando um time é selecionado no modal.
 */
export function renderTeamsInModal(teams, panelId, selectTeamCallback) {
    const modalTeamListElement = Elements.modalTeamList();
    if (!modalTeamListElement) {
        return;
    }

    modalTeamListElement.innerHTML = '';

    const config = loadConfig();
    const defaultColors = ['#325fda', '#f03737', '#28a745', '#ffc107', '#6f42c1', '#17a2b8'];

    if (teams.length === 0) {
        const noTeamsMessage = document.createElement('p');
        noTeamsMessage.textContent = "Nenhum time gerado ainda. Vá para a página 'Times' para gerar alguns!";
        noTeamsMessage.style.color = '#D1D5DB';
        noTeamsMessage.style.textAlign = 'center';
        modalTeamListElement.appendChild(noTeamsMessage);
        return;
    }

    teams.forEach((team, index) => {
        const teamModalItem = document.createElement('div');
        teamModalItem.className = 'select-team-list-item';
        teamModalItem.dataset.teamIndex = index;

        const teamNameKey = `customTeam${index + 1}Name`;
        const teamColorKey = `customTeam${index + 1}Color`;
        const defaultTeamName = `Time ${index + 1}`;
        const teamDisplayName = config[teamNameKey] || defaultTeamName;
        const teamDisplayColor = config[teamColorKey] || defaultColors[index] || '#6c757d';

        const colorSpan = document.createElement('span');
        colorSpan.className = 'select-team-color-box';
        colorSpan.style.backgroundColor = teamDisplayColor;
        teamModalItem.appendChild(colorSpan);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'select-team-name';
        nameSpan.textContent = teamDisplayName;
        teamModalItem.appendChild(nameSpan);

        teamModalItem.addEventListener('click', () => {
            selectTeamCallback(index, panelId);
        });

        modalTeamListElement.appendChild(teamModalItem);
    });
}

/**
 * Anima a troca dos times de lado na tela de pontuação.
 */
export function animateSwapTeams() {
    const team1Panel = Elements.team1Panel && Elements.team1Panel();
    const team2Panel = Elements.team2Panel && Elements.team2Panel();
    if (team1Panel && team2Panel) {
        team1Panel.classList.remove('spin-swap-left', 'cross-advanced-left', 'cross-slide-left', 'cross-fade', 'gooey-cross-left');
        team2Panel.classList.remove('spin-swap-right', 'cross-advanced-right', 'cross-slide-right', 'cross-fade', 'gooey-cross-right');
        void team1Panel.offsetWidth;
        void team2Panel.offsetWidth;
        setTimeout(() => {
            team1Panel.classList.add('spin-swap-left');
            team2Panel.classList.add('spin-swap-right');
        }, 10);
        setTimeout(() => {
            team1Panel.classList.remove('spin-swap-left');
            team2Panel.classList.remove('spin-swap-right');
        }, 400);
    }
}

/**
 * Mostra o modal de substituição para um jogador.
 * @param {Event} event - O evento de clique.
 * @param {number} teamIndex - Índice do time.
 * @param {number} playerIndex - Índice do jogador no time.
 * @param {string} currentPlayer - Nome do jogador atual.
 */
window.showSubstituteOptions = function(event, teamIndex, playerIndex, currentPlayer) {
    event.stopPropagation();
    
    // Remove modal existente
    const existingModal = document.querySelector('.substitute-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Cria o modal
    const modal = document.createElement('div');
    modal.className = 'substitute-modal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'substitute-modal-content';
    
    // Cabeçalho do modal
    const header = document.createElement('div');
    header.className = 'substitute-modal-header';
    
    const title = document.createElement('h3');
    title.className = 'substitute-modal-title';
    
    if (currentPlayer.startsWith('[Vaga')) {
        title.textContent = `Preencher: ${currentPlayer}`;
    } else {
        title.textContent = `Substituir: ${currentPlayer}`;
    }
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'substitute-modal-close';
    closeBtn.setAttribute('aria-label', 'Fechar');
    closeBtn.innerHTML = '<span class="material-icons">close</span>';
    closeBtn.onclick = () => modal.remove();
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // Campo de busca
    const searchInput = document.createElement('input');
    searchInput.className = 'substitute-search';
    searchInput.type = 'text';
    searchInput.placeholder = 'Buscar jogador...';
    
    // Lista de jogadores
    const playersList = document.createElement('div');
    playersList.className = 'substitute-players-list';
    
    modalContent.appendChild(header);
    modalContent.appendChild(searchInput);
    modalContent.appendChild(playersList);
    modal.appendChild(modalContent);
    
    // Adiciona ao DOM
    document.body.appendChild(modal);
    
    // Carrega e renderiza jogadores
    loadPlayersForSubstitution(playersList, searchInput, teamIndex, playerIndex, currentPlayer);
    
    // Fecha modal ao clicar fora
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
    
    // Foca no campo de busca
    setTimeout(() => searchInput.focus(), 100);
};

/**
 * Carrega e renderiza jogadores para substituição.
 */
function loadPlayersForSubstitution(container, searchInput, teamIndex, playerIndex, currentPlayer) {
    import('../data/players.js').then(({ getPlayers }) => {
        import('../game/logic.js').then(({ getAllGeneratedTeams }) => {
            const allPlayers = getPlayers();
            const teams = getAllGeneratedTeams();
            
            // Mapeia jogadores em times
            const playersInTeams = new Map();
            teams.forEach((team, tIndex) => {
                team.players.forEach(player => {
                    playersInTeams.set(player, tIndex);
                });
            });
            
            function renderPlayers(filter = '') {
                container.innerHTML = '';
                
                const isCurrentPlayerEmptySlot = currentPlayer.startsWith('[Vaga');
                
                const filteredPlayers = allPlayers.filter(player => {
                    const matchesFilter = player.name.toLowerCase().includes(filter.toLowerCase());
                    
                    if (isCurrentPlayerEmptySlot) {
                        // Se é um espaço vazio, mostra todos os jogadores (exceto os já em times)
                        return matchesFilter;
                    } else {
                        // Se é um jogador real, não mostra ele mesmo
                        return matchesFilter && player.name !== currentPlayer;
                    }
                });
                
                if (filteredPlayers.length === 0) {
                    const noPlayers = document.createElement('div');
                    noPlayers.className = 'no-players-message';
                    noPlayers.textContent = 'Nenhum jogador encontrado';
                    container.appendChild(noPlayers);
                    return;
                }
                
                filteredPlayers.forEach(player => {
                    const item = document.createElement('div');
                    item.className = 'substitute-player-item';
                    
                    const name = document.createElement('span');
                    name.className = 'substitute-player-name';
                    name.textContent = player.name;
                    
                    const status = document.createElement('span');
                    status.className = 'substitute-player-status';
                    
                    const isInTeam = playersInTeams.has(player.name);
                    if (isInTeam) {
                        const teamIndex = playersInTeams.get(player.name);
                        const config = loadConfig();
                        const teamNameKey = `customTeam${teamIndex + 1}Name`;
                        const teamColorKey = `customTeam${teamIndex + 1}Color`;
                        const defaultColors = ['#325fda', '#f03737', '#28a745', '#ffc107', '#6f42c1', '#17a2b8'];
                        const teamDisplayName = config[teamNameKey] || `Time ${teamIndex + 1}`;
                        const teamDisplayColor = config[teamColorKey] || defaultColors[teamIndex] || '#6c757d';
                        
                        status.textContent = teamDisplayName;
                        status.classList.add('status-in-team');
                        status.style.setProperty('--team-color', teamDisplayColor);
                    } else {
                        status.textContent = 'Ausente';
                        status.classList.add('status-available');
                    }
                    
                    item.appendChild(name);
                    item.appendChild(status);
                    
                    item.onclick = () => {
                        performSubstitution(teamIndex, playerIndex, currentPlayer, player.name, isInTeam ? playersInTeams.get(player.name) : null);
                        document.querySelector('.substitute-modal').remove();
                    };
                    
                    container.appendChild(item);
                });
            }
            
            // Renderização inicial
            renderPlayers();
            
            // Busca em tempo real
            searchInput.oninput = (e) => renderPlayers(e.target.value);
        });
    });
}

/**
 * Executa a substituição com as regras definidas.
 */
function performSubstitution(teamIndex, playerIndex, oldPlayer, newPlayer, newPlayerTeamIndex) {
    import('../game/logic.js').then(({ getAllGeneratedTeams, setAllGeneratedTeams }) => {
        import('../utils/helpers.js').then(({ salvarTimesGerados }) => {
            import('./messages.js').then(({ displayMessage }) => {
                import('../ui/pages.js').then(({ updateSelectedPlayersCount }) => {
                    const teams = getAllGeneratedTeams();
                    const config = loadConfig();
                    const playersPerTeam = config.playersPerTeam || 4;
                    const isOldPlayerEmptySlot = oldPlayer.startsWith('[Vaga');
                    
                    if (newPlayerTeamIndex !== null) {
                        // Jogador já está em um time - trocar de lugar
                        const newPlayerIndex = teams[newPlayerTeamIndex].players.indexOf(newPlayer);
                        teams[teamIndex].players[playerIndex] = newPlayer;
                        
                        if (isOldPlayerEmptySlot) {
                            // Se era um espaço vazio, criar novo espaço vazio no lugar do jogador movido
                            teams[newPlayerTeamIndex].players[newPlayerIndex] = `[Vaga ${newPlayerIndex + 1}]`;
                            displayMessage(`${newPlayer} preencheu a vaga`, 'success');
                        } else {
                            teams[newPlayerTeamIndex].players[newPlayerIndex] = oldPlayer;
                            displayMessage(`${oldPlayer} trocou de lugar com ${newPlayer}`, 'success');
                        }
                    } else {
                        // Jogador não está em nenhum time
                        teams[teamIndex].players[playerIndex] = newPlayer;
                        
                        // Marcar jogador automaticamente na tela de jogadores
                        autoSelectPlayerInUI(newPlayer);
                        
                        if (isOldPlayerEmptySlot) {
                            // Era um espaço vazio, apenas preenche
                            displayMessage(`${newPlayer} preencheu a vaga`, 'success');
                        } else {
                            // Encontrar vaga para o jogador substituído
                            let placed = false;
                            
                            // Primeiro, procura por espaços vazios
                            for (let i = 0; i < teams.length; i++) {
                                for (let j = 0; j < teams[i].players.length; j++) {
                                    if (teams[i].players[j].startsWith('[Vaga')) {
                                        teams[i].players[j] = oldPlayer;
                                        placed = true;
                                        break;
                                    }
                                }
                                if (placed) break;
                            }
                            
                            // Se não encontrou espaço vazio, procura time com menos jogadores
                            if (!placed) {
                                for (let i = teams.length - 1; i >= 0; i--) {
                                    if (teams[i].players.length < playersPerTeam) {
                                        teams[i].players.push(oldPlayer);
                                        placed = true;
                                        break;
                                    }
                                }
                            }
                            
                            // Se não encontrou vaga, criar novo time
                            if (!placed) {
                                const newTeamIndex = teams.length;
                                const teamNameKey = `customTeam${newTeamIndex + 1}Name`;
                                const teamDisplayName = config[teamNameKey] || `Time ${newTeamIndex + 1}`;
                                
                                teams.push({
                                    name: teamDisplayName,
                                    players: [oldPlayer]
                                });
                                displayMessage(`${newPlayer} entrou no lugar de ${oldPlayer}. ${oldPlayer} foi para o ${teamDisplayName}`, 'success');
                            } else {
                                displayMessage(`${newPlayer} entrou no lugar de ${oldPlayer}`, 'success');
                            }
                        }
                    }
                    
                    // Salva e re-renderiza
                    setAllGeneratedTeams(teams);
                    salvarTimesGerados(teams);
                    renderTeams(teams);
                    updateSelectedPlayersCount();
                    
                    // Marcar jogador automaticamente se não era espaço vazio
                    if (!isOldPlayerEmptySlot) {
                        autoSelectPlayerInUI(newPlayer);
                    }
                });
            });
        });
    });
}

/**
 * Adiciona um novo time manualmente.
 */
function addNewTeam() {
    import('../game/logic.js').then(({ getAllGeneratedTeams, setAllGeneratedTeams }) => {
        import('../utils/helpers.js').then(({ salvarTimesGerados }) => {
            import('./messages.js').then(({ displayMessage }) => {
                const teams = getAllGeneratedTeams();
                const config = loadConfig();
                const playersPerTeam = config.playersPerTeam || 4;
                
                const newTeamIndex = teams.length;
                const teamNameKey = `customTeam${newTeamIndex + 1}Name`;
                const teamDisplayName = config[teamNameKey] || `Time ${newTeamIndex + 1}`;
                
                // Cria novo time com espaços vazios
                const newTeamPlayers = [];
                for (let i = 0; i < playersPerTeam; i++) {
                    newTeamPlayers.push(`[Vaga ${i + 1}]`);
                }
                
                teams.push({
                    name: teamDisplayName,
                    players: newTeamPlayers
                });
                
                setAllGeneratedTeams(teams);
                salvarTimesGerados(teams);
                renderTeams(teams);
                displayMessage(`${teamDisplayName} adicionado com sucesso!`, 'success');
            });
        });
    });
}

/**
 * Marca automaticamente um jogador na tela de jogadores quando ele é adicionado aos times.
 * @param {string} playerName - Nome do jogador a ser marcado
 */
function autoSelectPlayerInUI(playerName) {
    import('../data/players.js').then(({ getPlayers }) => {
        const allPlayers = getPlayers();
        const playerData = allPlayers.find(p => p.name === playerName);
        
        if (playerData) {
            const checkbox = document.querySelector(`input[data-player-id="${playerData.id}"]`);
            if (checkbox && !checkbox.checked) {
                checkbox.checked = true;
                
                // Salva o estado de seleção
                import('../ui/players-ui.js').then(({ savePlayerSelectionState, updatePlayerCount }) => {
                    savePlayerSelectionState();
                    updatePlayerCount();
                }).catch(() => {});
                
                import('./messages.js').then(({ displayMessage }) => {
                    displayMessage(`${playerName} foi marcado automaticamente na lista de jogadores`, 'info');
                }).catch(() => {});
            }
        }
    }).catch(() => {});
}

// NOVO: Selecionar adversário e preencher vagas com jogadores aleatórios
function openOpponentSelect(currentTeamIndex) {
    import('../game/logic.js').then(({ getAllGeneratedTeams }) => {
        const teams = getAllGeneratedTeams();
        if (!teams || teams.length < 2) return;

        const existing = document.querySelector('.opponent-select-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'opponent-select-modal substitute-modal';

        const content = document.createElement('div');
        content.className = 'substitute-modal-content';

        const header = document.createElement('div');
        header.className = 'substitute-modal-header';
        const title = document.createElement('h3');
        title.className = 'substitute-modal-title';
        title.textContent = 'Selecionar adversário';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'substitute-modal-close';
        closeBtn.innerHTML = '<span class="material-icons">close</span>';
        closeBtn.onclick = () => modal.remove();
        header.appendChild(title);
        header.appendChild(closeBtn);

        const helperText = document.createElement('p');
        helperText.style.margin = '0 0 8px 0';
        helperText.style.fontSize = '0.9rem';
        helperText.style.opacity = '0.8';
        helperText.textContent = 'Selecione os o time adiversário, para que possa preencher o time com jogadores aleatórios disponíveis.';

        const list = document.createElement('div');
        list.className = 'substitute-players-list';

        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.justifyContent = 'flex-end';
        footer.style.gap = '8px';
        footer.style.marginTop = '8px';

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'button button--primary';
        confirmBtn.textContent = 'Confirmar preenchimento';
        confirmBtn.disabled = true;

        let selectedIdx = null;

        const config = loadConfig();
        const defaultColors = ['#325fda', '#f03737', '#28a745', '#ffc107', '#6f42c1', '#17a2b8'];

        teams.forEach((t, idx) => {
            if (idx === currentTeamIndex) return;
            const item = document.createElement('div');
            item.className = 'substitute-player-item';

            const name = document.createElement('span');
            name.className = 'substitute-player-name';
            const teamNameKey = `customTeam${idx + 1}Name`;
            const teamColorKey = `customTeam${idx + 1}Color`;
            const nameText = config[teamNameKey] || `Time ${idx + 1}`;
            const color = config[teamColorKey] || defaultColors[idx] || '#6c757d';
            name.textContent = nameText;

            const status = document.createElement('span');
            status.className = 'substitute-player-status status-in-team';
            status.textContent = 'Adversário';
            status.style.setProperty('--team-color', color);

            item.appendChild(name);
            item.appendChild(status);
            item.onclick = () => {
                selectedIdx = idx;
                confirmBtn.disabled = false;
                // marca visualmente selecionado
                list.querySelectorAll('.substitute-player-item.selected')?.forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
            };

            list.appendChild(item);
        });

        confirmBtn.onclick = () => {
            if (selectedIdx === null) return;
            fillTeamFromOthers(currentTeamIndex, selectedIdx);
            modal.remove();
        };

        footer.appendChild(confirmBtn);

        content.appendChild(header);
        content.appendChild(helperText);
        content.appendChild(list);
        content.appendChild(footer);
        modal.appendChild(content);
        document.body.appendChild(modal);

        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    });
}

function fillTeamFromOthers(currentTeamIndex, opponentIndex) {
    import('../game/logic.js').then(({ getAllGeneratedTeams, setAllGeneratedTeams }) => {
        import('../utils/helpers.js').then(({ salvarTimesGerados, shuffleArray }) => {
            import('./messages.js').then(({ displayMessage }) => {
                const teams = getAllGeneratedTeams();
                if (!teams || teams.length === 0) return;

                const currentTeam = teams[currentTeamIndex];
                const vacancies = [];
                for (let i = 0; i < currentTeam.players.length; i++) {
                    if (typeof currentTeam.players[i] === 'string' && currentTeam.players[i].startsWith('[Vaga')) {
                        vacancies.push(i);
                    }
                }
                if (vacancies.length === 0) {
                    displayMessage('Este time não possui vagas.', 'info');
                    return;
                }

                // Coletar candidatos de outros times (exclui atual e adversário), como pares {name, teamIndex, playerIndex}
                const pool = [];
                for (let t = 0; t < teams.length; t++) {
                    if (t === currentTeamIndex || t === opponentIndex) continue;
                    for (let p = 0; p < teams[t].players.length; p++) {
                        const name = teams[t].players[p];
                        if (typeof name === 'string' && !name.startsWith('[Vaga')) {
                            pool.push({ name, teamIndex: t, playerIndex: p });
                        }
                    }
                }

                if (pool.length === 0) {
                    displayMessage('Não há jogadores disponíveis nos outros times.', 'warning');
                    return;
                }

                // Embaralhar a pool para garantir aleatoriedade real
                try { shuffleArray(pool); } catch (_) {
                    for (let i = pool.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [pool[i], pool[j]] = [pool[j], pool[i]];
                    }
                }

                let filled = 0;
                let poolIdx = 0;
                for (let i = 0; i < vacancies.length && poolIdx < pool.length; i++) {
                    const slotIndex = vacancies[i];
                    const cand = pool[poolIdx++];
                    // Remove do time de origem e abre vaga
                    teams[cand.teamIndex].players[cand.playerIndex] = `[Vaga ${cand.playerIndex + 1}]`;
                    // Adiciona no time atual
                    currentTeam.players[slotIndex] = cand.name;
                    filled++;
                }

                if (filled > 0) {
                    setAllGeneratedTeams(teams);
                    salvarTimesGerados(teams);
                    renderTeams(teams);
                    displayMessage(`${filled} vaga(s) preenchida(s) com jogadores aleatórios!`, 'success');
                } else {
                    displayMessage('Não foi possível preencher as vagas.', 'warning');
                }
            });
        });
    });
}
