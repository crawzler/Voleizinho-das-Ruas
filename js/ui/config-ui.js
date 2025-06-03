// js/ui/config-ui.js
// Lógica de interface para a tela de configurações.

import * as Elements from './elements.js'; // Caminho corrigido
import { updateTeamDisplayNamesAndColors, renderScoringPagePlayers } from './game-ui.js'; // Caminho corrigido
import { getCurrentTeam1, getCurrentTeam2, getActiveTeam1Name, getActiveTeam2Name, getActiveTeam1Color, getActiveTeam2Color } from '../game/logic.js'; // Caminho corrigido


/**
 * Carrega as configurações salvas no localStorage e as aplica aos inputs.
 * @returns {Object} O objeto de configuração carregado.
 */
export function loadConfig() {
    try {
        const config = JSON.parse(localStorage.getItem('volleyballConfig')) || {};
        if (Elements.playersPerTeamInput) Elements.playersPerTeamInput.value = config.playersPerTeam ?? 4;
        if (Elements.pointsPerSetInput) Elements.pointsPerSetInput.value = config.pointsPerSet ?? 15;
        if (Elements.numberOfSetsInput) Elements.numberOfSetsInput.value = config.numberOfSets ?? 1;
        if (Elements.darkModeToggle) Elements.darkModeToggle.checked = config.darkMode ?? true;
        if (Elements.vibrationToggle) Elements.vibrationToggle.checked = config.vibration ?? true;
        if (Elements.displayPlayersToggle) Elements.displayPlayersToggle.checked = config.displayPlayers ?? true;

        Elements.customTeamInputs.forEach((input, index) => {
            if (input.name) input.name.value = config[`customTeam${index + 1}Name`] ?? `Time ${index + 1}`;
            // Cores padrão para os primeiros times, se não configuradas
            const defaultColors = ['#325fda', '#f03737', '#28a745', '#ffc107', '#6f42c1', '#17a2b8'];
            if (input.color) input.color.value = config[`customTeam${index + 1}Color`] ?? defaultColors[index];
        });

        // Aplica o modo escuro imediatamente
        if (config.darkMode) {
            document.body.classList.add('dark');
        } else {
            document.body.classList.remove('dark');
        }

        return config;
    } catch (e) {
        console.error('Erro ao carregar configurações:', e);
        return {};
    }
}

/**
 * Salva as configurações atuais no localStorage.
 */
export function saveConfig() {
    try {
        const config = {
            playersPerTeam: parseInt(Elements.playersPerTeamInput.value, 10),
            pointsPerSet: parseInt(Elements.pointsPerSetInput.value, 10),
            numberOfSets: parseInt(Elements.numberOfSetsInput.value, 10),
            darkMode: Elements.darkModeToggle.checked,
            vibration: Elements.vibrationToggle.checked,
            displayPlayers: Elements.displayPlayersToggle.checked,
        };

        Elements.customTeamInputs.forEach((input, index) => {
            config[`customTeam${index + 1}Name`] = input.name.value;
            config[`customTeam${index + 1}Color`] = input.color.value;
        });

        localStorage.setItem('volleyballConfig', JSON.stringify(config));
        console.log('Configurações salvas:', config);

        // Atualiza o modo escuro imediatamente
        if (config.darkMode) {
            document.body.classList.add('dark');
        } else {
            document.body.classList.remove('dark');
        }

        // Atualiza os nomes e cores dos times no placar
        const currentConfig = loadConfig(); // Carrega a config atualizada
        const team1Name = currentConfig.customTeam1Name || 'Time 1';
        const team1Color = currentConfig.customTeam1Color || '#325fda';
        const team2Name = currentConfig.customTeam2Name || 'Time 2';
        const team2Color = currentConfig.customTeam2Color || '#f03737';

        updateTeamDisplayNamesAndColors(team1Name, team2Name, team1Color, team2Color);
        renderScoringPagePlayers(getCurrentTeam1(), getCurrentTeam2());

    } catch (e) {
        console.error('Erro ao salvar configurações:', e);
    }
}

/**
 * Configura os event listeners para os inputs de configuração.
 */
export function setupConfigUI() {
    // Carrega as configurações ao iniciar a UI de configuração
    loadConfig();

    if (Elements.playersPerTeamInput) Elements.playersPerTeamInput.addEventListener('change', saveConfig);
    if (Elements.pointsPerSetInput) Elements.pointsPerSetInput.addEventListener('change', saveConfig);
    if (Elements.numberOfSetsInput) Elements.numberOfSetsInput.addEventListener('change', saveConfig);
    if (Elements.darkModeToggle) Elements.darkModeToggle.addEventListener('change', saveConfig);
    if (Elements.vibrationToggle) Elements.vibrationToggle.addEventListener('change', saveConfig);
    if (Elements.displayPlayersToggle) Elements.displayPlayersToggle.addEventListener('change', saveConfig);

    Elements.customTeamInputs.forEach(input => {
        if (input.name) input.name.addEventListener('change', saveConfig);
        if (input.color) input.color.addEventListener('change', saveConfig);
    });

    // Adiciona listener para o botão de reset de configurações
    if (Elements.resetConfigButton) {
        Elements.resetConfigButton.addEventListener('click', () => {
            localStorage.removeItem('volleyballConfig');
            loadConfig(); // Recarrega as configurações padrão
            console.log('Configurações resetadas para o padrão.');
        });
    }
}
