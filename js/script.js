// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, onSnapshot, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global Firebase variables (will be initialized in DOMContentLoaded)
let app;
let db;
let auth;
let userId;
let isAuthReady = false; // Flag para garantir que as operações do Firestore ocorram após a autenticação
let players = []; // Array para armazenar objetos de jogadores: { id: 'local_uuid', name: 'Nome do Jogador', firestoreId: 'firestore_doc_id' }

// Provedor de autenticação Google
const googleLoginProvider = new GoogleAuthProvider();

// Função para gerar um ID único para jogadores apenas locais (offline)
function generateLocalId() {
    return `local-${crypto.randomUUID()}`;
}

document.addEventListener('DOMContentLoaded', () => {
    const pages = document.querySelectorAll('.app-page');
    const sidebar = document.getElementById('sidebar');
    const menuButton = document.getElementById('menu-button');
    const closeSidebarButton = document.getElementById('close-sidebar-button');
    const sidebarNavItems = document.querySelectorAll('.sidebar-nav-item');
    const startGameButton = document.getElementById('start-game-button');
    const navScoringButton = document.getElementById('nav-scoring');

    let activeTeam1Name = 'Time 1';
    let activeTeam2Name = 'Time 2';
    let activeTeam1Color = '#325fda';
    let activeTeam2Color = '#f03737';

    let allGeneratedTeams = [];

    let team1Score = 0;
    let team2Score = 0;
    let timerInterval = null;
    let timeElapsed = 0;
    let isTimerRunning = false;
    let setElapsedTime = 0;
    let setTimerInterval = null;
    let currentTeam1 = [];
    let currentTeam2 = [];
    let isGameInProgress = false;

    const team1ScoreDisplay = document.getElementById('team1-score-display');
    const team2ScoreDisplay = document.getElementById('team2-score-display');
    const timerText = document.querySelector('.timer-text');
    const setTimerText = document.getElementById('set-timer-text');
    const timerToggleButton = document.querySelector('.timer-toggle-button');
    const timerWrapper = document.querySelector('.timer-wrapper');
    const team1Panel = document.getElementById('team1-panel');
    const team2Panel = document.getElementById('team2-panel');
    const team1NameDisplay = document.getElementById('team1-name-display');
    const team2NameDisplay = document.getElementById('team2-name-display');
    const swapTeamsButton = document.getElementById('swap-teams-button');

    const team1PlayersColumn = document.getElementById('team1-players-column');
    const team2PlayersColumn = document.getElementById('team2-players-column');

    const teamSelectionModal = document.getElementById('team-selection-modal');
    const modalTeamList = document.getElementById('modal-team-list');
    const closeModalButton = document.getElementById('close-modal-button');
    let selectingTeamPanelId = null;

    let touchStartY = 0;
    const DRAG_THRESHOLD = 30;

    // Determine appId and firebaseConfig
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    console.log("App ID (do ambiente ou padrão):", appId); // Log de depuração

    let firebaseConfig;
    try {
        if (typeof __firebase_config !== 'undefined' && __firebase_config) {
            firebaseConfig = JSON.parse(__firebase_config);
            console.log("Firebase Config (do ambiente):", firebaseConfig); // Log de depuração
        } else {
            // Fallback para a configuração fornecida pelo usuário se __firebase_config não estiver definido ou for vazio
            firebaseConfig = {
                apiKey: "AIzaSyDNnPPdQziILeX9HjjJg5oW_hp6hDRCrB0",
                authDomain: "volei-das-ruas-dz.firebaseapp.com",
                projectId: "volei-das-ruas-dz",
                storageBucket: "volei-das-ruas-dz.firebasestorage.app",
                messagingSenderId: "318529125182",
                appId: "1:318529125182:web:5f77edf287bbd749948a6f"
            };
            console.log("Firebase Config (fallback do usuário):", firebaseConfig); // Log de depuração
        }
    } catch (e) {
        console.error("Erro ao analisar __firebase_config, usando fallback:", e);
        // Fallback para a configuração fornecida pelo usuário se __firebase_config falhar
        firebaseConfig = {
            apiKey: "AIzaSyDNnPPdQziILeX9HjjJg5oW_hp6hDRCrB0",
            authDomain: "volei-das-ruas-dz.firebaseapp.com",
            projectId: "volei-das-ruas-dz",
            storageBucket: "volei-das-ruas-dz.firebasestorage.app",
            messagingSenderId: "318529125182",
            appId: "1:318529125182:web:5f77edf287bbd749948a6f"
        };
    }

    // Initialize Firebase
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);

    // Authenticate user
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            userId = user.uid;
            console.log("Usuário autenticado:", userId);
            if (!user.isAnonymous) {
                console.log(`Bem-vindo, ${user.displayName || user.email}! Você pode adicionar/remover jogadores.`);
            } else {
                console.log("Logado como usuário anônimo. Apenas leitura de jogadores permitida. Faça login com o Google para adicionar/remover.");
            }
        } else {
            try {
                if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                    console.log("Tentando autenticar com token personalizado..."); // Log de depuração
                    await signInWithCustomToken(auth, __initial_auth_token);
                    userId = auth.currentUser.uid;
                    console.log("Autenticado com token personalizado:", userId);
                } else {
                    console.log("Tentando autenticar anonimamente (token personalizado não disponível)..."); // Log de depuração
                    await signInAnonymously(auth);
                    userId = auth.currentUser.uid;
                    console.log("Autenticado anonimamente:", userId);
                }
            } catch (error) {
                console.error("Erro na autenticação:", error);
                userId = crypto.randomUUID();
                console.warn("Usando ID de usuário aleatório devido a falha na autenticação. Os dados podem não persistir no Firestore.");
            }
        }
        isAuthReady = true;
        // Agora que a autenticação está pronta, carrega os jogadores e configura o listener do Firestore
        loadPlayers(); // Carrega do localStorage primeiro
        setupFirestorePlayersListener(); // Configura o listener para sincronização com Firestore
        updatePlayerModificationAbility(); // Atualiza a UI e estado dos botões
    });

    // Função para logar com o Google
    window.loginWithGoogle = async () => {
        try {
            await signInWithPopup(auth, googleLoginProvider);
            console.log("Login com Google realizado com sucesso!");
            // A função onAuthStateChanged cuidará da atualização do estado
        } catch (error) {
            console.error("Erro no login com Google:", error);
            // Handle specific errors, e.g., popup closed by user
            if (error.code === 'auth/popup-closed-by-user') {
                console.warn("Login com Google cancelado pelo usuário.");
            }
        }
    };

    // Função para fazer logout
    window.logout = async () => {
        try {
            await signOut(auth);
            console.log("Logout realizado com sucesso!");
            // A função onAuthStateChanged cuidará da atualização do estado
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
        }
    };

    // Função para atualizar a capacidade de modificação de jogadores na UI
    function updatePlayerModificationAbility() {
        const canModify = auth.currentUser && !auth.currentUser.isAnonymous;
        playerNameInput.disabled = !canModify;
        addPlayerButton.disabled = !canModify;

        const removeButtons = document.querySelectorAll('.remove-player-button');
        removeButtons.forEach(button => {
            button.disabled = !canModify;
        });

        if (canModify) {
            console.log("Modificação de jogadores habilitada (usuário logado com Google/Email).");
        } else {
            console.log("Modificação de jogadores desabilitada (usuário anônimo ou não logado).");
        }
    }


    function updateNavScoringButton() {
        const isScoringPageActive = document.getElementById('scoring-page').classList.contains('app-page--active');
        if (isGameInProgress && isScoringPageActive) {
            navScoringButton.innerHTML = '<span class="material-icons sidebar-nav-icon">add_circle</span> Novo Jogo';
        } else {
            navScoringButton.innerHTML = '<span class="material-icons sidebar-nav-icon">sports_volleyball</span> Pontuação';
        }
    }

    function showPage(pageIdToShow) {
        const scoringPageElement = document.getElementById('scoring-page');
        const startPageElement = document.getElementById('start-page');
        const teamsPageElement = document.getElementById('teams-page');

        pages.forEach(page => {
            page.classList.remove('app-page--active');
            page.style.display = 'none';
        });

        if (pageIdToShow === 'start-page') {
            if (scoringPageElement) {
                scoringPageElement.classList.add('app-page--active');
                scoringPageElement.style.display = 'flex';
            }
            if (startPageElement) {
                startPageElement.classList.add('app-page--active');
                startPageElement.style.display = 'flex';
            }

            isGameInProgress = false;
            team1Score = 0;
            team2Score = 0;
            timeElapsed = 0;
            isTimerRunning = false;
            setElapsedTime = 0;
            clearInterval(timerInterval);
            clearInterval(setTimerInterval);
            timerInterval = null;
            setTimerInterval = null;

            const config = JSON.parse(localStorage.getItem('volleyballConfig')) || {};
            activeTeam1Name = config.customTeam1Name || 'Time 1';
            activeTeam2Name = config.customTeam2Name || 'Time 2';
            activeTeam1Color = config.customTeam1Color || '#325fda';
            activeTeam2Color = config.customTeam2Color || '#f03737';
            updateTeamDisplayNamesAndColors();
            renderScoringPagePlayers([], []);
            timerWrapper.style.display = 'none';

        } else if (pageIdToShow === 'scoring-page') {
            if (startPageElement) {
                startPageElement.classList.remove('app-page--active');
                startPageElement.style.display = 'none';
            }
            if (scoringPageElement) {
                scoringPageElement.classList.add('app-page--active');
                scoringPageElement.style.display = 'flex';
            }

            updateScoreDisplay();
            updateTimerDisplay();
            updateSetTimerDisplay();
            updateTeamDisplayNamesAndColors();
            renderScoringPagePlayers(currentTeam1, currentTeam2);
            timerWrapper.style.display = 'flex';

        } else if (pageIdToShow === 'teams-page') {
            if (teamsPageElement) {
                teamsPageElement.classList.add('app-page--active');
                teamsPageElement.style.display = 'flex';
                renderTeams(allGeneratedTeams);
            }
            if (scoringPageElement) {
                scoringPageElement.classList.remove('app-page--active');
                scoringPageElement.style.display = 'none';
            }
            if (startPageElement) {
                startPageElement.classList.remove('app-page--active');
                startPageElement.style.display = 'none';
            }
        }
        else {
            const targetPage = document.getElementById(pageIdToShow);
            if (targetPage) {
                targetPage.classList.add('app-page--active');
                targetPage.style.display = 'flex';
            }
            if (scoringPageElement) {
                scoringPageElement.classList.remove('app-page--active');
                scoringPageElement.style.display = 'none';
            }
            if (startPageElement) {
                startPageElement.classList.remove('app-page--active');
                startPageElement.style.display = 'none';
            }
        }
        updateNavScoringButton();
    }

    menuButton.addEventListener('click', () => sidebar.classList.add('open'));
    closeSidebarButton.addEventListener('click', () => sidebar.classList.remove('open'));

    sidebarNavItems.forEach(button => {
        button.addEventListener('click', (event) => {
            const pageId = event.currentTarget.id.replace('nav-', '') + '-page';
            const currentActivePageId = document.querySelector('.app-page--active')?.id;

            if (event.currentTarget.id === 'nav-scoring') {
                if (isGameInProgress && currentActivePageId === 'scoring-page') {
                    team1Score = 0;
                    team2Score = 0;
                    updateScoreDisplay();

                    clearInterval(timerInterval);
                    clearInterval(setTimerInterval);
                    timerInterval = null;
                    setTimerInterval = null;
                    isTimerRunning = false;
                    timeElapsed = 0;
                    setElapsedTime = 0;
                    updateTimerDisplay();
                    updateSetTimerDisplay();
                    timerWrapper.style.display = 'none';

                    isGameInProgress = false;
                    currentTeam1 = [];
                    currentTeam2 = [];
                    renderScoringPagePlayers([], []);

                    const config = JSON.parse(localStorage.getItem('volleyballConfig')) || {};
                    activeTeam1Name = config.customTeam1Name || 'Time 1';
                    activeTeam2Name = config.customTeam2Name || 'Time 2';
                    activeTeam1Color = config.customTeam1Color || '#325fda';
                    activeTeam2Color = config.customTeam2Color || '#f03737';
                    updateTeamDisplayNamesAndColors();

                    showPage('start-page');
                } else if (isGameInProgress && currentActivePageId !== 'scoring-page') {
                    showPage('scoring-page');
                } else {
                    showPage('start-page');
                }
            } else {
                showPage(pageId);
            }
            updateNavScoringButton();
            sidebar.classList.remove('open');
        });
    });

    startGameButton.addEventListener('click', () => {
        isGameInProgress = true;
        team1Score = 0;
        team2Score = 0;
        timeElapsed = 0;
        setElapsedTime = 0;
        updateTimerDisplay();
        updateSetTimerDisplay();
        toggleTimer();

        if (allGeneratedTeams.length >= 2) {
            currentTeam1 = allGeneratedTeams[0];
            currentTeam2 = allGeneratedTeams[1];

            const config = JSON.parse(localStorage.getItem('volleyballConfig')) || {};
            activeTeam1Name = config[`customTeam1Name`] || `Time 1`;
            activeTeam1Color = config[`customTeam1Color`] || '#325fda';
            activeTeam2Name = config[`customTeam2Name`] || `Time 2`;
            activeTeam2Color = config[`customTeam2Color`] || '#f03737';
        } else {
            currentTeam1 = [];
            currentTeam2 = [];
            const config = JSON.parse(localStorage.getItem('volleyballConfig')) || {};
            activeTeam1Name = config.customTeam1Name || 'Time 1';
            activeTeam2Name = config.customTeam2Name || 'Time 2';
            activeTeam1Color = config.customTeam1Color || '#325fda';
            activeTeam2Color = config.customTeam2Color || '#f03737';
        }

        showPage('scoring-page');
        updateNavScoringButton();
    });

    const playerNameInput = document.getElementById('player-name-input');
    const addPlayerButton = document.getElementById('add-player-button');
    const playersListContainer = document.getElementById('players-list-container');
    const playerCountSpan = document.getElementById('player-count');
    const selectAllPlayersToggle = document.getElementById('select-all-players-toggle');
    const deselectAllButton = document.getElementById('deselect-all-button'); // Este botão está comentado no HTML, mas mantido aqui.

    // Função para salvar jogadores no localStorage
    async function savePlayers() {
        try {
            localStorage.setItem('volleyballPlayers', JSON.stringify(players));
            console.log("Jogadores salvos no localStorage.");
            // A sincronização com o Firestore para mudanças de entrada é feita pelo onSnapshot.
            // Para mudanças de saída (adição/remoção), é feita explicitamente nos event listeners.
        } catch (e) {
            console.error('Erro ao salvar jogadores no localStorage:', e);
        }
    }

    // Função para carregar jogadores do localStorage
    function loadPlayers() {
        try {
            const storedPlayers = localStorage.getItem('volleyballPlayers');
            if (storedPlayers) {
                players = JSON.parse(storedPlayers);
                console.log("Jogadores carregados do localStorage.");
            }
        } catch (e) {
            console.error('Erro ao carregar jogadores do localStorage:', e);
            players = [];
        }
        renderPlayersList(); // Renderiza imediatamente a partir do localStorage
    }

    // Configura o listener em tempo real para jogadores do Firestore
    function setupFirestorePlayersListener() {
        if (!isAuthReady || !db) {
            console.log("Não é possível configurar o listener do Firestore: autenticação não pronta ou DB não inicializado.");
            return;
        }

        const playersCollectionRef = collection(db, `artifacts/${appId}/public/data/players`);
        const q = query(playersCollectionRef);

        onSnapshot(q, (snapshot) => {
            console.log("Atualização do Firestore recebida.");
            const firestorePlayers = [];
            snapshot.forEach((doc) => {
                firestorePlayers.push({ id: doc.id, name: doc.data().name, firestoreId: doc.id });
            });

            const newPlayersState = [];
            const firestoreIdSet = new Set(firestorePlayers.map(p => p.firestoreId));
            
            // Cria um mapa para acesso rápido aos jogadores locais pelo ID
            const localPlayerMap = new Map(players.map(p => [p.id, p]));

            // Processa jogadores locais
            players.forEach(localPlayer => {
                if (localPlayer.firestoreId && firestoreIdSet.has(localPlayer.firestoreId)) {
                    // Jogador existe no Firestore e localmente com um firestoreId correspondente
                    const firestoreVersion = firestorePlayers.find(fp => fp.firestoreId === localPlayer.firestoreId);
                    localPlayer.name = firestoreVersion.name; // Garante que o nome esteja atualizado
                    newPlayersState.push(localPlayer);
                    firestoreIdSet.delete(localPlayer.firestoreId); // Remove do conjunto para não adicionar novamente
                } else if (!localPlayer.firestoreId) {
                    // Jogador é apenas local (adicionado offline)
                    // Verifica se um jogador com o mesmo nome já existe no Firestore (para evitar duplicatas na ressincronização)
                    const existingInFirestoreByName = firestorePlayers.find(fp => fp.name === localPlayer.name);
                    if (existingInFirestoreByName) {
                        // Se existe pelo nome, atualiza o jogador local com o ID do Firestore
                        localPlayer.firestoreId = existingInFirestoreByName.id;
                        newPlayersState.push(localPlayer);
                        firestoreIdSet.delete(existingInFirestoreByName.id); // Remove do conjunto do Firestore
                    } else {
                        // Jogador local verdadeiramente novo, adiciona à lista mesclada
                        newPlayersState.push(localPlayer);
                    }
                }
            });

            // Adiciona quaisquer jogadores restantes do Firestore (aqueles que não foram encontrados localmente)
            firestorePlayers.forEach(fp => {
                if (firestoreIdSet.has(fp.firestoreId)) { // Se ainda estiver no conjunto, significa que não foi processado
                    newPlayersState.push(fp);
                }
            });

            // Ordena newPlayersState por nome para exibição consistente
            newPlayersState.sort((a, b) => a.name.localeCompare(b.name));

            // Deduplicação final por nome (em caso de condições de corrida raras ou problemas de entrada manual)
            const finalPlayers = [];
            const seenNames = new Set();
            for (const player of newPlayersState) {
                if (!seenNames.has(player.name)) {
                    finalPlayers.push(player);
                    seenNames.add(player.name);
                } else {
                    console.warn(`Duplicata de jogador "${player.name}" detectada e removida durante a mesclagem.`);
                }
            }

            players = finalPlayers;
            savePlayers(); // Salva o estado mesclado de volta no localStorage
            renderPlayersList();
            console.log("Jogadores mesclados e lista renderizada.");
        }, (error) => {
            console.error("Erro ao ouvir atualizações do Firestore:", error);
        });
    }

    function renderPlayersList() {
        playersListContainer.innerHTML = '';

        players.forEach((player) => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-list-item';
            // Usa player.id para data-player-id, que pode ser firestoreId ou um UUID local
            playerDiv.innerHTML = `
                <div class="player-info">
                    <label class="switch">
                        <input type="checkbox" checked="checked" class="player-checkbox" data-player-id="${player.id}">
                        <span class="slider round"></span>
                    </label>
                    <span class="player-name-display">${player.name}</span>
                </div>
                <button class="remove-player-button" data-player-id="${player.id}">
                    <span class="material-icons">delete</span>
                </button>
            `;
            playersListContainer.appendChild(playerDiv);
        });
        updatePlayerCount();
        updateSelectAllToggle();
        updatePlayerModificationAbility(); // Garante que os botões de remover estejam no estado correto
    }

    function updatePlayerCount() {
        const checkboxes = document.querySelectorAll('#players-list-container .player-checkbox');
        const selectedPlayers = Array.from(checkboxes).filter(checkbox => checkbox.checked).length;
        playerCountSpan.textContent = `${selectedPlayers}/${players.length}`;
    }

    function updateSelectAllToggle() {
        const checkboxes = document.querySelectorAll('#players-list-container .player-checkbox');
        const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
        selectAllPlayersToggle.checked = allChecked;
    }

    addPlayerButton.addEventListener('click', async () => {
        // Verifica se o usuário tem permissão para modificar jogadores
        if (!auth.currentUser || auth.currentUser.isAnonymous) {
            console.warn("Ação não permitida: Você precisa estar logado com uma conta não anônima para adicionar jogadores.");
            // Você pode adicionar uma mensagem visual para o usuário aqui, sem usar alert().
            return;
        }

        const playerName = playerNameInput.value.trim();
        if (playerName) {
            // Verifica duplicatas antes de adicionar localmente
            if (!players.some(p => p.name === playerName)) {
                const newPlayer = { id: generateLocalId(), name: playerName, firestoreId: null };
                players.push(newPlayer);
                playerNameInput.value = '';
                renderPlayersList(); // Renderiza imediatamente com o novo jogador local
                savePlayers(); // Salva no localStorage

                // Tenta adicionar ao Firestore se estiver online e autenticado
                if (navigator.onLine && isAuthReady) {
                    const playersCollectionRef = collection(db, `artifacts/${appId}/public/data/players`);
                    try {
                        const docRef = await addDoc(playersCollectionRef, { name: playerName });
                        // Atualiza o objeto do jogador local com o ID do Firestore
                        const addedPlayer = players.find(p => p.id === newPlayer.id);
                        if (addedPlayer) {
                            addedPlayer.firestoreId = docRef.id;
                            savePlayers(); // Salva o localStorage atualizado com o ID do Firestore
                            console.log(`Jogador "${playerName}" adicionado ao Firestore com ID: ${docRef.id}`);
                        }
                    } catch (error) {
                        console.error(`Erro ao adicionar jogador "${playerName}" ao Firestore:`, error);
                        // Se a adição ao Firestore falhar, o jogador permanece como apenas local (firestoreId: null)
                    }
                } else {
                    console.log("Offline ou autenticação não pronta, jogador adicionado apenas localmente.");
                }
            } else {
                console.warn(`Jogador "${playerName}" já existe na lista.`);
            }
        }
    });

    playersListContainer.addEventListener('click', async (event) => {
        if (event.target.closest('.remove-player-button')) {
            // Verifica se o usuário tem permissão para modificar jogadores
            if (!auth.currentUser || auth.currentUser.isAnonymous) {
                console.warn("Ação não permitida: Você precisa estar logado com uma conta não anônima para remover jogadores.");
                // Você pode adicionar uma mensagem visual para o usuário aqui, sem usar alert().
                return;
            }

            const button = event.target.closest('.remove-player-button');
            const playerIdToRemove = button.dataset.playerId; // Obtém o ID único do jogador

            const indexToRemove = players.findIndex(p => p.id === playerIdToRemove);

            if (indexToRemove !== -1) {
                const playerToRemove = players[indexToRemove];

                // Remove do array local
                players.splice(indexToRemove, 1);
                renderPlayersList(); // Renderiza imediatamente após a remoção local
                savePlayers(); // Salva no localStorage

                // Se o jogador tinha um ID do Firestore, tenta remover do Firestore
                if (playerToRemove.firestoreId && navigator.onLine && isAuthReady) {
                    const playerDocRef = doc(db, `artifacts/${appId}/public/data/players`, playerToRemove.firestoreId);
                    try {
                        await deleteDoc(playerDocRef);
                        console.log(`Jogador "${playerToRemove.name}" (ID: ${playerToRemove.firestoreId}) removido do Firestore.`);
                    } catch (error) {
                        console.error(`Erro ao remover jogador "${playerToRemove.name}" do Firestore:`, error);
                    }
                } else {
                    console.log("Offline ou autenticação não pronta, jogador removido apenas localmente.");
                }
            }
        } else if (event.target.classList.contains('player-checkbox')) {
            updatePlayerCount();
            updateSelectAllToggle();
        }
    });

    selectAllPlayersToggle.addEventListener('change', () => {
        const checkboxes = document.querySelectorAll('#players-list-container .player-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAllPlayersToggle.checked;
        });
        updatePlayerCount();
    });

    if (deselectAllButton) {
        deselectAllButton.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('#players-list-container .player-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = false;
            });
            updatePlayerCount();
        });
    }

    const generateTeamsButton = document.getElementById('generate-teams-button');
    const teamsGridLayout = document.getElementById('teams-grid-layout');

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function generateTeams() {
        const selectedPlayerElements = document.querySelectorAll('#players-list-container .player-checkbox:checked');
        // Obtém os IDs dos jogadores selecionados dos checkboxes
        const selectedPlayerIds = Array.from(selectedPlayerElements).map(checkbox => checkbox.dataset.playerId);

        // Mapeia os IDs de volta para os nomes dos jogadores usando o array 'players'
        const selectedPlayersNames = players
            .filter(player => selectedPlayerIds.includes(player.id))
            .map(player => player.name);

        if (selectedPlayersNames.length < 1) {
            console.warn('Por favor, selecione pelo menos 1 jogador para gerar times.');
            return;
        }

        const shuffledPlayers = [...selectedPlayersNames]; // Embaralha os nomes, não os objetos completos
        shuffleArray(shuffledPlayers);

        const config = JSON.parse(localStorage.getItem('volleyballConfig')) || {};
        const playersPerTeam = parseInt(config.playersPerTeam) || 4;

        allGeneratedTeams = [];
        let teamCount = 0;
        for (let i = 0; i < shuffledPlayers.length; i++) {
            if (i % playersPerTeam === 0) {
                allGeneratedTeams.push([]);
                teamCount++;
            }
            allGeneratedTeams[teamCount - 1].push(shuffledPlayers[i]);
        }

        currentTeam1 = allGeneratedTeams[0] || [];
        currentTeam2 = allGeneratedTeams[1] || [];

        const configLoaded = JSON.parse(localStorage.getItem('volleyballConfig')) || {};
        activeTeam1Name = configLoaded[`customTeam1Name`] || `Time 1`;
        activeTeam1Color = configLoaded[`customTeam1Color`] || '#325fda';
        activeTeam2Name = configLoaded[`customTeam2Name`] || `Time 2`;
        activeTeam2Color = configLoaded[`customTeam2Color`] || '#f03737';

        renderTeams(allGeneratedTeams);
        renderScoringPagePlayers(currentTeam1, currentTeam2);
        updateTeamDisplayNamesAndColors();
    }

    function renderTeams(teams) {
        teamsGridLayout.innerHTML = '';

        const config = JSON.parse(localStorage.getItem('volleyballConfig')) || {};

        teams.forEach((team, index) => {
            const teamCard = document.createElement('div');
            teamCard.className = 'team-card';

            const teamNameKey = `customTeam${index + 1}Name`;
            const teamColorKey = `customTeam${index + 1}Color`;
            const defaultTeamName = `Time ${index + 1}`;
            const defaultTeamColor = (index % 2 === 0) ? '#325fda' : '#f03737';

            const teamDisplayName = config[teamNameKey] || defaultTeamName;
            const teamDisplayColor = config[teamColorKey] || defaultTeamColor;

            if (index === 0) {
                teamCard.classList.add('team-card--blue-border');
            } else if (index === 1) {
                teamCard.classList.add('team-card--red-border');
            } else {
                teamCard.style.borderLeft = `0.25rem solid ${teamDisplayColor}`;
            }
            teamCard.style.borderLeftColor = teamDisplayColor;


            const teamTitle = document.createElement('h3');
            teamTitle.className = 'team-card-title';
            teamTitle.textContent = teamDisplayName;
            teamCard.appendChild(teamTitle);

            const teamList = document.createElement('ul');
            teamList.className = 'team-card-list';
            team.forEach(player => {
                const li = document.createElement('li');
                li.textContent = player;
                teamList.appendChild(li);
            });
            teamCard.appendChild(teamList);

            teamsGridLayout.appendChild(teamCard);
        });
    }

    generateTeamsButton.addEventListener('click', generateTeams);

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const formattedMinutes = String(minutes).padStart(2, '0');
        const formattedSeconds = String(remainingSeconds).padStart(2, '0');
        return `${formattedMinutes}:${formattedSeconds}`;
    }

    function updateTimerDisplay() {
        timerText.textContent = formatTime(timeElapsed);
    }

    function updateSetTimerDisplay() {
        setTimerText.textContent = formatTime(setElapsedTime);
    }

    function toggleTimer() {
        if (isTimerRunning) {
            clearInterval(timerInterval);
            clearInterval(setTimerInterval);
            timerInterval = null;
            setTimerInterval = null;
            timerToggleButton.innerHTML = '<span class="material-icons">play_arrow</span>';
        } else {
            timerInterval = setInterval(() => {
                timeElapsed++;
                updateTimerDisplay();
            }, 1000);
            setTimerInterval = setInterval(() => {
                setElapsedTime++;
                updateSetTimerDisplay();
            }, 1000);
            timerToggleButton.innerHTML = '<span class="material-icons">pause</span>';
            timerWrapper.style.display = 'flex';
        }
        isTimerRunning = !isTimerRunning;
        updateNavScoringButton();
    }

    timerWrapper.addEventListener('click', toggleTimer);
    if (timerToggleButton) timerToggleButton.removeEventListener('click', toggleTimer);

    function updateScoreDisplay() {
        team1ScoreDisplay.textContent = team1Score;
        team2ScoreDisplay.textContent = team2Score;
    }

    function renderScoringPagePlayers(team1, team2) {
        const team1PlayersScoringTop = document.getElementById('team1-players-scoring-top');
        const team2PlayersScoringTop = document.getElementById('team2-players-scoring-top');
        const teamPlayersColumnGroup = document.querySelector('.team-players-column-group');
        
        const team1Column = team1PlayersScoringTop ? team1PlayersScoringTop.parentElement : null;
        const team2Column = team2PlayersScoringTop ? team2PlayersScoringTop.parentElement : null;

        if (team1PlayersScoringTop) {
            team1PlayersScoringTop.innerHTML = '';
            team1.forEach(player => {
                const li = document.createElement('li');
                li.textContent = player;
                team1PlayersScoringTop.appendChild(li);
            });
        }

        if (team2PlayersScoringTop) {
            team2PlayersScoringTop.innerHTML = '';
            team2.forEach(player => {
                const li = document.createElement('li');
                li.textContent = player;
                team2PlayersScoringTop.appendChild(li);
            });
        }

        const displayPlayersToggle = document.getElementById('display-players-toggle');
        const shouldDisplayPlayers = displayPlayersToggle ? displayPlayersToggle.checked : true;

        if (teamPlayersColumnGroup) {
            if ((team1.length > 0 || team2.length > 0) && shouldDisplayPlayers) {
                teamPlayersColumnGroup.style.display = 'flex';
            } else {
                teamPlayersColumnGroup.style.display = 'none';
            }
        }
        if (team1Column) team1Column.style.display = 'block';
        if (team2Column) team2Column.style.display = 'block';
    }

    function updateTeamDisplayNamesAndColors() {
        if (team1NameDisplay) team1NameDisplay.textContent = activeTeam1Name;
        if (team2NameDisplay) team2NameDisplay.textContent = activeTeam2Name;

        if (team1Panel) team1Panel.style.backgroundColor = activeTeam1Color;
        if (team2Panel) team2Panel.style.backgroundColor = activeTeam2Color;
    }

    if (swapTeamsButton) {
        swapTeamsButton.addEventListener('click', () => {
            [team1Score, team2Score] = [team2Score, team1Score];
            updateScoreDisplay();

            [currentTeam1, currentTeam2] = [currentTeam2, currentTeam1];
            [activeTeam1Name, activeTeam2Name] = [activeTeam2Name, activeTeam1Name];
            [activeTeam1Color, activeTeam2Color] = [activeTeam2Color, activeTeam1Color];

            renderScoringPagePlayers(currentTeam1, currentTeam2);
            updateTeamDisplayNamesAndColors();
        });
    }

    function handleScoreInteraction(event, teamId) {
        event.stopPropagation(); 

        if (event.type === 'touchstart') {
            touchStartY = event.touches[0].clientY;
            event.preventDefault();
            return;
        }

        if (event.type === 'touchend') {
            const touchEndY = event.changedTouches[0].clientY;
            const deltaY = touchEndY - touchStartY;

            if (Math.abs(deltaY) > DRAG_THRESHOLD) {
                if (deltaY > 0) {
                    if (teamId === 'team1-panel' && team1Score > 0) {
                        team1Score--;
                    } else if (teamId === 'team2-panel' && team2Score > 0) {
                        team2Score--;
                    }
                } else {
                    if (teamId === 'team1-panel') {
                        team1Score++;
                    } else if (teamId === 'team2-panel') {
                        team2Score++;
                    }
                }
            } else {
                if (teamId === 'team1-panel') {
                    team1Score++;
                } else {
                    team2Score++;
                }
            }
            updateScoreDisplay();
            return;
        }

        if (event.type === 'click' && (!event.pointerType || event.pointerType === 'mouse')) {
            if (teamId === 'team1-panel') {
                team1Score++;
            } else {
                team2Score++;
            }
            updateScoreDisplay();
        }
    }
    
    if (team1Panel) {
        team1Panel.addEventListener('click', (event) => handleScoreInteraction(event, 'team1-panel'));
        team1Panel.addEventListener('touchstart', (event) => handleScoreInteraction(event, 'team1-panel'), { passive: false }); 
        team1Panel.addEventListener('touchend', (event) => handleScoreInteraction(event, 'team1-panel'), { passive: false }); 
    }
    
    if (team2Panel) {
        team2Panel.addEventListener('click', (event) => handleScoreInteraction(event, 'team2-panel'));
        team2Panel.addEventListener('touchstart', (event) => handleScoreInteraction(event, 'team2-panel'), { passive: false }); 
        team2Panel.addEventListener('touchend', (event) => handleScoreInteraction(event, 'team2-panel'), { passive: false }); 
    }

    function openTeamSelectionModal(panelId) {
        selectingTeamPanelId = panelId;
        modalTeamList.innerHTML = '';

        if (allGeneratedTeams.length === 0) {
            const noTeamsMessage = document.createElement('li');
            noTeamsMessage.textContent = 'Nenhum time gerado ainda. Vá para a tela "Times" para gerar.';
            noTeamsMessage.style.padding = '10px';
            noTeamsMessage.style.color = '#9CA3AF';
            modalTeamList.appendChild(noTeamsMessage);
        } else {
            const config = JSON.parse(localStorage.getItem('volleyballConfig')) || {};

            allGeneratedTeams.forEach((team, index) => {
                const teamNameKey = `customTeam${index + 1}Name`;
                const teamColorKey = `customTeam${index + 1}Color`;
                const defaultTeamName = `Time ${index + 1}`;
                const defaultTeamColor = (index % 2 === 0) ? '#325fda' : '#f03737';

                const teamDisplayName = config[teamNameKey] || defaultTeamName;
                const teamDisplayColor = config[teamColorKey] || defaultTeamColor;

                const listItem = document.createElement('li');
                listItem.classList.add('modal-team-item');
                listItem.dataset.teamIndex = index;

                listItem.innerHTML = `
                    <span class="modal-team-item-name">${teamDisplayName}</span>
                    <div class="modal-team-item-color-box" style="background-color: ${teamDisplayColor};"></div>
                `;
                
                listItem.addEventListener('click', () => selectTeamFromModal(index));
                modalTeamList.appendChild(listItem);
            });
        }
        teamSelectionModal.style.display = 'flex';
    }

    function closeTeamSelectionModal() {
        teamSelectionModal.style.display = 'none';
        selectingTeamPanelId = null;
    }

    function selectTeamFromModal(teamIndex) {
        const selectedTeamPlayers = allGeneratedTeams[teamIndex] || [];
        const config = JSON.parse(localStorage.getItem('volleyballConfig')) || {};

        const teamNameKey = `customTeam${teamIndex + 1}Name`;
        const teamColorKey = `customTeam${teamIndex + 1}Color`;
        const defaultTeamName = `Time ${teamIndex + 1}`;
        const defaultTeamColor = (teamIndex % 2 === 0) ? '#325fda' : '#f03737';

        const selectedTeamName = config[teamNameKey] || defaultTeamName;
        const selectedTeamColor = config[teamColorKey] || defaultTeamColor;

        if (selectingTeamPanelId === 'team1-players-column') {
            currentTeam1 = selectedTeamPlayers;
            activeTeam1Name = selectedTeamName;
            activeTeam1Color = selectedTeamColor;
        } else if (selectingTeamPanelId === 'team2-players-column') {
            currentTeam2 = selectedTeamPlayers;
            activeTeam2Name = selectedTeamName;
            activeTeam2Color = selectedTeamColor;
        }

        renderScoringPagePlayers(currentTeam1, currentTeam2);
        updateTeamDisplayNamesAndColors();
        closeTeamSelectionModal();
    }

    if (team1PlayersColumn) {
        team1PlayersColumn.addEventListener('click', () => {
            openTeamSelectionModal('team1-players-column');
        });
    }
    if (team2PlayersColumn) {
        team2PlayersColumn.addEventListener('click', () => {
            openTeamSelectionModal('team2-players-column');
        });
    }
    if (closeModalButton) {
        closeModalButton.addEventListener('click', closeTeamSelectionModal);
    }


    const accordionHeaders = document.querySelectorAll('.accordion-header');

    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const accordionItem = header.closest('.accordion-item');
            const accordionContent = accordionItem.querySelector('.accordion-content');
            const accordionIcon = header.querySelector('.accordion-icon');

            if (accordionContent.classList.contains('open')) {
                accordionContent.classList.remove('open');
                accordionContent.style.maxHeight = null;
                accordionIcon.classList.remove('active');
                header.classList.remove('active');
            } else {
                accordionHeaders.forEach(otherHeader => {
                    const otherAccordionItem = otherHeader.closest('.accordion-item');
                    const otherAccordionContent = otherAccordionItem.querySelector('.accordion-content');
                    const otherAccordionIcon = otherHeader.querySelector('.accordion-icon');
                    if (otherAccordionContent.classList.contains('open') && otherHeader !== header) {
                        otherAccordionContent.classList.remove('open');
                        otherAccordionContent.style.maxHeight = null;
                        otherAccordionIcon.classList.remove('active');
                        otherHeader.classList.remove('active');
                    }
                });

                accordionContent.classList.add('open');
                accordionContent.style.maxHeight = accordionContent.scrollHeight + 'px';
                accordionIcon.classList.add('active');
                header.classList.add('active');
            }
        });
    });

    const playersPerTeamInput = document.getElementById('players-per-team');
    const pointsPerSetInput = document.getElementById('points-per-set');
    const numberOfSetsInput = document.getElementById('number-of-sets');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const vibrationToggle = document.getElementById('vibration-toggle');
    const displayPlayersToggle = document.getElementById('display-players-toggle');

    const customTeamInputs = [];
    for (let i = 1; i <= 6; i++) {
        customTeamInputs.push({
            name: document.getElementById(`custom-team-${i}-name`),
            color: document.getElementById(`custom-team-${i}-color`)
        });
    }

    function loadConfig() {
        try {
            const config = JSON.parse(localStorage.getItem('volleyballConfig')) || {};
            if (playersPerTeamInput) playersPerTeamInput.value = config.playersPerTeam ?? 4;
            if (pointsPerSetInput) pointsPerSetInput.value = config.pointsPerSet ?? 15;
            if (numberOfSetsInput) numberOfSetsInput.value = config.numberOfSets ?? 1;
            if (darkModeToggle) darkModeToggle.checked = config.darkMode ?? true;
            if (vibrationToggle) vibrationToggle.checked = config.vibration ?? true;
            if (displayPlayersToggle) displayPlayersToggle.checked = config.displayPlayers ?? true;

            customTeamInputs.forEach((input, index) => {
                if (input.name) input.name.value = config[`customTeam${index + 1}Name`] || `Time Personalizado ${index + 1}`;
                if (input.color) input.color.value = config[`customTeam${index + 1}Color`] || (index % 2 === 0 ? '#325fda' : '#f03737');
            });

        } catch (e) {
            console.error('Erro ao carregar configurações:', e);
        }
    }

    function saveConfig() {
        try {
            const config = {
                playersPerTeam: playersPerTeamInput ? parseInt(playersPerTeamInput.value) : 4,
                pointsPerSet: pointsPerSetInput ? parseInt(pointsPerSetInput.value) : 15,
                numberOfSets: numberOfSetsInput ? parseInt(numberOfSetsInput.value) : 1,
                darkMode: darkModeToggle ? darkModeToggle.checked : true,
                vibration: vibrationToggle ? vibrationToggle.checked : true,
                displayPlayers: displayPlayersToggle ? displayPlayersToggle.checked : true
            };

            customTeamInputs.forEach((input, index) => {
                config[`customTeam${index + 1}Name`] = input.name ? input.name.value : `Time Personalizado ${index + 1}`;
                config[`customTeam${index + 1}Color`] = input.color ? input.color.value : (index % 2 === 0 ? '#325fda' : '#f03737');
            });

            localStorage.setItem('volleyballConfig', JSON.stringify(config));
            
            const currentConfig = JSON.parse(localStorage.getItem('volleyballConfig')) || {};
            if (allGeneratedTeams.length > 0 && currentTeam1 === allGeneratedTeams[0]) {
                activeTeam1Name = currentConfig.customTeam1Name || 'Time 1';
                activeTeam1Color = currentConfig.customTeam1Color || '#325fda';
            }
            if (allGeneratedTeams.length > 1 && currentTeam2 === allGeneratedTeams[1]) {
                activeTeam2Name = currentConfig.customTeam2Name || 'Time 2';
                activeTeam2Color = currentConfig.customTeam2Color || '#f03737';
            }
            updateTeamDisplayNamesAndColors();
            renderScoringPagePlayers(currentTeam1, currentTeam2);
            updateNavScoringButton();

        } catch (e) {
            console.error('Erro ao salvar configurações:', e);
        }
    }

    if (playersPerTeamInput) playersPerTeamInput.addEventListener('change', saveConfig);
    if (pointsPerSetInput) pointsPerSetInput.addEventListener('change', saveConfig);
    if (numberOfSetsInput) numberOfSetsInput.addEventListener('change', saveConfig);
    if (darkModeToggle) darkModeToggle.addEventListener('change', saveConfig);
    if (vibrationToggle) vibrationToggle.addEventListener('change', saveConfig);
    if (displayPlayersToggle) displayPlayersToggle.addEventListener('change', saveConfig);

    customTeamInputs.forEach(input => {
        if (input.name) input.name.addEventListener('change', saveConfig);
        if (input.color) input.color.addEventListener('change', saveConfig);
    });

    loadConfig();
    // loadPlayers() e setupFirestorePlayersListener() são chamados após a autenticação estar pronta.
    // renderPlayersList() é chamado por loadPlayers() e setupFirestorePlayersListener().

    showPage('start-page');

    const appVersionDisplay = document.getElementById('app-version-display');

    async function loadAppVersion() {
        if (appVersionDisplay) {
            try {
                const response = await fetch('../service-worker.js');
                const text = await response.text();
                const match = text.match(/const CACHE_NAME = '(.*?)';/);
                if (match && match[1]) {
                    appVersionDisplay.textContent = match[1];
                } else {
                    appVersionDisplay.textContent = 'Não disponível';
                }
            } catch (error) {
                console.error('Erro ao carregar a versão do app:', error);
                appVersionDisplay.textContent = 'Erro ao carregar';
            }
        }
    }

    loadAppVersion();

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('../service-worker.js')
                .then(registration => {
                    console.log('Service Worker registrado com sucesso:', registration);
                })
                .catch(error => {
                    console.error('Falha no registro do Service Worker:', error);
                });
        });
    }
});
