// js/ui/game-ui.js
// Lógica de interface para a tela de jogo (placares, timer, times).

import * as Elements from './elements.js';
import { formatTime } from '../utils/helpers.js';
import { getIsGameInProgress } from '../game/logic.js';
import { loadConfig } from './config-ui.js'; // Importa loadConfig para obter nomes e cores personalizados

function closeAllDropdowns(except = null) {
    const dropdowns = document.querySelectorAll('.substitute-dropdown');
    dropdowns.forEach(dropdown => {
        if (dropdown !== except) dropdown.classList.remove('show');
    });
}

// Fecha dropdowns ao clicar fora
document.addEventListener('click', (e) => {
    // Se clicou dentro de um container de substituição, não fecha
    if (e.target.closest('.substitute-container')) return;
    closeAllDropdowns();
});

function removePlayerFromTeam(teamIndex, playerIndex) {
    import('../game/logic.js').then(({ getAllGeneratedTeams, setAllGeneratedTeams }) => {
        import('../utils/helpers.js').then(({ salvarTimesGerados }) => {
            import('./messages.js').then(({ displayMessage }) => {
                import('./players-ui.js').then(({ unselectPlayerInUI }) => {
                    const teams = getAllGeneratedTeams();
                    const player = teams[teamIndex].players[playerIndex];
                    teams[teamIndex].players.splice(playerIndex, 1);
                    
                    // Adiciona uma vaga na lista de jogadores
                    teams[teamIndex].players.push(`[Vaga ${teams[teamIndex].players.length + 1}]`);

                    setAllGeneratedTeams(teams);
                    salvarTimesGerados(teams);
                    renderTeams(teams);

                    // Limpa times vazios (exceto recém-criados)
                    pruneEmptyTeamsExceptNewlyCreated();

                    displayMessage(`${player} removido do time.`, 'success');
                    
                    // Atualiza o drawer dos jogadores
                    if (window.updateDrawerContent) {
                        window.updateDrawerContent();
                    }

                    // Desmarca o jogador na tela de jogadores
                    if (player && !player.startsWith('[Vaga')) {
                        unselectPlayerInUI(player);
                    }
                }).catch(err => console.error('Failed to load players-ui module', err));
            });
        });
    });
}

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
 * Renderiza os times na UI principal dos times, incluindo botões e interações.
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
            fillBtn.style.boxShadow = 'none';
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
                
                // Adiciona badge de role se for jogador Google
                setTimeout(() => {
                    const allPlayers = JSON.parse(localStorage.getItem('volleyballPlayers') || '[]');
                    const playerData = allPlayers.find(p => p.name === player && !p.isManual && p.uid);
                    if (playerData) {
                        import('./users.js').then(({ createRoleBadge }) => {
                            createRoleBadge(playerData.uid).then(badge => {
                                if (badge) {
                                    playerName.innerHTML = player + badge;
                                }
                            }).catch(() => {});
                        }).catch(() => {});
                    }
                }, 100);
            }
            
            playerItem.appendChild(playerName);
            
            const substituteContainer = document.createElement('div');
            substituteContainer.className = 'substitute-container';

            const substituteBtn = document.createElement('button');
            substituteBtn.className = 'substitute-btn';

            if (isEmptySlot) {
                substituteBtn.innerHTML = '<span class="material-icons">add</span>';
                substituteBtn.title = 'Adicionar jogador';
                substituteBtn.onclick = (e) => showSubstituteOptions(e, index, playerIndex, player);
                substituteContainer.appendChild(substituteBtn);
            } else {
                substituteBtn.innerHTML = '<span class="material-icons">more_vert</span>';
                substituteBtn.title = 'Opções';

                const dropdown = document.createElement('div');
                dropdown.className = 'substitute-dropdown';

                const substituteOption = document.createElement('div');
                substituteOption.className = 'substitute-option';
                substituteOption.textContent = 'Substituir';
                substituteOption.onclick = (e) => {
                    e.stopPropagation();
                    showSubstituteOptions(e, index, playerIndex, player);
                    dropdown.classList.remove('show');
                };

                const removeOption = document.createElement('div');
                removeOption.className = 'substitute-option';
                removeOption.textContent = 'Remover';
                removeOption.onclick = (e) => {
                    e.stopPropagation();
                    removePlayerFromTeam(index, playerIndex);
                    dropdown.classList.remove('show');
                };

                dropdown.appendChild(substituteOption);
                dropdown.appendChild(removeOption);
                substituteContainer.appendChild(dropdown);

                substituteBtn.onclick = (e) => {
                    e.stopPropagation();
                    // fecha outros, exceto este
                    closeAllDropdowns(dropdown);
                    dropdown.classList.toggle('show');
                };
            }
            
            substituteContainer.appendChild(substituteBtn);
            playerItem.appendChild(substituteContainer);
            
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
                    
                    // Adiciona badge de role se necessário
                    if (!player.isManual && player.uid) {
                        import('./users.js').then(({ createRoleBadge }) => {
                            createRoleBadge(player.uid).then(badge => {
                                if (badge) {
                                    name.innerHTML = player.name + badge;
                                }
                            });
                        }).catch(() => {});
                    }
                    
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
                                    players: [oldPlayer],
                                    createdAt: Date.now()
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
                    
                    // Limpar times vazios após mudanças
                    pruneEmptyTeamsExceptNewlyCreated();

                    updateSelectedPlayersCount();
                    
                    // Atualiza o drawer dos jogadores
                    if (window.updateDrawerContent) {
                        window.updateDrawerContent();
                    }
                    
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
                    players: newTeamPlayers,
                    createdAt: Date.now()
                });
                
                setAllGeneratedTeams(teams);
                salvarTimesGerados(teams);
                renderTeams(teams);
                displayMessage(`${teamDisplayName} adicionado com sucesso!`, 'success');
                
                // Atualiza o drawer dos jogadores
                if (window.updateDrawerContent) {
                    window.updateDrawerContent();
                }
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
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');

        const content = document.createElement('div');
        content.className = 'substitute-modal-content';

        const header = document.createElement('div');
        header.className = 'substitute-modal-header';
        const title = document.createElement('h3');
        title.className = 'substitute-modal-title';
        title.id = 'opponent-modal-title';
        title.textContent = 'Selecionar adversário';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'substitute-modal-close';
        closeBtn.setAttribute('aria-label', 'Fechar');
        closeBtn.innerHTML = '<span class="material-icons">close</span>';
        closeBtn.onclick = () => modal.remove();
        header.appendChild(title);
        header.appendChild(closeBtn);

        const helperText = document.createElement('p');
        helperText.style.margin = '0 0 12px 0';
        helperText.style.fontSize = '0.95rem';
        helperText.style.opacity = '0.85';
        helperText.textContent = 'Escolha um time adversário para preencher as vagas com jogadores disponíveis.';

        const list = document.createElement('div');
        list.className = 'opponent-list';
        list.setAttribute('role', 'list');

        const footer = document.createElement('div');
        footer.className = 'modal-actions';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'button';
        cancelBtn.type = 'button';
        cancelBtn.textContent = 'Cancelar';
        cancelBtn.addEventListener('click', () => modal.remove());

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'button button--primary';
        confirmBtn.type = 'button';
        confirmBtn.textContent = 'Confirmar';
        confirmBtn.disabled = true;

        let selectedIdx = null;

        const config = loadConfig();
        const defaultColors = ['#325fda', '#f03737', '#28a745', '#ffc107', '#6f42c1', '#17a2b8'];

        teams.forEach((t, idx) => {
            if (idx === currentTeamIndex) return;

            const teamNameKey = `customTeam${idx + 1}Name`;
            const teamColorKey = `customTeam${idx + 1}Color`;
            const nameText = config[teamNameKey] || `Time ${idx + 1}`;
            const color = config[teamColorKey] || defaultColors[idx] || '#6c757d';

            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'opponent-card';
            item.setAttribute('role', 'listitem');
            item.style.setProperty('--team-color', color);
            item.dataset.index = String(idx);
            item.setAttribute('aria-pressed', 'false');

            const left = document.createElement('div');
            left.className = 'opponent-card-left';

            const dot = document.createElement('span');
            dot.className = 'opponent-color-dot';

            const name = document.createElement('span');
            name.className = 'opponent-name';
            name.textContent = nameText;

            left.appendChild(dot);
            left.appendChild(name);

            const check = document.createElement('span');
            check.className = 'opponent-check';
            check.innerHTML = '<span class="material-icons">check_circle</span>';

            item.appendChild(left);
            item.appendChild(check);

            item.addEventListener('click', () => {
                selectedIdx = idx;
                confirmBtn.disabled = false;
                list.querySelectorAll('.opponent-card.selected').forEach(el => {
                    el.classList.remove('selected');
                    el.setAttribute('aria-pressed', 'false');
                });
                item.classList.add('selected');
                item.setAttribute('aria-pressed', 'true');
            });

            list.appendChild(item);
        });

        confirmBtn.onclick = () => {
            if (selectedIdx === null) return;
            fillTeamFromOthers(currentTeamIndex, selectedIdx);
            modal.remove();
        };

        footer.appendChild(cancelBtn);
        footer.appendChild(confirmBtn);

        content.appendChild(header);
        content.appendChild(helperText);
        content.appendChild(list);
        content.appendChild(footer);
        modal.appendChild(content);
        document.body.appendChild(modal);

        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        // Foco inicial no primeiro card para melhor usabilidade
        const firstCard = list.querySelector('.opponent-card');
        if (firstCard) firstCard.focus();
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
                    
                    // Atualiza o drawer dos jogadores
                    if (window.updateDrawerContent) {
                        window.updateDrawerContent();
                    }
                } else {
                    displayMessage('Não foi possível preencher as vagas.', 'warning');
                }
            });
        });
    });
}

