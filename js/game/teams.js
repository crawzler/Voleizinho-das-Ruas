// js/game/teams.js
// Lógica para geração e renderização de times.

import { getPlayers } from '../data/players.js';
import { shuffleArray } from '../utils/helpers.js';
import { loadConfig } from '../ui/config-ui.js';
import { renderTeams, renderScoringPagePlayers, updateTeamDisplayNamesAndColors } from '../ui/game-ui.js';
import { setAllGeneratedTeams, getAllGeneratedTeams, setCurrentTeam1, setCurrentTeam2, setActiveTeam1Name, setActiveTeam2Name, setActiveTeam1Color, setActiveTeam2Color } from './logic.js';
import { displayMessage } from '../ui/messages.js';

/**
 * Gera novos times com base nos jogadores selecionados.
 * @param {string} appId - O ID do aplicativo.
 */
export function generateTeams(appId) {
    // Log essencial removido: "[generateTeams] Iniciando geração de times."
    const players = getPlayers();
    const selectedPlayerElements = document.querySelectorAll('#players-list-container .player-checkbox:checked');
    const selectedPlayerIds = Array.from(selectedPlayerElements).map(checkbox => checkbox.dataset.playerId);

    const selectedPlayersNames = players
        .filter(player => selectedPlayerIds.includes(player.id))
        .map(player => player.name);

    if (selectedPlayersNames.length < 1) {
        displayMessage('Por favor, selecione pelo menos 1 jogador para gerar times.', 'info');
        return;
    }

    const shuffledPlayers = [...selectedPlayersNames];
    shuffleArray(shuffledPlayers);

    const config = loadConfig();
    const playersPerTeam = parseInt(config.playersPerTeam, 10) || 4;

    const generatedTeams = [];
    let teamIndex = 0;
    while (shuffledPlayers.length > 0) {
        const teamNameKey = `customTeam${teamIndex + 1}Name`;
        const teamDisplayName = config[teamNameKey] || `Time ${teamIndex + 1}`;
        
        const teamPlayers = shuffledPlayers.splice(0, playersPerTeam);
        generatedTeams.push({
            name: teamDisplayName,
            players: teamPlayers,
        });
        teamIndex++;
    }

    setAllGeneratedTeams(generatedTeams);
    displayMessage('Times gerados com sucesso!', 'success');
    renderTeams(generatedTeams);
}
