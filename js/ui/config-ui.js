// js/ui/config-ui.js
// Lógica de interface para a tela de configurações.

import * as Elements from './elements.js';
import { updateTeamDisplayNamesAndColors, renderScoringPagePlayers } from '../ui/game-ui.js';
import { getCurrentTeam1, getCurrentTeam2, getActiveTeam1Name, getActiveTeam2Name, getActiveTeam1Color, getActiveTeam2Color } from '../game/logic.js';
import { displayMessage } from './messages.js'; // Importa para exibir mensagens
import { showConfirmationModal } from './pages.js'; // Importa o modal de confirmação
import { updateConnectionIndicator } from '../main.js'; // Importa updateConnectionIndicator
import { resetUser, getCurrentUser } from '../firebase/auth.js'; // Importa funções para resetar usuário

console.log("[config-ui.js] Arquivo carregado"); // <-- Adicione isso no topo do arquivo

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
        // NOVO: Garante que showConnectionStatus está definido, padrão para false
        config.showConnectionStatus = config.showConnectionStatus ?? false;


        // Preenche o objeto config com os nomes e cores padrão, se não estiverem definidos
        for (let i = 0; i < defaultTeamNames.length; i++) {
            const teamNum = i + 1;
            const nameKey = `customTeam${teamNum}Name`;
            const colorKey = `customTeam${teamNum}Color`;
            // Se a configuração não existir, usa o padrão do array, ou um fallback genérico
            config[nameKey] = config[nameKey] ?? defaultTeamNames[i] ?? `Time ${teamNum}`;
            config[colorKey] = config[colorKey] ?? defaultTeamColors[i] ?? `#${Math.floor(Math.random()*16777215).toString(16)}`;
        }

        // NOVO: Carrega a chave admin se existir
        config.adminKey = config.adminKey || "";

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
        // NOVO: Aplica a configuração do status de conexão
        if (Elements.showConnectionStatusToggle()) Elements.showConnectionStatusToggle().checked = config.showConnectionStatus ?? false;


        // Aplica as cores e nomes personalizados aos inputs de configuração
        for (let i = 0; i < Elements.customTeamInputs.length; i++) {
            const teamNum = i + 1;
            if (Elements.customTeamInputs[i].name()) Elements.customTeamInputs[i].name().value = config[`customTeam${teamNum}Name`];
            if (Elements.customTeamInputs[i].color()) Elements.customTeamInputs[i].color().value = config[`customTeam${teamNum}Color`];
        }

        // NOVO: Aplica o valor ao input da chave admin
        if (Elements.adminKeyInput()) Elements.adminKeyInput().value = config.adminKey;

        // Aplica o tema escuro
        document.body.classList.toggle('dark-mode', config.darkMode ?? true);

        // console.log("[config-ui.js] Configurações carregadas/processadas (incluindo padrões):", config); // Removido console.log excessivo

        return config; // O objeto config retornado agora inclui os padrões se não estiver salvos
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
            // NOVO: Salva o estado do toggle de status de conexão
            showConnectionStatus: Elements.showConnectionStatusToggle() ? Elements.showConnectionStatusToggle().checked : false,
            adminKey: Elements.adminKeyInput() ? Elements.adminKeyInput().value.trim() : "",
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
        // console.log("[config-ui.js] Configurações salvas:", config); // Removido console.log excessivo

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

        // NOVO: Atualiza a visibilidade do indicador de conexão imediatamente
        updateConnectionIndicator(navigator.onLine ? 'online' : 'offline');


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
 * Adiciona um botão de 'Resetar Usuário' na tela de configurações.
 */
export function addResetUserButton() {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser || currentUser.isAnonymous) {
            // Usuário não está logado ou é anônimo. Não mostra o botão.
            // console.log("Usuário não está logado ou é anônimo. Botão de reset não será adicionado.");
            return;
        }

        // Sempre tenta pegar o botão do DOM
        const resetButton = document.getElementById('reset-user-button');
        if (!resetButton) {
            console.error("[ResetUser] Botão de reset não encontrado no DOM.");
            return;
        }

        // Remove listeners antigos para evitar múltiplos binds
        resetButton.replaceWith(resetButton.cloneNode(true));
        const freshResetButton = document.getElementById('reset-user-button');

        freshResetButton.addEventListener('click', () => {
            console.log("[ResetUser] Botão clicado");
            if (!navigator.onLine) {
                displayMessage("Você precisa estar online para resetar seus dados.", "error");
                return;
            }

            showConfirmationModal(
                "Tem certeza que deseja redefinir seus dados de usuário? Isso irá excluir todos os seus dados e desconectá-lo.",
                async () => {
                    console.log("[ResetUser] Confirmado no modal");
                    try {
                        freshResetButton.disabled = true;
                        await resetUser();
                        console.log("[ResetUser] resetUser() chamado com sucesso");
                    } catch (error) {
                        console.error("Erro ao resetar dados do usuário:", error);
                        displayMessage("Erro ao resetar os dados do usuário. Por favor, tente novamente.", "error");
                    } finally {
                        freshResetButton.disabled = false;
                    }
                }
            );
        });
    } catch (error) {
        console.error("Erro ao adicionar botão de reset:", error);
        displayMessage("Erro ao adicionar botão de reset. Por favor, recarregue a página.", "error");
    }
}

