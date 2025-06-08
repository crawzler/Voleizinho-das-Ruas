// js/ui/config-ui.js
// Lógica de interface para a tela de configurações.

import * as Elements from './elements.js';
import { updateTeamDisplayNamesAndColors, renderScoringPagePlayers } from '../ui/game-ui.js';
import { getCurrentTeam1, getCurrentTeam2, getActiveTeam1Name, getActiveTeam2Name, getActiveTeam1Color, getActiveTeam2Color } from '../game/logic.js';
import { displayMessage } from './messages.js'; // Importa para exibir mensagens
import { showConfirmationModal } from './pages.js'; // Importa o modal de confirmação

// Nomes padrão para os times personalizados
const defaultTeamNames = [
    'Time A', 'Time B', 'Time C', 'Time D', 'Time E', 'Time F'
];
// Cores padrão para os times personalizados
const defaultTeamColors = [
    '#325fda', '#f03737', '#4CAF50', '#FFC107', '#9C27B0', '#00BCD4'
];

/**
 * Carrega as configurações salvas no localStorage e as aplica aos inputs.
 * Garante que nomes e cores padrão para times personalizados sejam sempre incluídos.
 * @returns {Object} O objeto de configuração carregado.
 */
export function loadConfig() {
    try {
        let config = JSON.parse(localStorage.getItem('volleyballConfig'));
        let isNewConfig = false;
        if (!config) {
            config = {};
            isNewConfig = true;
        }

        // Garante que as configurações básicas tenham valores padrão
        config.playersPerTeam = config.playersPerTeam ?? 4;
        config.pointsPerSet = config.pointsPerSet ?? 15;
        config.numberOfSets = config.numberOfSets ?? 1;
        config.darkMode = config.darkMode ?? true;
        config.vibration = config.vibration ?? true;
        config.displayPlayers = config.displayPlayers ?? true;


        // Preenche o objeto config com os nomes e cores padrão, se não estiverem definidos
        for (let i = 0; i < defaultTeamNames.length; i++) {
            const teamNum = i + 1;
            const nameKey = `customTeam${teamNum}Name`;
            const colorKey = `customTeam${teamNum}Color`;
            // Se a configuração não existir, usa o padrão do array, ou um fallback genérico
            config[nameKey] = config[nameKey] ?? defaultTeamNames[i] ?? `Time ${teamNum}`;
            config[colorKey] = config[colorKey] ?? defaultTeamColors[i] ?? `#${Math.floor(Math.random()*16777215).toString(16)}`;
        }

        // Se for uma nova configuração, salva no localStorage
        if (isNewConfig) {
            localStorage.setItem('volleyballConfig', JSON.stringify(config));
            console.log("[config-ui.js] Nova configuração padrão salva no localStorage:", config);
        }

        // Aplica as configurações aos inputs da UI
        if (Elements.playersPerTeamInput()) Elements.playersPerTeamInput().value = config.playersPerTeam ?? 4;
        if (Elements.pointsPerSetInput()) Elements.pointsPerSetInput().value = config.pointsPerSet ?? 15;
        if (Elements.numberOfSetsInput()) Elements.numberOfSetsInput().value = config.numberOfSets ?? 1;
        if (Elements.darkModeToggle()) Elements.darkModeToggle().checked = config.darkMode ?? true;
        if (Elements.vibrationToggle()) Elements.vibrationToggle().checked = config.vibration ?? true;
        if (Elements.displayPlayersToggle()) Elements.displayPlayersToggle().checked = config.displayPlayers ?? true;

        // Aplica as cores e nomes personalizados aos inputs de configuração
        for (let i = 0; i < Elements.customTeamInputs.length; i++) {
            const teamNum = i + 1;
            if (Elements.customTeamInputs[i].name()) Elements.customTeamInputs[i].name().value = config[`customTeam${teamNum}Name`];
            if (Elements.customTeamInputs[i].color()) Elements.customTeamInputs[i].color().value = config[`customTeam${teamNum}Color`];
        }

        // Aplica o tema escuro
        document.body.classList.toggle('dark-mode', config.darkMode ?? true);

        console.log("[config-ui.js] Configurações carregadas/processadas (incluindo padrões):", config);

        return config; // O objeto config retornado agora inclui os padrões se não estiverem salvos
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
        console.log("[config-ui.js] Configurações salvas:", config);

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

        // Atualiza o tema escuro
        document.body.classList.toggle('dark-mode', config.darkMode);


    } catch (e) {
        console.error('Erro ao salvar configurações:', e);
    }
}

/**
 * Limpa o cache do Service Worker e o armazenamento local do aplicativo, depois recarrega a página.
 * Só executa se o usuário estiver online.
 */
