// js/ui/elements.js
// Contém a seleção de todos os elementos DOM usados no aplicativo, agora com carregamento tardio.

// Sidebar e Menu
export const sidebar = () => document.getElementById('sidebar');
export const menuButton = () => document.getElementById('menu-button');
export const closeSidebarButton = () => document.getElementById('close-sidebar-button');
export const sidebarNavItems = () => document.querySelectorAll('.sidebar-nav-item'); // Pode continuar sendo um querySelectorAll
export const userIdDisplay = () => document.getElementById('user-id-display');
// Elementos para foto e nome do usuário no sidebar
export const userProfilePicture = () => document.getElementById('user-profile-picture');
export const userDisplayName = () => document.getElementById('user-display-name');
export const userProfileHeader = () => document.getElementById('user-profile-header'); // O novo container clicável

// Elementos do mini-menu do perfil
export const profileMenu = () => document.getElementById('profile-menu');
export const profileLogoutButton = () => document.getElementById('profile-logout-button');
export const profileSettingsButton = () => document.getElementById('profile-settings-button');

// NOVO: Overlay do sidebar
export const sidebarOverlay = () => document.getElementById('sidebar-overlay');


// Páginas
export const pages = () => document.querySelectorAll('.app-page'); // Pode continuar sendo um querySelectorAll
export const loginPage = () => document.getElementById('login-page');
export const startPage = () => document.getElementById('start-page');
export const scoringPage = () => document.getElementById('scoring-page');
export const teamsPage = () => document.getElementById('teams-page');
export const playersPage = () => document.getElementById('players-page');
export const configPage = () => document.getElementById('config-page');
export const historyPage = () => document.getElementById('history-page');
export const statsPage = () => document.getElementById('stats-page');
export const schedulingPage = () => document.getElementById('scheduling-page'); // Adicionado

// Botões de Navegação
export const navScoringButton = () => document.getElementById('nav-scoring');
// REMOVIDO: export const navLogoutButton = () => document.getElementById('nav-logout');

// Tela de Login
export const googleLoginButton = () => document.getElementById('google-login-button');
export const anonymousLoginButton = () => document.getElementById('anonymous-login-button');

// Tela de Pontuação
export const team1Panel = () => document.getElementById('team1-panel');
export const team1NameDisplay = () => document.getElementById('team1-name');
export const team1ScoreDisplay = () => document.getElementById('team1-score');
export const team1PlayersColumn = () => document.getElementById('team1-players-column');

export const team2Panel = () => document.getElementById('team2-panel');
export const team2NameDisplay = () => document.getElementById('team2-name');
export const team2ScoreDisplay = () => document.getElementById('team2-score');
export const team2PlayersColumn = () => document.getElementById('team2-players-column');

export const team1Stars = () => document.getElementById('team1-stars');
export const team2Stars = () => document.getElementById('team2-stars');

export const timerText = () => document.getElementById('timer-text');
export const setTimerText = () => document.getElementById('set-timer-text');
export const timerAndSetTimerWrapper = () => document.getElementById('timer-and-set-timer-wrapper'); // O ID correto é 'timer-and-set-timer-wrapper'

// Tela de Jogadores
export const newPlayerNameInput = () => document.getElementById('new-player-name-input');
export const addPlayerButton = () => document.getElementById('add-player-button');
export const playersListContainer = () => document.getElementById('players-list-container');
export const playerCountSpan = () => document.getElementById('player-count');
export const selectAllPlayersToggle = () => document.getElementById('select-all-players-toggle');

// Tela de Times
export const generateTeamsButton = () => document.getElementById('generate-teams-button');
export const teamsGridLayout = () => document.getElementById('teams-grid-layout');

// Modal de Seleção de Time
export const teamSelectionModal = () => document.getElementById('team-selection-modal');
export const modalTeamList = () => document.getElementById('modal-team-list');
export const closeModalButton = () => document.getElementById('close-modal-button');
export const closeModalButtonTopRight = () => document.getElementById('close-modal-button-top-right'); // NOVO: Botão de fechar no canto superior direito

// Tela de Configurações
export const accordionHeaders = () => document.querySelectorAll('.accordion-header'); // Pode continuar sendo um querySelectorAll
export const playersPerTeamInput = () => document.getElementById('players-per-team');
export const pointsPerSetInput = () => document.getElementById('points-per-set');
export const numberOfSetsInput = () => document.getElementById('number-of-sets');
export const darkModeToggle = () => document.getElementById('dark-mode-toggle');
export const vibrationToggle = () => document.getElementById('vibration-toggle');
export const displayPlayersToggle = () => document.getElementById('display-players-toggle');
export const appVersionDisplay = () => document.getElementById('app-version-display');
export const resetConfigButton = () => document.getElementById('reset-config-button');

export const customTeamInputs = [];
for (let i = 1; i <= 6; i++) {
    // Estas serão funções que retornam os elementos, como os outros
    customTeamInputs.push({
        name: () => document.getElementById(`custom-team-${i}-name`),
        color: () => document.getElementById(`custom-team-${i}-color`)
    });
}

// Página de Histórico
export const historyListContainer = () => document.getElementById('history-list-container');

// Página de Agendamentos (NOVO)
export const dateInput = () => document.getElementById('date-input');
export const startTimeInput = () => document.getElementById('start-time-input');
export const endTimeInput = () => document.getElementById('end-time-input');
export const locationInput = () => document.getElementById('location-input');
export const notesInput = () => document.getElementById('notes-input');
export const scheduleGameButton = () => document.getElementById('schedule-game-button');
export const upcomingGamesList = () => document.getElementById('upcoming-games-list');
export const pastGamesList = () => document.getElementById('past-games-list');
export const pastGamesAccordion = () => document.getElementById('past-games-accordion');

// Modal de Confirmação (NOVO)
export const confirmationModal = () => document.getElementById('confirmation-modal');
export const confirmationMessage = () => document.getElementById('confirmation-message');
export const confirmYesButton = () => document.getElementById('confirm-yes-button');
export const confirmNoButton = () => document.getElementById('confirm-no-button');