export function pruneEmptyTeamsExceptNewlyCreated(graceMs = 10000) {
    try {
        const now = Date.now();
        import('../game/logic.js').then(({ getAllGeneratedTeams, setAllGeneratedTeams }) => {
            import('../utils/helpers.js').then(({ salvarTimesGerados }) => {
                const teams = getAllGeneratedTeams() || [];
                const filtered = teams.filter(team => {
                    if (!team) return false;
                    const players = Array.isArray(team.players) ? team.players : [];
                    const createdAt = typeof team.createdAt === 'number' ? team.createdAt : 0;
                    const withinGrace = (now - createdAt) < graceMs;

                    const isEmpty = players.length === 0 || players.every(p => typeof p === 'string' && p.startsWith('[Vaga'));

                    // Mantém se não está vazio OU está dentro da carência
                    return !isEmpty || withinGrace;
                });

                if (filtered.length !== teams.length) {
                    setAllGeneratedTeams(filtered);
                    salvarTimesGerados(filtered);
                    // Re-renderiza os times após a limpeza
                    renderTeams(filtered);
                }
            }).catch(() => {});
        }).catch(() => {});
    } catch (_) {
        // Silencia erros não-críticos
    }
}

export function renderScoringPagePlayers(team1 = [], team2 = [], shouldDisplayPlayers = true) {
    const col1 = Elements.team1PlayersColumn && Elements.team1PlayersColumn();
    const col2 = Elements.team2PlayersColumn && Elements.team2PlayersColumn();
    if (!col1 || !col2) return;

    // Controle de visibilidade
    if (!shouldDisplayPlayers) {
        col1.innerHTML = '';
        col2.innerHTML = '';
        col1.style.display = 'none';
        col2.style.display = 'none';
        return;
    }
    col1.style.display = '';
    col2.style.display = '';

    const makeList = (arr) => {
        if (!Array.isArray(arr) || arr.length === 0) {
            return '<ul class="players-list"><li class="player-item empty">Sem jogadores</li></ul>';
        }
        const items = arr.map(name => {
            const isEmpty = typeof name === 'string' && name.startsWith('[Vaga');
            const safeName = (name ?? '').toString();
            return `<li class="player-item ${isEmpty ? 'empty-slot-item' : ''}"><span class="${isEmpty ? 'empty-slot' : ''}">${safeName}</span></li>`;
        }).join('');
        return `<ul class="players-list">${items}</ul>`;
    };

    col1.innerHTML = makeList(team1);
    col2.innerHTML = makeList(team2);
    
    // Atualiza o drawer dos jogadores quando os times são renderizados
    if (window.updateDrawerContent) {
        window.updateDrawerContent();
    }
}

