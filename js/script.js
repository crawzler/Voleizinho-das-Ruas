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

            // allGeneratedTeams NÃO é mais resetado aqui
            // currentTeam1 e currentTeam2 NÃO são mais resetados aqui

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
                    // allGeneratedTeams NÃO é mais resetado aqui
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
            // Removido o console.warn para não exibir a mensagem se os times não foram gerados
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
    const deselectAllButton = document.getElementById('deselect-all-button');

    let players = [];

    function loadPlayers() {
        try {
            const storedPlayers = localStorage.getItem('volleyballPlayers');
            if (storedPlayers) {
                players = JSON.parse(storedPlayers);
            }
        } catch (e) {
            players = [];
        }
    }

    function savePlayers() {
        try {
            localStorage.setItem('volleyballPlayers', JSON.stringify(players));
        } catch (e) {
        }
    }

    function renderPlayersList() {
        playersListContainer.innerHTML = '';

        players.sort((a, b) => a.localeCompare(b));

        players.forEach((player, index) => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-list-item';
            playerDiv.innerHTML = `
                <div class="player-info">
                    <label class="switch">
                        <input type="checkbox" checked="checked" class="player-checkbox" data-player-name="${player}">
                        <span class="slider round"></span>
                    </label>
                    <span class="player-name-display">${player}</span>
                </div>
                <button class="remove-player-button" data-index="${index}">
                    <span class="material-icons">delete</span>
                </button>
            `;
            playersListContainer.appendChild(playerDiv);
        });
        updatePlayerCount();
        updateSelectAllToggle();
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

    addPlayerButton.addEventListener('click', () => {
        const playerName = playerNameInput.value.trim();
        if (playerName && !players.includes(playerName)) {
            players.push(playerName);
            savePlayers();
            renderPlayersList();
            playerNameInput.value = '';
        }
    });

    playersListContainer.addEventListener('click', (event) => {
        if (event.target.closest('.remove-player-button')) {
            const button = event.target.closest('.remove-player-button');
            const indexToRemove = parseInt(button.dataset.index);
            players.splice(indexToRemove, 1);
            savePlayers();
            renderPlayersList();
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
    
    loadPlayers();
    renderPlayersList();

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
        const selectedPlayers = Array.from(selectedPlayerElements).map(checkbox => checkbox.dataset.playerName);

        if (selectedPlayers.length < 1) {
            // Log removido
            return;
        }

        const shuffledPlayers = [...selectedPlayers];
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
        activeTeam2Name = configLoaded[`customTeam2Name`] || `Time 2`;
        activeTeam1Color = configLoaded[`customTeam1Color`] || '#325fda';
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

            const teamName = config[teamNameKey] || defaultTeamName;
            const teamColor = config[teamColorKey] || defaultTeamColor;

            if (index === 0) {
                teamCard.classList.add('team-card--blue-border');
            } else if (index === 1) {
                teamCard.classList.add('team-card--red-border');
            } else {
                teamCard.style.borderLeft = `0.25rem solid ${teamColor}`;
            }
            teamCard.style.borderLeftColor = teamColor;


            const teamTitle = document.createElement('h3');
            teamTitle.className = 'team-card-title';
            teamTitle.textContent = teamName;
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
            // Log removido
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
            // Log removido
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
    loadPlayers();
    renderPlayersList();

    showPage('start-page');

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('../service-worker.js')
                .then(registration => {
                    // Log removido
                })
                .catch(error => {
                    // Log removido
                });
        });
    }
});
