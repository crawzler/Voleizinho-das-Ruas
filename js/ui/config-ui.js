// js/ui/config-ui.js
// Lógica de interface para a tela de configurações.

import * as Elements from './elements.js';
import { updateTeamDisplayNamesAndColors, renderScoringPagePlayers } from '../ui/game-ui.js';
import { getCurrentTeam1, getCurrentTeam2, getActiveTeam1Name, getActiveTeam2Name, getActiveTeam1Color, getActiveTeam2Color } from '../game/logic.js';
import { displayMessage } from './messages.js'; // Importa para exibir mensagens
// import { showConfirmationModal } from './pages.js'; // Importa o modal de confirmação
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
        config.displayTimer = config.displayTimer ?? true;
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
        if (Elements.displayTimerToggle()) Elements.displayTimerToggle().checked = config.displayTimer ?? true;
        // NOVO: Aplica a configuração do status de conexão
        if (Elements.showConnectionStatusToggle()) Elements.showConnectionStatusToggle().checked = config.showConnectionStatus ?? false;
        // NOVO: Aplica a configuração de notificações
        if (Elements.notificationsToggle()) {
            const supported = 'Notification' in window;
            const hasPermission = supported && Notification.permission === 'granted';
            // Toggle refletirá a preferência apenas se for suportado e houver permissão
            Elements.notificationsToggle().checked = supported && config.notificationsEnabled && hasPermission;
            // Desabilita o toggle se não suportado
            Elements.notificationsToggle().disabled = !supported;
            if (!supported) {
                Elements.notificationsToggle().title = 'Notificações não são suportadas neste dispositivo/navegador.';
            } else if (!hasPermission && config.notificationsEnabled) {
                // Se usuário queria habilitar mas ainda não tem permissão, mantém desmarcado até conceder
                Elements.notificationsToggle().checked = false;
            }
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
    metaThemeColor.content = '#000000';
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
            displayTimer: Elements.displayTimerToggle() ? Elements.displayTimerToggle().checked : true,
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
        
        // NOVO: Controla visibilidade do timer na UI imediatamente
        try {
            const wrapper = Elements.timerAndSetTimerWrapper ? Elements.timerAndSetTimerWrapper() : null;
            if (wrapper) {
                wrapper.style.display = config.displayTimer ? 'flex' : 'none';
            }
        } catch (_) { /* ignore */ }
        
        // Atualiza meta theme-color baseado no tema
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
    metaThemeColor.content = '#000000';
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
        { getter: Elements.displayTimerToggle, name: 'displayTimerToggle' },
        // Removido: notificationsToggle tem tratamento especial abaixo
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
        const checkbox = Elements.notificationsToggle();
        const onChange = async (ev) => {
            try {
                const cb = ev.currentTarget;
                const isTurningOn = !!cb.checked;

                if (isTurningOn) {
                    // Verifica suporte
                    if (!('Notification' in window)) {
                        cb.checked = false;
                        try {
                            const { displayMessage } = await import('./messages.js');
                            displayMessage('Notificações não são suportadas neste dispositivo/navegador.', 'error');
                        } catch (_) { /* fallback abaixo */ }
                        alert('Notificações não são suportadas neste dispositivo/navegador.');
                        ev.preventDefault();
                        ev.stopImmediatePropagation();
                        return;
                    }

                    const permission = Notification.permission;

                    if (permission === 'granted') {
                        // Caso granted: ativa normalmente
                        saveConfig();
                        return;
                    }

                    if (permission === 'default') {
                        // Solicita permissão
                        let result = 'default';
                        try {
                            result = await Notification.requestPermission();
                        } catch (_) { /* ignore */ }

                        if (result === 'granted') {
                            cb.checked = true;
                            saveConfig();
                            return;
                        }

                        // Não concedido: desmarca e ensina como ativar manualmente
                        cb.checked = false;
                        try {
                            const { showNotificationPermissionHelp } = await import('./notification-permission-help.js');
                            showNotificationPermissionHelp();
                        } catch (_) { /* ignore */ }
                        try {
                            const { displayMessage } = await import('./messages.js');
                            displayMessage('Permissão de notificação negada. Ative nas configurações do navegador.', 'warning');
                        } catch (_) { /* ignore */ }
                        alert('Permissão de notificação negada.\n\nPara ativar, vá às configurações do navegador para este site e permita notificações.');
                        ev.preventDefault();
                        ev.stopImmediatePropagation();
                        return;
                    }

                    // Caso denied: orienta habilitar manualmente
                    if (permission === 'denied') {
                        cb.checked = false;
                        try {
                            const { showNotificationPermissionHelp } = await import('./notification-permission-help.js');
                            showNotificationPermissionHelp();
                        } catch (_) {
                            alert('Você negou as notificações anteriormente.\n\nPara ativar novamente, abra as configurações do navegador para este site e permita notificações.');
                        }
                        ev.preventDefault();
                        ev.stopImmediatePropagation();
                        return;
                    }
                } else {
                    // Desligando
                    saveConfig();
                }
            } catch (e) {
                // Em caso de erro, reverte o toggle e informa o usuário
                const cb = Elements.notificationsToggle();
                if (cb) cb.checked = false;
                try {
                    const { displayMessage } = await import('./messages.js');
                    displayMessage('Não foi possível atualizar as notificações agora.', 'error');
                } catch (_) { /* ignore */ }
                ev.preventDefault();
                ev.stopImmediatePropagation();
            }
        };
        checkbox.addEventListener('change', onChange);
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
        
        // Função para atualizar visibilidade do botão
        const updateInstallButtonVisibility = () => {
            if (window.pwaManager) {
                window.pwaManager.checkInstallStatus();
                if (window.pwaManager.isInstalled) {
                    installPwaButton.style.display = 'none';
                } else if (window.pwaManager.canShowInstallPrompt()) {
                    installPwaButton.style.display = 'block';
                } else {
                    installPwaButton.style.display = 'none';
                }
            }
        };
        
        // Atualiza visibilidade inicialmente
        updateInstallButtonVisibility();
        
        // Verifica periodicamente
        setInterval(updateInstallButtonVisibility, 3000);
    }



    // Configura input da chave admin
    const adminKeyInput = document.getElementById('admin-key-input');
    const adminAuthBtn = document.getElementById('admin-auth-btn');
    const adminAuthStatus = document.getElementById('admin-auth-status');
    const toggleAdminKey = document.getElementById('toggle-admin-key');
    
    if (adminKeyInput && adminAuthBtn) {
        // Debug: verifica se os elementos foram encontrados
        console.log('Admin elements found:', {
            input: !!adminKeyInput,
            button: !!adminAuthBtn,
            toggle: !!toggleAdminKey
        });
        
        // Carrega valor existente se houver
        const config = loadConfig();
        if (config.adminKey) {
            adminKeyInput.value = config.adminKey;
        }
        
        // Permite autenticar pressionando Enter
        adminKeyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                adminAuthBtn.click();
            }
        });
        
        // Limpa o status quando o usuário começa a digitar
        adminKeyInput.addEventListener('input', () => {
            if (adminAuthStatus) {
                adminAuthStatus.style.display = 'none';
            }
        });
        
        // Funcionalidade do botão olho
        if (toggleAdminKey && adminKeyInput) {
            toggleAdminKey.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                if (adminKeyInput.type === 'password') {
                    adminKeyInput.type = 'text';
                    toggleAdminKey.querySelector('.material-icons').textContent = 'visibility_off';
                } else {
                    adminKeyInput.type = 'password';
                    toggleAdminKey.querySelector('.material-icons').textContent = 'visibility';
                }
            });
        }

        adminAuthBtn.addEventListener('click', () => {
            const enteredKey = adminKeyInput.value.trim();
            const correctAdminKey = 'admin998939';
            
            // Limpa status anterior
            if (adminAuthStatus) {
                adminAuthStatus.style.display = 'none';
            }
            
            if (!enteredKey) {
                displayMessage('Digite uma chave de administrador', 'warning');
                return;
            }
            
            const config = JSON.parse(localStorage.getItem('volleyballConfig')) || {};
            config.adminKey = enteredKey;
            localStorage.setItem('volleyballConfig', JSON.stringify(config));

            if (enteredKey === correctAdminKey) {
                // Sucesso na autenticação
                displayMessage('✅ Chave autenticada com sucesso!', 'success');
                
                // Mostra alerta de sucesso
                if (adminAuthStatus) {
                    adminAuthStatus.className = 'admin-auth-status success';
                    adminAuthStatus.innerHTML = `
                        <span class="material-icons">check_circle</span>
                        <span class="status-text">Autenticado com sucesso - Acesso liberado!</span>
                    `;
                    adminAuthStatus.style.display = 'flex';
                }
                
                // Atualiza permissões de agendamento
                import('./scheduling-ui.js').then(module => {
                    if (module.updateSchedulingPermissions) {
                        module.updateSchedulingPermissions();
                    }
                }).catch(e => {
                    // Log removido
                });
                
                // Não recarrega mais a página automaticamente
            } else {
                // Erro na autenticação
                displayMessage('❌ Chave de administrador inválida', 'error');
                
                // Mostra alerta de erro
                if (adminAuthStatus) {
                    adminAuthStatus.className = 'admin-auth-status error';
                    adminAuthStatus.innerHTML = `
                        <span class="material-icons">error</span>
                        <span class="status-text">Chave inválida - Acesso negado</span>
                    `;
                    adminAuthStatus.style.display = 'flex';
                }
                
                // Limpa o campo após erro
                setTimeout(() => {
                    adminKeyInput.value = '';
                    adminKeyInput.focus();
                }, 1000);
            }
        });
    }



    // Configuração adicional para o botão olho (fallback)
    setTimeout(() => {
        const toggleBtn = document.getElementById('toggle-admin-key');
        const inputField = document.getElementById('admin-key-input');
        
        if (toggleBtn && inputField && !toggleBtn.hasAttribute('data-configured')) {
            toggleBtn.setAttribute('data-configured', 'true');
            toggleBtn.addEventListener('click', function() {
                if (inputField.type === 'password') {
                    inputField.type = 'text';
                    this.querySelector('.material-icons').textContent = 'visibility_off';
                } else {
                    inputField.type = 'password';
                    this.querySelector('.material-icons').textContent = 'visibility';
                }
            });
        }
    }, 100);

    // Log removido
}
