// js/ui/config-ui.js
// Lógica de interface para a tela de configurações.

import * as Elements from './elements.js';
import { updateTeamDisplayNamesAndColors, renderScoringPagePlayers } from '../ui/game-ui.js';
import { getCurrentTeam1, getCurrentTeam2, getActiveTeam1Name, getActiveTeam2Name, getActiveTeam1Color, getActiveTeam2Color } from '../game/logic.js';
import { displayMessage } from './messages.js'; // Importa para exibir mensagens
import { showConfirmationModal } from './pages.js'; // Importa o modal de confirmação
import { updateConnectionIndicator } from '../main.js'; // Importa updateConnectionIndicator




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
        config.darkMode = config.darkMode ?? false; // Padrão é tema claro
        config.vibration = config.vibration ?? true;
        config.displayPlayers = config.displayPlayers ?? true;
        // NOVO: Garante que showConnectionStatus está definido, padrão para false
        config.showConnectionStatus = config.showConnectionStatus ?? false;
        // NOVO: Garante que notificationsEnabled está definido, padrão para true
        config.notificationsEnabled = config.notificationsEnabled ?? true;


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
            // Log removido
        }

        // Aplica as configurações aos inputs da UI
        if (Elements.darkModeToggle()) Elements.darkModeToggle().checked = config.darkMode ?? false;
        if (Elements.vibrationToggle()) Elements.vibrationToggle().checked = config.vibration ?? true;
        if (Elements.displayPlayersToggle()) Elements.displayPlayersToggle().checked = config.displayPlayers ?? true;
        // NOVO: Aplica a configuração do status de conexão
        if (Elements.showConnectionStatusToggle()) Elements.showConnectionStatusToggle().checked = config.showConnectionStatus ?? false;
        // NOVO: Aplica a configuração de notificações
        if (Elements.notificationsToggle()) {
            const hasPermission = 'Notification' in window && Notification.permission === 'granted';
            Elements.notificationsToggle().checked = config.notificationsEnabled && hasPermission;
        }


        // Aplica as cores e nomes personalizados aos inputs de configuração
        for (let i = 0; i < Elements.customTeamInputs.length; i++) {
            const teamNum = i + 1;
            if (Elements.customTeamInputs[i].name()) Elements.customTeamInputs[i].name().value = config[`customTeam${teamNum}Name`];
            if (Elements.customTeamInputs[i].color()) Elements.customTeamInputs[i].color().value = config[`customTeam${teamNum}Color`];
        }

        // NOVO: Aplica o valor ao input da chave admin
        if (Elements.adminKeyInput()) Elements.adminKeyInput().value = config.adminKey;

        // Aplica o tema
        document.body.classList.toggle('dark-mode', config.darkMode ?? false);
        
        // NOVO: Aplica a classe para ocultar jogadores
        document.body.classList.toggle('hide-players', !(config.displayPlayers ?? true));
        
        // Atualiza meta theme-color baseado no tema
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.content = config.darkMode ? '#1a1a1a' : '#ffffff';
        }



        return config; // O objeto config retornado agora inclui os padrões se não estiver salvos
    } catch (e) {
        // Log removido
        return {};
    }
}

/**
 * Salva as configurações atuais no localStorage.
 */
