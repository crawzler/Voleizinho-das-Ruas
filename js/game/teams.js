// js/game/teams.js
// Lógica para geração e renderização de times.

import { getPlayers } from '../data/players.js';
import { shuffleArray } from '../utils/helpers.js';
import { loadConfig } from '../ui/config-ui.js';
import { renderTeams, renderScoringPagePlayers, updateTeamDisplayNamesAndColors } from '../ui/game-ui.js';
import { getCurrentTeam1, getCurrentTeam2, getActiveTeam1Name, getActiveTeam2Name, getActiveTeam1Color, getActiveTeam2Color, setAllGeneratedTeams } from './logic.js';
import { displayMessage } from '../ui/messages.js'; // Importa a função de exibição de mensagens

/**
 * Gera novos times com base nos jogadores selecionados.
 * @param {string} appId - O ID do aplicativo.
 */
export function generateTeams(appId) {
    console.log("[generateTeams] Iniciando geração de times.");
    const players = getPlayers(); // Obtém a lista atual de jogadores
    const selectedPlayerElements = document.querySelectorAll('#players-list-container .player-checkbox:checked');
    const selectedPlayerIds = Array.from(selectedPlayerElements).map(checkbox => checkbox.dataset.playerId);

    const selectedPlayersNames = players
        .filter(player => selectedPlayerIds.includes(player.id))
        .map(player => player.name);

    console.log("[generateTeams] Jogadores selecionados:", selectedPlayersNames);

    if (selectedPlayersNames.length < 1) {
        displayMessage('Por favor, selecione pelo menos 1 jogador para gerar times.', 'info');
        console.warn('Por favor, selecione pelo menos 1 jogador para gerar times.');
        return;
    }

    const shuffledPlayers = [...selectedPlayersNames];
    shuffleArray(shuffledPlayers);

    const config = loadConfig();
    const playersPerTeam = parseInt(config.playersPerTeam, 10) || 4; // Padrão para 4 se não configurado

    const generatedTeams = [];
    let teamIndex = 0;
    while (shuffledPlayers.length > 0) {
        const teamNameKey = `customTeam${teamIndex + 1}Name`;
        const teamDisplayName = config[teamNameKey] || `Time ${teamIndex + 1}`;
        
        const teamPlayers = shuffledPlayers.splice(0, playersPerTeam);
        generatedTeams.push({
            name: teamDisplayName,
            players: teamPlayers,
            // A cor será aplicada na renderização em game-ui.js
        });
        teamIndex++;
    }

    setAllGeneratedTeams(generatedTeams); // Salva os times gerados no estado global da lógica do jogo
    console.log("[generateTeams] Times gerados:", generatedTeams);
    displayMessage('Times gerados com sucesso!', 'success');
    renderTeams(generatedTeams); // Renderiza os times na UI
    console.log("[generateTeams] Função renderTeams chamada.");
}

/**
 * Abre o modal de seleção de time e renderiza os times gerados.
 * @param {string} panelId - O ID do painel de time que está a ser configurado ('team1-players-column' ou 'team2-players-column').
 */
export function openTeamSelectionModal(panelId) {
    selectingTeamPanelId = panelId;
    const allTeams = getAllGeneratedTeams(); // Obtém todos os times gerados
    const modalTeamList = document.getElementById('modal-team-list');

    if (!modalTeamList) return;

    modalTeamList.innerHTML = ''; // Limpa a lista existente

    if (allTeams.length === 0) {
        modalTeamList.innerHTML = '<p class="text-gray-400 text-center">Nenhum time gerado. Vá para a tela de Jogadores e gere alguns times.</p>';
        return;
    }

    allTeams.forEach((team, index) => {
        const teamItem = document.createElement('div');
        teamItem.className = 'team-list-item';
        teamItem.dataset.teamIndex = index; // Armazena o índice do time
        teamItem.innerHTML = `
            <h4 class="team-list-item-title">${team.name}</h4>
            <ul class="team-list-item-players">
                ${team.players.map(player => `<li>${player}</li>`).join('')}
            </ul>
        `;
        modalTeamList.appendChild(teamItem);
    });

    const teamSelectionModal = document.getElementById('team-selection-modal');
    if (teamSelectionModal) {
        teamSelectionModal.classList.add('active');
    }
}

/**
 * Fecha o modal de seleção de time.
 */
export function closeTeamSelectionModal() {
    const teamSelectionModal = document.getElementById('team-selection-modal');
    if (teamSelectionModal) {
        teamSelectionModal.classList.remove('active');
    }
    selectingTeamPanelId = null; // Limpa o ID do painel selecionado
}

/**
 * Seleciona um time para um painel específico (Time A ou Time B).
 * @param {string} panelId - O ID do painel de time ('team1-players-column' ou 'team2-players-column').
 * @param {number} teamIndex - O índice do time selecionado no array de times gerados.
 */
export function selectTeamForPanel(panelId, teamIndex) {
    const allTeams = getAllGeneratedTeams();
    const selectedTeamPlayers = allTeams[teamIndex] ? allTeams[teamIndex].players : [];
    const config = loadConfig();

    const teamNameKey = `customTeam${teamIndex + 1}Name`;
    const teamColorKey = `customTeam${teamIndex + 1}Color`;
    const defaultTeamName = `Time ${teamIndex + 1}`;
    const defaultTeamColor = (teamIndex % 2 === 0) ? '#325fda' : '#f03737';

    const selectedTeamName = config[teamNameKey] || defaultTeamName;
    const selectedTeamColor = config[teamColorKey] || defaultTeamColor;

    // Atualiza o estado dos times ativos na lógica do jogo
    if (panelId === 'team1-players-column') {
        renderScoringPagePlayers(selectedTeamPlayers, getCurrentTeam2());
        updateTeamDisplayNamesAndColors(selectedTeamName, getActiveTeam2Name(), selectedTeamColor, getActiveTeam2Color());
    } else if (panelId === 'team2-players-column') {
        renderScoringPagePlayers(getCurrentTeam1(), selectedTeamPlayers);
        updateTeamDisplayNamesAndColors(getActiveTeam1Name(), selectedTeamName, getActiveTeam1Color(), selectedTeamColor);
    }
    closeTeamSelectionModal();
}