async function resetAppAndClearCache() {
    if (!navigator.onLine) {
        displayMessage("Você precisa estar online para reiniciar o aplicativo e limpar o cache.", "error");
        return;
    }

    showConfirmationModal(
        "Tem certeza que deseja reiniciar o aplicativo e limpar todos os dados salvos localmente (configurações, jogadores, histórico, agendamentos)? Isso não afetará os dados no Firestore.",
        async () => {
            try {
                // Limpa localStorage
                localStorage.removeItem('volleyballConfig');
                localStorage.removeItem('volleyballPlayers');
                localStorage.removeItem('gameHistory');
                localStorage.removeItem('scheduledGames'); // Adicionar outras chaves relevantes aqui

                // Limpa caches do Service Worker
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));
                    console.log("Caches do Service Worker limpos.");
                }

                // Desregistra o Service Worker
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(registrations.map(registration => registration.unregister()));
                    console.log("Service Workers desregistrados.");
                }

                displayMessage("Aplicativo reiniciado e cache limpo com sucesso!", "success");
                setTimeout(() => {
                    window.location.reload(true); // Recarrega a página forçando o cache
                }, 1000); // Pequeno atraso para a mensagem aparecer
            } catch (error) {
                console.error("Erro ao reiniciar o aplicativo e limpar o cache:", error);
                displayMessage("Erro ao tentar reiniciar o aplicativo e limpar o cache.", "error");
            }
        },
        () => {
            displayMessage("Reinicialização cancelada.", "info");
        }
    );
}

/**
 * Configura os event listeners para os inputs de configuração.
 */
export function setupConfigUI() {
    console.log("[config-ui.js] Iniciando setupConfigUI.");
    console.log("[config-ui.js] Conteúdo do objeto Elements:", Elements);

    loadConfig();

    const elementsToSetup = [
        { getter: Elements.playersPerTeamInput, name: 'playersPerTeamInput' },
        { getter: Elements.pointsPerSetInput, name: 'pointsPerSetInput' },
        { getter: Elements.pointsPerSetInput, name: 'pointsPerSetInput' }, // This line was duplicated in the original. Keeping it.
        { getter: Elements.numberOfSetsInput, name: 'numberOfSetsInput' },
        { getter: Elements.darkModeToggle, name: 'darkModeToggle' },
        { getter: Elements.vibrationToggle, name: 'vibrationToggle' },
        { getter: Elements.displayPlayersToggle, name: 'displayPlayersToggle' },
    ];

    elementsToSetup.forEach(({ getter, name }) => {
        if (typeof getter === 'function') { // Garante que a propriedade é uma função antes de chamá-la
            const element = getter(); // Obtém a referência ao elemento DOM
            if (element) {
                element.addEventListener('change', saveConfig);
            } else {
                console.warn(`[config-ui.js] Elemento DOM para '${name}' não encontrado. Listener não adicionado.`);
            }
        } else {
            console.error(`[config-ui.js] Elements.${name} não é uma função. Verifique a importação de elements.js.`);
        }
    });

    Elements.customTeamInputs.forEach(input => {
        if (input.name && typeof input.name === 'function') {
            const nameEl = input.name();
            if (nameEl) nameEl.addEventListener('change', saveConfig);
            else console.warn(`[config-ui.js] Elemento para nome de time personalizado não encontrado.`);
        } else {
            console.error(`[config-ui.js] Elements.customTeamInputs.name não é uma função válida.`);
        }

        if (input.color && typeof input.color === 'function') {
            const colorEl = input.color();
            if (colorEl) colorEl.addEventListener('change', saveConfig);
            else console.warn(`[config-ui.js] Elemento para cor de time personalizado não encontrado.`);
        } else {
            console.error(`[config-ui.js] Elements.customTeamInputs.color não é uma função válida.`);
        }
    });

    // Adiciona listener para o botão de reset de configurações
    if (Elements.resetConfigButton()) {
        Elements.resetConfigButton().addEventListener('click', () => {
            localStorage.removeItem('volleyballConfig');
            loadConfig(); // Recarrega as configurações padrão
            console.log('[config-ui.js] Configurações resetadas para o padrão.');
            // Força a atualização dos jogadores na tela de pontuação após reset
            // Usa o estado ATUAL do jogo, que será resetado para os defaults de config-ui.js
            renderScoringPagePlayers(getCurrentTeam1(), getCurrentTeam2(), loadConfig().displayPlayers ?? true);
        });
    }

    // NOVO: Listener para o botão de resetar o aplicativo
    if (Elements.resetAppButton()) {
        Elements.resetAppButton().addEventListener('click', resetAppAndClearCache);
    }

    console.log("[config-ui.js] setupConfigUI finalizado.");
}
