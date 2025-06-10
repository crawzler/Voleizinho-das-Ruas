// js/ui/elements.js
// Contém a seleção de todos os elementos DOM usados no aplicativo, agora com carregamento tardio.

// Sidebar e Menu
export const sidebar = () => document.getElementById('sidebar');
export const menuButton = () => document.getElementById('menu-button');
// export const closeSidebarButton = () => document.getElementById('close-sidebar-button'); // Removido do HTML
export const sidebarNavItems = () => document.querySelectorAll('.sidebar-nav-item'); // Pode continuar sendo um querySelectorAll
export const userIdDisplay = () => document.getElementById('user-id-display');
// Elementos para foto e nome do usuário no sidebar
export const userProfilePicture = () => document.getElementById('user-profile-picture');
export const userDisplayName = () => document.getElementById('user-display-name');
export const userProfileHeader = () => document.getElementById('user-profile-header'); // O novo container clicável

// Elementos do mini-menu do perfil
export const profileMenu = () => document.getElementById('profile-menu');
export const profileLogoutButton = () => document.getElementById('profile-logout-button');
export const userProfileContainer = () => document.getElementById('user-profile-container');

// Overlay do Sidebar
export const sidebarOverlay = () => document.getElementById('sidebar-overlay');

// Páginas
export const pages = () => document.querySelectorAll('.app-page');
export const loginPage = () => document.getElementById('login-page');
export const startPage = () => document.getElementById('start-page');
export const scoringPage = () => document.getElementById('scoring-page');
export const teamsPage = () => document.getElementById('teams-page');
export const playersPage = () => document.getElementById('players-page');
export const configPage = () => document.getElementById('config-page');
export const historyPage = () => document.getElementById('history-page');
export const schedulingPage = () => document.getElementById('scheduling-page');
export const statsPage = () => document.getElementById('stats-page');

// Elementos da página de Login
export const googleLoginButton = () => document.getElementById('google-login-button');
export const anonymousLoginButton = () => document.getElementById('anonymous-login-button');

// Elementos da página de Pontuação
export const team1ScoreDisplay = () => document.getElementById('team1-score');
export const team2ScoreDisplay = () => document.getElementById('team2-score');
export const team1Panel = () => document.getElementById('team1-panel');
export const team2Panel = () => document.getElementById('team2-panel');
export const team1NameDisplay = () => document.getElementById('team1-name');
export const team2NameDisplay = () => document.getElementById('team2-name');
export const timerText = () => document.getElementById('timer-text');
export const setTimerText = () => document.getElementById('set-timer-text');
export const team1PlayersColumn = () => document.getElementById('team1-players-column');
export const team2PlayersColumn = () => document.getElementById('team2-players-column');
export const swapTeamsButton = () => document.getElementById('swap-teams-button');
export const timerAndSetTimerWrapper = () => document.getElementById('timer-and-set-timer-wrapper');
export const endGameButton = () => document.getElementById('end-game-button'); // Botão para encerrar jogo
export const team1Stars = () => document.getElementById('team1-stars');
export const team2Stars = () => document.getElementById('team2-stars');


// Modal de Seleção de Time (usado na página de pontuação)
export const teamSelectionModal = () => document.getElementById('team-selection-modal');
export const modalTeamList = () => document.getElementById('modal-team-list');
export const closeModalButton = () => document.getElementById('close-modal-button'); // Removido do HTML
export const closeModalButtonTopRight = () => document.getElementById('close-modal-button-top-right'); // NOVO: Botão de fechar no canto superior direito do modal

// Elementos da página de Times
export const generateTeamsButton = () => document.getElementById('generate-teams-button');
export const teamsGridLayout = () => document.getElementById('teams-grid-layout');

// Elementos da página de Jogadores
export const newPlayerNameInput = () => document.getElementById('new-player-name-input');
export const addPlayerButton = () => document.getElementById('add-player-button');
export const playersListContainer = () => document.getElementById('players-list-container');
export const playerCountSpan = () => document.getElementById('player-count');
export const selectAllPlayersToggle = () => document.getElementById('select-all-players-toggle');

