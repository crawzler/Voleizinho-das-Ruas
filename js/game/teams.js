// js/game/teams.js
// Lógica para geração e renderização de times.

import { getPlayers } from '../data/players.js';
import { shuffleArray } from '../utils/helpers.js';
import { loadConfig } from '../ui/config-ui.js';
import { renderTeams, renderScoringPagePlayers, updateTeamDisplayNamesAndColors } from '../ui/game-ui.js';
import { getCurrentTeam1, getCurrentTeam2, getActiveTeam1Name, getActiveTeam2Name, getActiveTeam1Color, getActiveTeam2Color, setAllGeneratedTeams } from './logic.js';


/**
 * Gera novos times com base nos jogadores selecionados.
 * @param {string} appId - O ID do aplicativo.
 */
export function generateTeams(appId) {
    const players = getPlayers(); // Obtém a lista atual de jogadores
    const selectedPlayerElements = document.querySelectorAll('#players-list-container .player-checkbox:checked');
    const selectedPlayerIds = Array.from(selectedPlayerElements).map(checkbox => checkbox.dataset.playerId);

    const selectedPlayersNames = players
        .filter(player => selectedPlayerIds.includes(player.id))
        .map(player => player.name);

    if (selectedPlayersNames.length < 1) {
        console.warn('Por favor, selecione pelo menos 1 jogador para gerar times.');
        return;
    }

    const shuffledPlayers = [...selectedPlayersNames];
    shuffleArray(shuffledPlayers);

    const config = loadConfig();
    const playersPerTeam = parseInt(config.playersPerTeam) || 4;

    const newGeneratedTeams = [];
    let teamCount = 0;
    for (let i = 0; i < shuffledPlayers.length; i++) {
        if (i % playersPerTeam === 0) {
            newGeneratedTeams.push([]);
            teamCount++;
        }
        newGeneratedTeams[teamCount - 1].push(shuffledPlayers[i]);
    }

    setAllGeneratedTeams(newGeneratedTeams); // Atualiza o estado global de times gerados

    const configLoaded = loadConfig();
    const team1Name = configLoaded[`customTeam1Name`] || `Time 1`;
    const team1Color = configLoaded[`customTeam1Color`] || '#325fda';
    const team2Name = configLoaded[`customTeam2Name`] || `Time 2`;
    const team2Color = configLoaded[`customTeam2Color`] || '#f03737';

    // Chama a função de UI para renderizar os times
    const teamsGridLayout = document.getElementById('teams-grid-layout');
    if (teamsGridLayout) {
        renderTeams(newGeneratedTeams, teamsGridLayout);
    }
    renderScoringPagePlayers(getCurrentTeam1(), getCurrentTeam2());
    updateTeamDisplayNamesAndColors(getActiveTeam1Name(), getActiveTeam2Name(), getActiveTeam1Color(), getActiveTeam2Color());
}

/**
 * Abre o modal de seleção de time.
 * @param {string} panelId - O ID do painel do time que está sendo selecionado ('team1-players-column' ou 'team2-players-column').
 */
export function openTeamSelectionModal(panelId) {
    const teamSelectionModal = document.getElementById('team-selection-modal');
    const modalTeamList = document.getElementById('modal-team-list');
    const allGeneratedTeams = getAllGeneratedTeams(); // Obtém os times gerados

    if (!teamSelectionModal || !modalTeamList) return;

    modalTeamList.innerHTML = '';

    if (allGeneratedTeams.length === 0) {
        const noTeamsMessage = document.createElement('li');
        noTeamsMessage.textContent = 'Nenhum time gerado ainda. Vá para a tela "Times" para gerar.';
        noTeamsMessage.style.padding = '10px';
        noTeamsMessage.style.color = '#9CA3AF';
        modalTeamList.appendChild(noTeamsMessage);
    } else {
        const config = loadConfig();

        allGeneratedTeams.forEach((team, index) => {
            const teamNameKey = `customTeam${index + 1}Name`;
            const teamColorKey = `customTeam${index + 1}Color`;
            const defaultTeamName = `Time ${index + 1}`;
            const defaultTeamColor = (index % 2 === 0) ? '#325fda' : '#f03737';

            const teamDisplayName = config[teamNameKey] || defaultTeamName;
            const teamDisplayColor = config[teamColorKey] || defaultTeamColor;

            const listItem = document.createElement('li');
            listItem.classList.add('modal-team-item');
            listItem.dataset.teamIndex = index;

            listItem.innerHTML = `
                <span class="modal-team-item-name">${teamDisplayName}</span>
                <div class="modal-team-item-color-box" style="background-color: ${teamDisplayColor};"></div>
            `;
            
            listItem.addEventListener('click', () => selectTeamFromModal(index, panelId)); // Passa panelId
            modalTeamList.appendChild(listItem);
        });
    }
    teamSelectionModal.style.display = 'flex';
}

/**
 * Fecha o modal de seleção de time.
 */
export function closeTeamSelectionModal() {
    const teamSelectionModal = document.getElementById('team-selection-modal');
    if (teamSelectionModal) {
        teamSelectionModal.style.display = 'none';
    }
}

/**
 * Seleciona um time do modal e o atribui a um painel.
 * @param {number} teamIndex - O índice do time selecionado.
 * @param {string} panelId - O ID do painel do time a ser atualizado.
 */
function selectTeamFromModal(teamIndex, panelId) {
    const allGeneratedTeams = getAllGeneratedTeams();
    const selectedTeamPlayers = allGeneratedTeams[teamIndex] || [];
    const config = loadConfig();

    const teamNameKey = `customTeam${teamIndex + 1}Name`;
    const teamColorKey = `customTeam${teamIndex + 1}Color`;
    const defaultTeamName = `Time ${teamIndex + 1}`;
    const defaultTeamColor = (teamIndex % 2 === 0) ? '#325fda' : '#f03737';

    const selectedTeamName = config[teamNameKey] || defaultTeamName;
    const selectedTeamColor = config[teamColorKey] || defaultTeamColor;

    // Atualiza o estado dos times ativos na lógica do jogo
    if (panelId === 'team1-players-column') {
        // Isso é um pouco complicado. Idealmente, teríamos setters para currentTeam1/2 e activeTeam1/2Name/Color
        // Por simplicidade e para evitar refatorar game/logic.js profundamente agora:
        // A lógica de game-logic.js precisa ser capaz de receber esses updates.
        // Por enquanto, vamos apenas renderizar e atualizar a UI.
        // Em uma refatoração mais profunda, game/logic.js teria setters para estes estados.
        renderScoringPagePlayers(selectedTeamPlayers, getCurrentTeam2());
        updateTeamDisplayNamesAndColors(selectedTeamName, getActiveTeam2Name(), selectedTeamColor, getActiveTeam2Color());
    } else if (panelId === 'team2-players-column') {
        renderScoringPagePlayers(getCurrentTeam1(), selectedTeamPlayers);
        updateTeamDisplayNamesAndColors(getActiveTeam1Name(), selectedTeamName, getActiveTeam1Color(), selectedTeamColor);
    }

    closeTeamSelectionModal();
}
