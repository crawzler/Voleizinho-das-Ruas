// js/ui/config-ui.js
// Lógica de interface para a tela de configurações.

import * as Elements from './elements.js';
import { updateTeamDisplayNamesAndColors, renderScoringPagePlayers } from './game-ui.js';
import { getCurrentTeam1, getCurrentTeam2, getActiveTeam1Name, getActiveTeam2Name, getActiveTeam1Color, getActiveTeam2Color } from '../game/logic.js';


/**
 * Carrega as configurações salvas no localStorage e as aplica aos inputs.
 * @returns {Object} O objeto de configuração carregado.
 */
export function loadConfig() {
    try {
        const config = JSON.parse(localStorage.getItem('volleyballConfig')) || {};
        if (Elements.playersPerTeamInput()) Elements.playersPerTeamInput().value = config.playersPerTeam ?? 4;
        if (Elements.pointsPerSetInput()) Elements.pointsPerSetInput().value = config.pointsPerSet ?? 15;
        if (Elements.numberOfSetsInput()) Elements.numberOfSetsInput().value = config.numberOfSets ?? 1;
        if (Elements.darkModeToggle()) Elements.darkModeToggle().checked = config.darkMode ?? true;
        if (Elements.vibrationToggle()) Elements.vibrationToggle().checked = config.vibration ?? true;
        if (Elements.displayPlayersToggle()) Elements.displayPlayersToggle().checked = config.displayPlayers ?? true;

        // Aplica as cores e nomes personalizados aos inputs de configuração
        for (let i = 0; i < Elements.customTeamInputs.length; i++) {
            const teamNum = i + 1;
            if (Elements.customTeamInputs[i].name()) Elements.customTeamInputs[i].name().value = config[`customTeam${teamNum}Name`] ?? `Time Personalizado ${teamNum}`;
            if (Elements.customTeamInputs[i].color()) Elements.customTeamInputs[i].color().value = config[`customTeam${teamNum}Color`] ?? `#${Math.floor(Math.random()*16777215).toString(16)}`;
        }

        // REMOVIDO: As chamadas a updateTeamDisplayNamesAndColors() aqui para evitar sobrescrever os times ativos.
        // A atualização da exibição dos nomes e cores dos times na tela de pontuação
        // é responsabilidade do logic.js quando o jogo começa ou os times são trocados.

        // Aplica o tema escuro
        document.body.classList.toggle('dark-mode', config.darkMode ?? true);

        return config;
    } catch (e) {
        console.error('Erro ao carregar configurações do localStorage:', e);
        return {};
    }
}

/**
 * Salva as configurações atuais no localStorage.
 */
export function saveConfig() {
    try {
        const config = {
            playersPerTeam: Elements.playersPerTeamInput() ? parseInt(Elements.playersPerTeamInput().value, 10) : 4,
            pointsPerSet: Elements.pointsPerSetInput() ? parseInt(Elements.pointsPerSetInput().value, 10) : 15,
            numberOfSets: Elements.numberOfSetsInput() ? parseInt(Elements.numberOfSetsInput().value, 10) : 1,
            darkMode: Elements.darkModeToggle() ? Elements.darkModeToggle().checked : true,
            vibration: Elements.vibrationToggle() ? Elements.vibrationToggle().checked : true,
            displayPlayers: Elements.displayPlayersToggle() ? Elements.displayPlayersToggle().checked : true,
        };

        // Salva nomes e cores personalizados
        for (let i = 0; i < Elements.customTeamInputs.length; i++) {
            const teamNum = i + 1;
            if (Elements.customTeamInputs[i].name()) {
                config[`customTeam${teamNum}Name`] = Elements.customTeamInputs[i].name().value;
            }
            if (Elements.customTeamInputs[i].color()) {
                config[`customTeam${teamNum}Color`] = Elements.customTeamInputs[i].color().value;
            }
        }

        localStorage.setItem('volleyballConfig', JSON.stringify(config));
        console.log("Configurações salvas:", config);

        // Atualiza a exibição de jogadores na tela de pontuação imediatamente após salvar
        // É importante que essa atualização venha do estado ATUAL do jogo, não do config salvo.
        const currentTeam1Players = getCurrentTeam1();
        const currentTeam2Players = getCurrentTeam2();
        const displayPlayers = config.displayPlayers ?? true; // Usa a configuração recém-salva para decidir exibir jogadores

        if (displayPlayers) {
            renderScoringPagePlayers(currentTeam1Players, currentTeam2Players, displayPlayers);
        } else {
            renderScoringPagePlayers([], [], false); // Esconde os jogadores se a opção estiver desativada
        }

        // REMOVIDO: A chamada a updateTeamDisplayNamesAndColors() aqui para evitar sobrescrever os times ativos.
        // A atualização da exibição dos nomes e cores dos times na tela de pontuação
        // é responsabilidade do logic.js quando o jogo começa ou os times são trocados.

        // Atualiza o tema escuro
        document.body.classList.toggle('dark-mode', config.darkMode);


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

    if (Elements.playersPerTeamInput()) Elements.playersPerTeamInput().addEventListener('change', saveConfig);
    if (Elements.pointsPerSetInput()) Elements.pointsPerSetInput().addEventListener('change', saveConfig);
    if (Elements.numberOfSetsInput()) Elements.numberOfSetsInput().addEventListener('change', saveConfig);
    if (Elements.darkModeToggle()) Elements.darkModeToggle().addEventListener('change', saveConfig);
    if (Elements.vibrationToggle()) Elements.vibrationToggle().addEventListener('change', saveConfig);
    if (Elements.displayPlayersToggle()) Elements.displayPlayersToggle().addEventListener('change', saveConfig);

    Elements.customTeamInputs.forEach(input => {
        if (input.name()) input.name().addEventListener('change', saveConfig);
        if (input.color()) input.color().addEventListener('change', saveConfig);
    });

    // Adiciona listener para o botão de reset de configurações
    if (Elements.resetConfigButton()) {
        Elements.resetConfigButton().addEventListener('click', () => {
            localStorage.removeItem('volleyballConfig');
            loadConfig(); // Recarrega as configurações padrão
            console.log('Configurações resetadas para o padrão.');
            // Força a atualização dos jogadores na tela de pontuação após reset
            // Usa o estado ATUAL do jogo, que será resetado para os defaults de config-ui.js
            renderScoringPagePlayers(getCurrentTeam1(), getCurrentTeam2(), loadConfig().displayPlayers ?? true);
        });
    }
}