export function saveConfig() {
    try {
        // Mantém os valores existentes para compatibilidade
        const existingConfig = JSON.parse(localStorage.getItem('volleyballConfig') || '{}');
        const config = {
            playersPerTeam: existingConfig.playersPerTeam ?? 4,
            pointsPerSet: existingConfig.pointsPerSet ?? 15,
            numberOfSets: existingConfig.numberOfSets ?? 1,
            darkMode: Elements.darkModeToggle() ? Elements.darkModeToggle().checked : false,
            vibration: Elements.vibrationToggle() ? Elements.vibrationToggle().checked : true,
            displayPlayers: Elements.displayPlayersToggle() ? Elements.displayPlayersToggle().checked : true,
            // NOVO: Salva o estado do toggle de status de conexão
            showConnectionStatus: Elements.showConnectionStatusToggle() ? Elements.showConnectionStatusToggle().checked : false,
            // NOVO: Salva o estado do toggle de notificações
            notificationsEnabled: Elements.notificationsToggle() ? Elements.notificationsToggle().checked : false,
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

        // Atualiza o tema
        document.body.classList.toggle('dark-mode', config.darkMode);
        
        // NOVO: Atualiza a classe para ocultar jogadores
        document.body.classList.toggle('hide-players', !config.displayPlayers);
        
        // Atualiza meta theme-color baseado no tema
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.content = config.darkMode ? '#1a1a1a' : '#ffffff';
        }
        
        // Força atualização de estilos dependentes do tema
        document.documentElement.style.setProperty('--theme-transition', 'all 0.3s ease');

        // NOVO: Atualiza a visibilidade do indicador de conexão imediatamente
        updateConnectionIndicator(navigator.onLine ? 'online' : 'offline');


    } catch (e) {
        // Log removido
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
                    // Log removido
                }

                // Desregistra o Service Worker
                if ('serviceWorker' in navigator) {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(registrations.map(registration => registration.unregister()));
                    // Log removido
                }

                displayMessage("Aplicativo reiniciado e cache limpo com sucesso!", "success");
                setTimeout(() => {
                    window.location.reload(true); // Recarrega a página forçando o cache
                }, 1000); // Pequeno atraso para a mensagem aparecer
            } catch (error) {
                // Log removido
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


    loadConfig();

    // Garante que toques dentro da área de configurações não subam até o body e sejam bloqueados
    const settingsListEl = document.querySelector('.settings-list');
    if (settingsListEl) {
        settingsListEl.addEventListener('touchstart', (ev) => ev.stopPropagation(), { passive: false });
        settingsListEl.addEventListener('touchmove', (ev) => ev.stopPropagation(), { passive: false });
    }

    // Também adiciona proteção ao container do acordeão (conteúdo) para cobrir outros elementos internos
    const accordionContents = document.querySelectorAll('.accordion-content');
    if (accordionContents && accordionContents.length) {
        accordionContents.forEach(ac => {
            ac.addEventListener('touchstart', (ev) => ev.stopPropagation(), { passive: false });
            ac.addEventListener('touchmove', (ev) => ev.stopPropagation(), { passive: false });
        });
    }

    const elementsToSetup = [
        { getter: Elements.darkModeToggle, name: 'darkModeToggle' },
        { getter: Elements.vibrationToggle, name: 'vibrationToggle' },
        { getter: Elements.displayPlayersToggle, name: 'displayPlayersToggle' },
        { getter: Elements.notificationsToggle, name: 'notificationsToggle' },
    ];

    elementsToSetup.forEach(({ getter, name }) => {
        if (typeof getter === 'function') { // Garante que a propriedade é uma função antes de chamá-la
            const element = getter(); // Obtém a referência ao elemento DOM
            if (element) {
                element.addEventListener('change', saveConfig);
            } else {
                // Log removido
            }
        } else {
            // Log removido
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
        // Log removido
    }

    // NOVO: Adiciona listener para o toggle de notificações
    if (Elements.notificationsToggle()) {
        Elements.notificationsToggle().addEventListener('change', async () => {
            const isEnabled = Elements.notificationsToggle().checked;
            
            if (isEnabled) {
                // Tenta solicitar permissão quando ativado
                const { requestNotificationPermission } = await import('../utils/notifications.js');
                const granted = await requestNotificationPermission();
                
                if (!granted) {
                    // Se permissão negada, desativa o toggle
                    Elements.notificationsToggle().checked = false;
                    const { displayMessage } = await import('./messages.js');
                    displayMessage('Permissão de notificação negada. Ative nas configurações do navegador.', 'warning');
                    return;
                }
            }
            
            saveConfig(); // Salva a configuração
        });
    } else {
        // Log removido
    }

    Elements.customTeamInputs.forEach(input => {
        if (input.name && typeof input.name === 'function') {
            const nameEl = input.name();
            if (nameEl) nameEl.addEventListener('change', saveConfig);
        }

        if (input.color && typeof input.color === 'function') {
            const colorEl = input.color();
            if (colorEl) colorEl.addEventListener('change', saveConfig);
        }
    });

    // Adiciona listener para o botão de reset de configurações
    if (Elements.resetConfigButton()) {
        Elements.resetConfigButton().addEventListener('click', () => {
            localStorage.removeItem('volleyballConfig');
            loadConfig(); // Recarrega as configurações padrão
            // Log removido
            displayMessage('Configurações resetadas para o padrão.', 'success');
            // Força a atualização dos jogadores na tela de pontuação após reset
            renderScoringPagePlayers(getCurrentTeam1(), getCurrentTeam2(), loadConfig().displayPlayers ?? true);
            // Atualiza a visibilidade do indicador de conexão após o reset
            updateConnectionIndicator(navigator.onLine ? 'online' : 'offline');
            
            // Atualiza meta theme-color após reset
            const config = loadConfig();
            const metaThemeColor = document.querySelector('meta[name="theme-color"]');
            if (metaThemeColor) {
                metaThemeColor.content = config.darkMode ? '#1a1a1a' : '#ffffff';
            }
        });
    }

    // NOVO: Listener para o botão de resetar o aplicativo
    if (Elements.resetAppButton()) {
        Elements.resetAppButton().addEventListener('click', resetAppAndClearCache);
    }

    // NOVO: Listener para o botão de instalação PWA
    const installPwaButton = document.getElementById('install-pwa-button');
    if (installPwaButton) {
        installPwaButton.addEventListener('click', () => {
            if (window.pwaManager) {
                window.pwaManager.forceInstall();
            }
        });
        
        // Mostra/esconde o botão baseado na disponibilidade
        if (window.pwaManager && window.pwaManager.canShowInstallPrompt()) {
            installPwaButton.style.display = 'block';
        }
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
                
                // Atualiza permissões de agendamento
                import('./scheduling-ui.js').then(module => {
                    if (module.updateSchedulingPermissions) {
                        module.updateSchedulingPermissions();
                    }
                }).catch(e => {
                    // Log removido
                });
                
                // Recarrega a página automaticamente apenas se a chave for válida
                setTimeout(() => {
                    window.location.reload();
                }, 1000); // Pequeno atraso para exibir a mensagem antes de recarregar
            } else {
                displayMessage('Chave inválida', 'error');
            }
        });
    }



    // Log removido
}
