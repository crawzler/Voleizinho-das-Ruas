// js/game/teams.js
// Lógica para geração e renderização de times.

import { getPlayers } from '../data/players.js';
import { shuffleArray, salvarTimesGerados } from '../utils/helpers.js';
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
    
    // Obter jogadores selecionados de TODAS as categorias, não apenas os visíveis
    const allSelectedIds = [];
    ['principais', 'esporadicos', 'random'].forEach(category => {
        const categorySelections = localStorage.getItem(`selectedPlayers_${category}`);
        if (categorySelections) {
            const ids = JSON.parse(categorySelections);
            allSelectedIds.push(...ids);
        }
    });

    const selectedPlayersNames = players
        .filter(player => allSelectedIds.includes(player.id))
        .map(player => player.name);

    if (selectedPlayersNames.length < 1) {
        displayMessage('Por favor, selecione pelo menos 1 jogador para gerar times.', 'info');
        return;
    }

    const shuffledPlayers = [...selectedPlayersNames];
    shuffleArray(shuffledPlayers);

    // Pegar valor do campo na tela de times, se disponível
    const playersPerTeamInput = document.getElementById('players-per-team-input');
    const playersPerTeam = playersPerTeamInput ? parseInt(playersPerTeamInput.value, 10) || 4 : 4;

    // Carrega as configurações para obter os nomes dos times
    const config = loadConfig();

    const generatedTeams = [];
    let teamIndex = 0;
    while (shuffledPlayers.length > 0) {
        const teamNameKey = `customTeam${teamIndex + 1}Name`;
        const teamDisplayName = config[teamNameKey] || `Time ${teamIndex + 1}`;
        
        const teamPlayers = shuffledPlayers.splice(0, playersPerTeam);
        
        // Se é o último time e tem menos jogadores que o especificado, adiciona espaços vazios
        if (shuffledPlayers.length === 0 && teamPlayers.length < playersPerTeam) {
            const emptySlots = playersPerTeam - teamPlayers.length;
            for (let i = 0; i < emptySlots; i++) {
                teamPlayers.push(`[Vaga ${i + 1}]`);
            }
        }
        
        generatedTeams.push({
            name: teamDisplayName,
            players: teamPlayers,
            createdAt: Date.now()
        });
        teamIndex++;
    }

    setAllGeneratedTeams(generatedTeams);
    salvarTimesGerados(generatedTeams);
    displayMessage('Times gerados com sucesso!', 'success');
    renderTeams(generatedTeams);
}