// Elementos da página de Configurações
export const playersPerTeamInput = () => document.getElementById('players-per-team');
export const pointsPerSetInput = () => document.getElementById('points-per-set');
export const numberOfSetsInput = () => document.getElementById('number-of-sets');
export const darkModeToggle = () => document.getElementById('dark-mode-toggle');
export const vibrationToggle = () => document.getElementById('vibration-toggle');
export const displayPlayersToggle = () => document.getElementById('display-players-toggle');
// NOVO: Toggle para exibir Status de Conexão
export const showConnectionStatusToggle = () => document.getElementById('show-connection-status-toggle');
export const configContainer = () => document.querySelector('.config-section'); // ou outro seletor apropriado para o container de configurações

// Inputs de times personalizados (para fácil iteração)
export const customTeamInputs = [
    { name: () => document.getElementById('custom-team-1-name'), color: () => document.getElementById('custom-team-1-color') },
    { name: () => document.getElementById('custom-team-2-name'), color: () => document.getElementById('custom-team-2-color') },
    { name: () => document.getElementById('custom-team-3-name'), color: () => document.getElementById('custom-team-3-color') },
    { name: () => document.getElementById('custom-team-4-name'), color: () => document.getElementById('custom-team-4-color') },
    { name: () => document.getElementById('custom-team-5-name'), color: () => document.getElementById('custom-team-5-color') },
    { name: () => document.getElementById('custom-team-6-name'), color: () => document.getElementById('custom-team-6-color') },
];

export const resetAppButton = () => document.getElementById('reset-app-button'); // Botão de reiniciar app
export const resetConfigButton = () => document.getElementById('reset-config-button'); // Botão de redefinir configurações

// Elementos de Informação do App
export const appVersionDisplay = () => document.getElementById('app-version-display');

// Mensagens de Notificação
export const messageContainer = () => document.getElementById('message-container');

// Botões de navegação lateral (diretamente do sidebar-nav)
export const navScoringButton = () => document.getElementById('nav-scoring');
export const navTeamsButton = () => document.getElementById('nav-teams');
export const navPlayersButton = () => document.getElementById('nav-players');
export const navHistoryButton = () => document.getElementById('nav-history');
export const navSchedulingButton = () => document.getElementById('nav-scheduling');
export const navStatsButton = () => document.getElementById('nav-stats');
export const navConfigButton = () => document.getElementById('nav-config');

// NOVO: Headers do Accordion
export const accordionHeaders = () => document.querySelectorAll('.accordion-header');

// Elementos da página de Histórico
export const historyListContainer = () => document.getElementById('history-list-container');


// Elementos da página de Agendamento
export const dateInput = () => document.getElementById('date-input');
export const startTimeInput = () => document.getElementById('start-time-input');
export const endTimeInput = () => document.getElementById('end-time-input');
export const locationInput = () => document.getElementById('location-input');
export const notesInput = () => document.getElementById('notes-input');
export const scheduleGameButton = () => document.getElementById('schedule-game-button');
export const upcomingGamesList = () => document.getElementById('upcoming-games-list');
export const pastGamesList = () => document.getElementById('past-games-list');
export const pastGamesAccordion = () => document.getElementById('past-games-accordion'); // O accordion item inteiro

// Modal de Confirmação
export const confirmationModal = () => document.getElementById('confirmation-modal');
export const confirmationMessage = () => document.getElementById('confirmation-message');
export const confirmYesButton = () => document.getElementById('confirm-yes-button');
export const confirmNoButton = () => document.getElementById('confirm-no-button');

// Indicador de Conexão
export const connectionIndicator = () => document.getElementById('connection-indicator');
export const statusDot = () => document.querySelector('#connection-indicator .status-dot');
export const statusText = () => document.querySelector('#connection-indicator .status-text');

// NOVO: Overlay de Carregamento
export const loadingOverlay = () => document.getElementById('loading-overlay');

// Campo de Chave Admin (nova adição)
export const adminKeyInput = () => document.getElementById('admin-key-input');