export function updateTeamDisplayNamesAndColors(team1Name, team2Name, team1Color, team2Color) {
    try {
        const cfg = loadConfig?.() || {};
        const name1 = (typeof team1Name === 'string' && team1Name.length) ? team1Name : (cfg.customTeam1Name || 'Time 1');
        const name2 = (typeof team2Name === 'string' && team2Name.length) ? team2Name : (cfg.customTeam2Name || 'Time 2');
        const color1 = (typeof team1Color === 'string' && team1Color.length) ? team1Color : (cfg.customTeam1Color || '#325fda');
        const color2 = (typeof team2Color === 'string' && team2Color.length) ? team2Color : (cfg.customTeam2Color || '#f03737');

        const team1NameEl = Elements.team1NameDisplay?.();
        const team2NameEl = Elements.team2NameDisplay?.();
        if (team1NameEl) team1NameEl.textContent = name1;
        if (team2NameEl) team2NameEl.textContent = name2;

        const team1PanelEl = Elements.team1Panel?.();
        const team2PanelEl = Elements.team2Panel?.();
        if (team1PanelEl) team1PanelEl.style.backgroundColor = color1;
        if (team2PanelEl) team2PanelEl.style.backgroundColor = color2;
    } catch (_) {
        // Silencia erros para não quebrar a UI em casos de init parcial
    }
}

export function updateNavScoringButton(isGameInProgress, currentPageId) {
    try {
        const btn = Elements.navScoringButton?.();
        if (!btn) return;
        // Determina se a página de pontuação está ativa
        const scoringActiveByParam = currentPageId === 'scoring-page';
        const scoringActiveByDom = document.getElementById('scoring-page')?.classList.contains('app-page--active');
        const isScoringActive = scoringActiveByParam || !!scoringActiveByDom;

        if (isGameInProgress && isScoringActive) {
            btn.innerHTML = '<span class="material-icons sidebar-nav-icon">add_circle</span> Novo Jogo';
        } else {
            btn.innerHTML = '<span class="material-icons sidebar-nav-icon">sports_volleyball</span> Pontuação';
        }
    } catch (_) {
        // Evita erros de inicialização
    }
}
