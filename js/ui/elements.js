// js/ui/elements.js
// Contém a seleção de todos os elementos DOM usados no aplicativo.

// Sidebar e Menu
export const sidebar = document.getElementById('sidebar');
export const menuButton = document.getElementById('menu-button');
export const closeSidebarButton = document.getElementById('close-sidebar-button');
export const sidebarNavItems = document.querySelectorAll('.sidebar-nav-item');
export const userIdDisplay = document.getElementById('user-id-display'); // Novo elemento para exibir o UID

// Páginas
export const pages = document.querySelectorAll('.app-page');
export const loginPage = document.getElementById('login-page'); // Nova página de login
export const startPage = document.getElementById('start-page');
export const scoringPage = document.getElementById('scoring-page');
export const teamsPage = document.getElementById('teams-page');
export const playersPage = document.getElementById('players-page');
export const configPage = document.getElementById('config-page');
export const historyPage = document.getElementById('history-page');
export const schedulingPage = document.getElementById('scheduling-page'); // Adicionado
export const statsPage = document.getElementById('stats-page');

// Botões de Navegação
export const navScoringButton = document.getElementById('nav-scoring');
export const navLogoutButton = document.getElementById('nav-logout'); // Novo botão de logout

// Tela de Login
export const googleLoginButton = document.getElementById('google-login-button'); // Botão de login do Google

// Tela de Pontuação
export const team1ScoreDisplay = document.getElementById('team1-score-display');
export const team2ScoreDisplay = document.getElementById('team2-score-display');
export const timerText = document.querySelector('.timer-text');
export const setTimerText = document.getElementById('set-timer-text');
export const timerToggleButton = document.querySelector('.timer-toggle-button');
export const timerWrapper = document.querySelector('.timer-wrapper');
export const team1Panel = document.getElementById('team1-panel');
export const team2Panel = document.getElementById('team2-panel');
export const team1NameDisplay = document.getElementById('team1-name-display');
export const team2NameDisplay = document.getElementById('team2-name-display');
export const team1PlayersColumn = document.getElementById('team1-players-column');
export const team2PlayersColumn = document.getElementById('team2-players-column');

// Tela de Times
export const selectTeam1Button = document.getElementById('select-team1-button');
export const selectTeam2Button = document.getElementById('select-team2-button');

// Tela de Jogadores
export const newPlayerNameInput = document.getElementById('new-player-name-input');
export const addPlayerButton = document.getElementById('add-player-button');
export const playersListContainer = document.getElementById('players-list-container');
export const playerCountSpan = document.getElementById('player-count-span');
export const selectAllPlayersToggle = document.getElementById('select-all-players-toggle');
export const deselectAllButton = document.getElementById('deselect-all-button'); // Comentado no HTML, mas mantido aqui

// Tela de Times
export const generateTeamsButton = document.getElementById('generate-teams-button');
export const teamsGridLayout = document.getElementById('teams-grid-layout');

// Modal de Seleção de Time
export const teamSelectionModal = document.getElementById('team-selection-modal');
export const modalTeamList = document.getElementById('modal-team-list');
export const closeModalButton = document.getElementById('close-modal-button');

// Tela de Configurações
export const accordionHeaders = document.querySelectorAll('.accordion-header');
export const playersPerTeamInput = document.getElementById('players-per-team');
export const pointsPerSetInput = document.getElementById('points-per-set');
export const numberOfSetsInput = document.getElementById('number-of-sets');
export const darkModeToggle = document.getElementById('dark-mode-toggle');
export const vibrationToggle = document.getElementById('vibration-toggle');
export const displayPlayersToggle = document.getElementById('display-players-toggle');
export const appVersionDisplay = document.getElementById('app-version-display');

export const customTeamInputs = [];
for (let i = 1; i <= 6; i++) {
    customTeamInputs.push({
        name: document.getElementById(`custom-team-${i}-name`),
        color: document.getElementById(`custom-team-${i}-color`)
    });
}