/**
 * Configura os event listeners para os inputs de configuração.
 */
export function setupConfigUI() {
    // console.log("[config-ui.js] Iniciando setupConfigUI."); // Removido console.log excessivo
    // console.log("[config-ui.js] Conteúdo do objeto Elements:", Elements); // Removido console.log excessivo

    loadConfig();

    const elementsToSetup = [
        { getter: Elements.playersPerTeamInput, name: 'playersPerTeamInput' },
        { getter: Elements.pointsPerSetInput, name: 'pointsPerSetInput' },
        { getter: Elements.pointsPerSetInput, name: 'pointsPerSetInput' }, // Esta linha estava duplicada no original. Mantendo-a.
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

    // NOVO: Adiciona listener para o toggle de status de conexão
    if (Elements.showConnectionStatusToggle()) {
        Elements.showConnectionStatusToggle().addEventListener('change', () => {
            saveConfig(); // Salva a configuração
            // A visibilidade do indicador de conexão é atualizada imediatamente dentro de saveConfig()
            // através de updateConnectionIndicator
        });
    } else {
        console.warn(`[config-ui.js] Elemento 'showConnectionStatusToggle' não encontrado.`);
    }

    Elements.customTeamInputs.forEach(input => {
        if (input.name && typeof input.name === 'function') {
            const nameEl = input.name();
            if (nameEl) nameEl.addEventListener('change', saveConfig);
            else console.warn(`[config-ui.js] Elemento para nome de time personalizado não encontrado.`);
        } else {
            // console.error(`[config-ui.js] Elements.customTeamInputs.name não é uma função válida.`); // Removido console.error excessivo
        }

        if (input.color && typeof input.color === 'function') {
            const colorEl = input.color();
            if (colorEl) colorEl.addEventListener('change', saveConfig);
            else console.warn(`[config-ui.js] Elemento para cor de time personalizado não encontrado.`);
        } else {
            // console.error(`[config-ui.js] Elements.customTeamInputs.color não é uma função válida.`); // Removido console.error excessivo
        }
    });

    // Adiciona listener para o botão de reset de configurações
    if (Elements.resetConfigButton()) {
        Elements.resetConfigButton().addEventListener('click', () => {
            localStorage.removeItem('volleyballConfig');
            loadConfig(); // Recarrega as configurações padrão
            console.log('[config-ui.js] Configurações resetadas para o padrão.');
            displayMessage('Configurações resetadas para o padrão.', 'success');
            // Força a atualização dos jogadores na tela de pontuação após reset
            renderScoringPagePlayers(getCurrentTeam1(), getCurrentTeam2(), loadConfig().displayPlayers ?? true);
            // NOVO: Atualiza a visibilidade do indicador de conexão após o reset
            updateConnectionIndicator(navigator.onLine ? 'online' : 'offline');
        });
    }

    // NOVO: Listener para o botão de resetar o aplicativo
    if (Elements.resetAppButton()) {
        Elements.resetAppButton().addEventListener('click', resetAppAndClearCache);
    }

    // Configura input da chave admin
    const adminKeyInput = document.getElementById('admin-key-input');
    if (adminKeyInput) {
        // Define o tipo do input como 'password' para ocultar a chave
        adminKeyInput.type = 'password';

        // Carrega valor existente se houver
        const config = loadConfig();
        if (config.adminKey) {
            adminKeyInput.value = config.adminKey;
        }

        // Remove botão existente antes de adicionar um novo
        const existingButton = document.getElementById('authenticate-button');
        if (existingButton) {
            existingButton.remove();
        }

        // Adiciona botão para autenticar
        const authenticateButton = document.createElement('button');
        authenticateButton.id = 'authenticate-button';
        authenticateButton.textContent = 'Autenticar';
        authenticateButton.style.marginTop = '5px';
        adminKeyInput.parentNode.insertBefore(authenticateButton, adminKeyInput.nextSibling);

        authenticateButton.addEventListener('click', () => {
            const config = JSON.parse(localStorage.getItem('volleyballConfig')) || {};
            config.adminKey = adminKeyInput.value;
            localStorage.setItem('volleyballConfig', JSON.stringify(config));

            // Corrige validação da chave
            const correctAdminKey = 'admin998939';
            if (config.adminKey === correctAdminKey) {
                displayMessage('Chave autenticada', 'success');
                
                // Recarrega a página automaticamente apenas se a chave for válida
                setTimeout(() => {
                    window.location.reload();
                }, 1000); // Pequeno atraso para exibir a mensagem antes de recarregar
            } else {
                displayMessage('Chave inválida', 'error');
            }
        });
    }

    addResetUserButton(); // Adiciona o botão de resetar usuário
    console.log("Botão de resetar usuário adicionado às configurações.");

    console.log("[config-ui.js] setupConfigUI finalizado.");
}
