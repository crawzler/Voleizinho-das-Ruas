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
