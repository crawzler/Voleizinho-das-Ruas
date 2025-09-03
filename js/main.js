// js/main.js
// Ponto de entrada principal do seu aplicativo. Orquestra a inicialização e os módulos.

import { initFirebaseApp, getAppId } from './firebase/config.js';
import { logout, setupAuthListener, signInAnonymouslyUser, updateProfileMenuLoginState, getCurrentUser, loginWithGoogle } from './firebase/auth.js'; // Imports updateProfileMenuLoginState
import { setupFirestorePlayersListener } from './data/players.js';
import * as SchedulesData from './data/schedules.js'; // Keep this for other uses of SchedulesData
// Removed imports related to processPendingNotificationAttendance
import { showPage, updatePlayerModificationAbility, setupSidebar, setupPageNavigation, setupAccordion, setupScoreInteractions, setupTeamSelectionModal, closeSidebar, hideConfirmationModal, showConfirmationModal, forceUpdateIcons } from './ui/pages.js';
import { setupConfigUI, loadConfig } from './ui/config-ui.js'; // Importa loadConfig
import { startGame, toggleTimer, swapTeams, endGame, restoreSavedGameIfAny } from './game/logic.js';
import { generateTeams } from './game/teams.js';
import { loadAppVersion, registerServiceWorker } from './utils/app-info.js';
import { getPlayers } from './data/players.js';
import * as Elements from './ui/elements.js';
import { displayMessage } from './ui/messages.js';
import { updatePlayerCount, updateSelectAllToggle, savePlayerSelectionState } from './ui/players-ui.js';
import { setupHistoryPage } from './ui/history-ui.js';
import { setupSchedulingPage, updateSchedulingPermissions } from './ui/scheduling-ui.js';
import './ui/profile-menu.js';
import { setupQuickSettings } from './ui/quick-settings.js';
import { setupSidebar as setupModernSidebar } from './ui/sidebar-ui.js';
import { registerNotificationServiceWorker } from './utils/notifications.js';
import { initWelcomeNotifications } from './ui/welcome-notifications.js';
import { initDailyReminders } from './utils/daily-reminders.js';
import connectivityManager from './utils/connectivity.js';
import offlineStorage from './utils/offline-storage.js';
import pwaManager from './utils/pwa-manager.js';
import { getActiveTeam1Name } from '../js/game/logic.js';
import { getActiveTeam2Name } from '../js/game/logic.js';
import safeAreasManager from './utils/safe-areas.js';

import { signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

let authListenerInitialized = false;
export function markAuthInitialized() { authListenerInitialized = true; }
let loadingTimeout = null;

// Use exatamente os UIDs das regras do Firebase
const ADMIN_UIDS = [
    "fVTPCFEN5KSKt4me7FgPyNtXHMx1",
    "Q7cjHJcQoMV9J8IEaxnFFbWNXw22"
    // Adicione mais UIDs de admin aqui, se necessário
];

// Função utilitária para checar se o usuário atual é admin
function isCurrentUserAdmin() {
    const user = getCurrentUser();
    if (!user || !user.uid) return false;
    return ADMIN_UIDS.includes(user.uid);
}

// Função utilitária para checar se o usuário atual está autenticado com Google
function isCurrentUserGoogle() {
    const user = getCurrentUser();
    if (!user || !user.uid) return false;
    // Firebase define isAnonymous = true para usuários anônimos
    return !user.isAnonymous;
}

/**
 * Atualiza o indicador de status de conexão na UI.
 * @param {'online' | 'offline' | 'reconnecting'} status - O status da conexão.
 */
// Exporta funções para uso em outros módulos
export { loadOfflineData, setupAutoSave };

export function updateConnectionIndicator(status) {
    const indicator = Elements.connectionIndicator();
    const statusDot = Elements.statusDot();
    const statusText = Elements.statusText();

    if (!indicator || !statusDot || !statusText) {
        return;
    }

    const config = loadConfig(); // Carrega a configuração mais recente

    if (!config.showConnectionStatus) {
        indicator.classList.add('hidden-by-config');
        return;
    } else {
        indicator.classList.remove('hidden-by-config');
    }

    statusDot.className = 'status-dot'; // Resets the classes
    statusText.textContent = ''; // Resets the text

    switch (status) {
        case 'online':
            if (isCurrentUserGoogle()) {
                statusDot.classList.add('online'); // Verde para autenticado Google
            } else {
                statusDot.classList.add('not-admin-online'); // Cinza para anônimo ou visitante
            }
            statusText.textContent = 'Online';
            break;
        case 'offline':
            statusDot.classList.add('offline');
            statusText.textContent = 'Offline';
            break;
        case 'reconnecting':
            statusDot.classList.add('reconnecting');
            statusText.textContent = 'Reconectando...';
            break;
    }
}

/**
 * Hides the loading overlay.
 */
export function hideLoadingOverlay() {
    const loadingOverlay = Elements.loadingOverlay();
    if (loadingOverlay && !loadingOverlay.classList.contains('hidden')) {
        loadingOverlay.classList.add('hidden');
        if (loadingTimeout) {
            clearTimeout(loadingTimeout);
            loadingTimeout = null;
        }
    }
}

function waitForCorrectPage(targetPageId, maxAttempts = 20, interval = 100) {
    let attempts = 0;
    const check = () => {
        const activePage = document.querySelector('.app-page--active');
        const activeId = activePage ? activePage.id : null;
        if (activeId === targetPageId) {
            return;
        }
        attempts++;
        if (attempts < maxAttempts) {
            setTimeout(check, interval);
        }
    };
    check();
}

/**
 * Parseia parâmetros anexados ao hash e dispara a ação de notificação se presente.
 * Exemplo de hash: #scheduling-page?action=going&id=abc123
 */
function processNotificationHashParams() {
    try {
        const hash = window.location.hash || '';
        if (!hash.includes('?')) return;
        const [, query] = hash.split('?');
        if (!query) return;
        const params = new URLSearchParams(query);
        const action = params.get('action');
        const id = params.get('id');
        if (action || id) {
            const data = id ? { id } : null;
            import('./utils/notifications.js').then(mod => {
                if (mod && typeof mod.handleNotificationAction === 'function') {
                    mod.handleNotificationAction(action || 'view', data);
                }
            }).catch(() => {});
        }
    } catch (e) {
        // silencioso
    }
}

// Processa notificações pendentes enviadas pelo service worker antes do app estar pronto
function processPendingNotificationFromSession() {
    try {
        const raw = sessionStorage.getItem('pendingNotification');
        if (!raw) return;
        const data = JSON.parse(raw);
        sessionStorage.removeItem('pendingNotification');
        if (data && data.type === 'NOTIFICATION_ACTION') {
            import('./utils/notifications.js').then(mod => {
                if (mod && typeof mod.handleNotificationAction === 'function') {
                    mod.handleNotificationAction(data.action, data.data || null);
                }
            }).catch(() => {});
        }
    } catch (e) {}
}

document.addEventListener('DOMContentLoaded', async () => {
    window.isAppReady = true;
    

    
    // Navegação automática baseada no hash ao abrir o app
    if (window.location.hash && window.location.hash.startsWith('#') && window.location.hash.length > 1) {
        const pageId = window.location.hash.substring(1);
        // Só ativa se o elemento existe e termina com '-page'
        if (document.getElementById(pageId) && pageId.endsWith('-page')) {
            const mod = await import('./ui/pages.js');
            if (mod && typeof mod.showPage === 'function') {
                mod.showPage(pageId);
                waitForCorrectPage(pageId);
            }
        }
    }
    handleHashNavigation();
    // Process notification action if app opened with hash params (e.g. #scheduling-page?action=going&id=...)
    try {
        processNotificationHashParams();
    } catch (e) {}
    try {
        processPendingNotificationFromSession();
    } catch (e) {}
    // Se for admin, cria overlay de debug para logs do service worker
    try {
        // Auth may still be initializing; poll briefly for admin status and create overlay when ready
        const waitForAdminOverlay = (timeoutMs = 10000, intervalMs = 500) => {
            let elapsed = 0;
            const id = setInterval(() => {
                try {
                    if (typeof isCurrentUserAdmin === 'function' && isCurrentUserAdmin()) {
                        createAdminSwLogOverlay();
                        clearInterval(id);
                        return;
                    }
                } catch (e) {}
                elapsed += intervalMs;
                if (elapsed >= timeoutMs) clearInterval(id);
            }, intervalMs);
        };
        waitForAdminOverlay();
    } catch (e) {}
});
    // --- SCOREBOARD MENU DROPDOWN ---
    const scoreboardMenuButton = document.getElementById("scoreboard-menu-button");
    const scoreboardMenuDropdown = document.getElementById("scoreboard-menu-dropdown");
    const scoreboardMenuOverlay = document.getElementById("scoreboard-menu-overlay");




    scoreboardMenuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = scoreboardMenuDropdown.classList.toggle("show");
    if (isOpen) {
        scoreboardMenuOverlay.classList.add("active");
    } else {
        scoreboardMenuOverlay.classList.remove("active");
    }
});
    
// Fechar ao clicar no overlay
scoreboardMenuOverlay.addEventListener("click", () => {
    scoreboardMenuDropdown.classList.remove("show");
    scoreboardMenuOverlay.classList.remove("active");
});




    // Seleciona o primeiro botão do scoreboard-menu-dropdown
    const invertTeamsButton = document.querySelector('#scoreboard-menu-dropdown button:first-child');

    // Adiciona um evento de clique ao botão
    invertTeamsButton.addEventListener('click', () => {
    // Chama a função swapTeams quando o botão for clicado
    import('../js/game/logic.js').then(mod => {
        mod.swapTeams();
    });
    });

    
    // Seleciona o terceiro botão do scoreboard-menu-dropdown
    const team2ChangeButtonOption = document.querySelector('#scoreboard-menu-dropdown button:nth-child(3)');

    // Define o texto com o nome atual do time 2 preservando o ícone
    if (team2ChangeButtonOption) {
        const iconEl = team2ChangeButtonOption.querySelector('.material-icons');
        const iconHTML = iconEl ? iconEl.outerHTML : '';
        team2ChangeButtonOption.innerHTML = `Substituir ${getActiveTeam2Name()} ${iconHTML}`;
        // Adiciona um evento de clique ao botão
        team2ChangeButtonOption.addEventListener('click', async () => {
            // Abre o modal de seleção diretamente para o painel do Time 2
            const mod = await import('./ui/pages.js');
            if (mod && typeof mod.openTeamSelectionModal === 'function') {
                mod.openTeamSelectionModal('team2');
            }
        });
    }


    // Seleciona o segundo botão do scoreboard-menu-dropdown
    const team1ChangeButtonOption = document.querySelector('#scoreboard-menu-dropdown button:nth-child(2)');

    // Define o texto com o nome atual do time 1 preservando o ícone
    if (team1ChangeButtonOption) {
        const iconEl = team1ChangeButtonOption.querySelector('.material-icons');
        const iconHTML = iconEl ? iconEl.outerHTML : '';
        team1ChangeButtonOption.innerHTML = `Substituir ${getActiveTeam1Name()} ${iconHTML}`;
        // Adiciona um evento de clique ao botão
        team1ChangeButtonOption.addEventListener('click', async () => {
            // Abre o modal de seleção diretamente para o painel do Time 1
            const mod = await import('./ui/pages.js');
            if (mod && typeof mod.openTeamSelectionModal === 'function') {
                mod.openTeamSelectionModal('team1');
            }
        });
    }








        
    // Última opção: Configuração rápida da partida
    const quickSettingsOption = document.querySelector('#scoreboard-menu-dropdown button:nth-child(4)');
    if (quickSettingsOption) {
        const iconEl = quickSettingsOption.querySelector('.material-icons');
        const iconHTML = iconEl ? iconEl.outerHTML : '';
        quickSettingsOption.innerHTML = `Configurar partida ${iconHTML}`;
        quickSettingsOption.addEventListener('click', async () => {
            // Abre o modal de configurações rápidas diretamente (sem depender do botão removido)
            const mod = await import('./ui/quick-settings.js');
            if (mod && typeof mod.openQuickSettingsModal === 'function') {
                mod.openQuickSettingsModal();
            }
        });
    }

    // Exibe a tela de carregamento imediatamente
    const loadingOverlay = Elements.loadingOverlay();
    if (loadingOverlay) {
        loadingOverlay.classList.remove('hidden'); // Garante que a tela de carregamento esteja visível
    }


    // Inicia o timer para forçar a liberação da UI caso a autenticação demore
    loadingTimeout = setTimeout(() => {
        const overlay = Elements.loadingOverlay ? Elements.loadingOverlay() : null;
        if (!authListenerInitialized || (overlay && !overlay.classList.contains('hidden'))) {
            displayMessage("Carregando demorou, iniciando sem login.", "info");
            if (window.location.hash === '#scheduling') {
                showPage('scheduling-page');
            } else {
                showPage('players-page');
            }
            updateConnectionIndicator('offline');
            hideLoadingOverlay();
        }
    }, 5000);


    const { app, db, auth } = await initFirebaseApp();
    const appId = getAppId();

    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
            await signInWithCustomToken(auth, __initial_auth_token);
        } catch (error) {

        }
    }


    await registerNotificationServiceWorker();

    // Listen for messages from service worker (notification actions)
    if (navigator.serviceWorker && navigator.serviceWorker.addEventListener) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'NOTIFICATION_ACTION') {
                try {
                    // If the app isn't ready yet, store for later
                    if (!window.isAppReady) {
                        sessionStorage.setItem('pendingNotification', JSON.stringify(event.data));
                    } else {
                        // Call handler from notifications util if available
                        import('./utils/notifications.js').then(mod => {
                            if (mod && typeof mod.handleNotificationAction === 'function') {
                                mod.handleNotificationAction(event.data.action, event.data.data || null);
                            }
                        }).catch(() => {});
                    }
                } catch (e) {}
            }
        });
    }

    // Quando a aba ficar visível novamente, processa notificações pendentes (caso o SW tenha enviado antes)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            try { processPendingNotificationFromSession(); } catch (e) {}
            try { processPendingActionsFromSwDb(); } catch (e) {}
        }
    });

// --- IndexedDB reader for pending actions written by the SW ---
function openSwDbFromClient() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('sw-debug-logs', 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function readPendingActions(limit = 10) {
    try {
        const db = await openSwDbFromClient();
        const tx = db.transaction('pending_actions', 'readwrite');
        const store = tx.objectStore('pending_actions');
        return await new Promise((resolve, reject) => {
            const items = [];
            const req = store.openCursor();
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor && items.length < limit) {
                    items.push(cursor.value);
                    cursor.delete(); // limpa após ler
                    cursor.continue();
                } else {
                    resolve(items);
                }
            };
            req.onerror = () => reject(req.error);
        }).finally(() => db.close());
    } catch (e) {
        return [];
    }
}

async function processPendingActionsFromSwDb() {
    try {
        const pending = await readPendingActions(20);
        if (!pending || pending.length === 0) return;
        // Processa em ordem: do mais antigo para o mais novo
        pending.reverse().forEach(item => {
            try {
                import('./utils/notifications.js').then(mod => {
                    if (mod && typeof mod.handleNotificationAction === 'function') {
                        mod.handleNotificationAction(item.action, item.data || null);
                    }
                });
            } catch (e) {}
        });
    } catch (e) {}
}

// ---------------- Admin SW log overlay ----------------
// Ask the service worker to broadcast its logs (used by the admin overlay)
function askSwForLogs() {
    try {
        const statusEl = document.getElementById('admin-sw-status');
        if (statusEl) statusEl.textContent = 'Requesting logs from SW...';

        // Try controller first (MessageChannel or simple postMessage)
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            try {
                navigator.serviceWorker.controller.postMessage({ type: 'GET_SW_DEBUG_LOGS', limit: 500 });
            } catch (e) {}
        }

        // Fallback: postMessage to all registrations' active workers
        if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function') {
            navigator.serviceWorker.getRegistrations().then(regs => {
                for (const r of (regs || [])) {
                    if (r && r.active && typeof r.active.postMessage === 'function') {
                        try { r.active.postMessage({ type: 'GET_SW_DEBUG_LOGS', limit: 500 }); } catch (e) {}
                    }
                }
            }).catch(() => {});
        }

        // Give the SW a short moment to respond/write DB, then refresh the overlay
        setTimeout(() => refreshAdminSwLogs(false), 900);
    } catch (e) {
        try { refreshAdminSwLogs(false); } catch (_) {}
    }
}

// Try to force the service worker to control this page: re-register and reload
function takeControl() {
    try {
        const statusEl = document.getElementById('admin-sw-status');
        if (statusEl) statusEl.textContent = 'Attempting to take control (re-registering SW)...';

        // Try to register a new copy (with cache-bust) and then call skipWaiting on waiting worker
        const stamp = Date.now();
        navigator.serviceWorker.register(`./service-worker.js?v=${stamp}`).then(async reg => {
            // If there's a waiting worker, tell it to skipWaiting
            if (reg.waiting) {
                try { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (_) {}
            }

            // Try to request claim from active worker via MessageChannel
            try {
                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                    const mc = new MessageChannel();
                    const resp = await new Promise((resolve) => {
                        let settled = false;
                        mc.port1.onmessage = (e) => { settled = true; resolve(e.data); };
                        try { navigator.serviceWorker.controller.postMessage({ type: 'REQUEST_CLAIM' }, [mc.port2]); } catch (e) { settled = true; resolve(null); }
                        setTimeout(() => { if (!settled) resolve(null); }, 2000);
                    });
                    if (resp && (resp.type === 'CLIENT_CLAIMED' || resp.success)) {
                        // success: reload so controller becomes available
                        setTimeout(() => window.location.reload(), 300);
                        return;
                    }
                }
            } catch (e) {}

            // Fallback: if no controller or claim didn't confirm, reload after short wait
            setTimeout(() => window.location.reload(), 800);
        }).catch(() => {
            // fallback: hard reload
            setTimeout(() => window.location.reload(true), 400);
        });
    } catch (e) {
        try { window.location.reload(); } catch (_) {}
    }
}

function createAdminSwLogOverlay() {
    if (document.getElementById('admin-sw-log-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'admin-sw-log-overlay';
    overlay.style.position = 'fixed';
    overlay.style.right = '12px';
    overlay.style.bottom = '12px';
    overlay.style.width = '520px';
    overlay.style.maxHeight = '70vh';
    overlay.style.background = '#0b1220';
    overlay.style.color = '#e6eef8';
    overlay.style.fontSize = '13px';
    overlay.style.padding = '12px';
    overlay.style.borderRadius = '10px';
    overlay.style.zIndex = '99999';
    overlay.style.boxShadow = '0 10px 30px rgba(0,0,0,0.6)';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';

    overlay.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <strong style="font-size:14px">SW Debug</strong>
            <div style="display:flex;align-items:center">
                <button id="admin-sw-minimize" title="Minimize" style="margin-right:8px;padding:6px 8px">_</button>
                <button id="admin-sw-refresh" style="margin-right:8px;padding:6px 8px">Refresh</button>
                <button id="admin-sw-copylogs" style="margin-right:8px;padding:6px 8px">Copy logs</button>
                <button id="admin-sw-ask" style="margin-right:8px;padding:6px 8px">Ask SW</button>
                <button id="admin-sw-clear" style="margin-right:8px;padding:6px 8px">Clear</button>
                <button id="admin-sw-close" style="padding:6px 8px">Close</button>
            </div>
        </div>
        <div id="admin-sw-main">
          <div style="display:flex;gap:8px;margin-bottom:8px">
              <button id="admin-sw-tab-pending" style="flex:1;padding:6px;background:#081122;color:#cfe8ff;border:0;border-radius:6px">Pending</button>
              <button id="admin-sw-tab-logs" style="flex:1;padding:6px;background:transparent;color:#9fb9d9;border:1px solid rgba(255,255,255,0.04);border-radius:6px">Logs</button>
          </div>
          <div id="admin-sw-status" style="font-size:12px;opacity:0.9;margin-bottom:8px;color:#c0dff6"></div>
          <div id="admin-sw-log-list" style="overflow:auto;flex:1;background:#07111a;padding:8px;border-radius:6px;font-family:monospace;white-space:pre-wrap;color:#bfe6ff"></div>
        </div>
        <div id="admin-sw-minbar" style="display:none;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px;">
            <div style="font-size:13px;color:#cfe8ff;">SW Debug (minimized)</div>
            <div style="display:flex;gap:8px">
                <button id="admin-sw-restore" style="padding:6px 8px">Restore</button>
                <button id="admin-sw-close-min" style="padding:6px 8px">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('admin-sw-close').addEventListener('click', () => overlay.remove());
    document.getElementById('admin-sw-refresh').addEventListener('click', () => refreshAdminSwLogs(true));
    document.getElementById('admin-sw-copylogs').addEventListener('click', async () => {
        try {
            await copySwLogsToClipboard();
            const statusEl = document.getElementById('admin-sw-status');
            if (statusEl) statusEl.textContent = 'Logs copied to clipboard';
        } catch (e) {
            const statusEl = document.getElementById('admin-sw-status');
            if (statusEl) statusEl.textContent = 'Failed to copy logs';
        }
    });
    // Minimize / Restore handlers
    document.getElementById('admin-sw-minimize').addEventListener('click', () => {
        try {
            const overlayEl = document.getElementById('admin-sw-log-overlay');
            const main = document.getElementById('admin-sw-main');
            const minbar = document.getElementById('admin-sw-minbar');
            if (!overlayEl || !main || !minbar) return;
            // hide main content and show minbar
            main.style.display = 'none';
            minbar.style.display = 'flex';
            // tighten overlay box
            overlayEl.style.width = '260px';
            overlayEl.style.maxHeight = '';
            overlayEl.style.height = '40px';
            overlayEl.style.overflow = 'visible';
        } catch (e) {}
    });
    document.getElementById('admin-sw-restore').addEventListener('click', () => {
        try {
            const overlayEl = document.getElementById('admin-sw-log-overlay');
            const main = document.getElementById('admin-sw-main');
            const minbar = document.getElementById('admin-sw-minbar');
            if (!overlayEl || !main || !minbar) return;
            main.style.display = 'block';
            minbar.style.display = 'none';
            overlayEl.style.width = '520px';
            overlayEl.style.maxHeight = '70vh';
            overlayEl.style.height = '';
            overlayEl.style.overflow = 'auto';
        } catch (e) {}
    });
    document.getElementById('admin-sw-close-min').addEventListener('click', () => { const o = document.getElementById('admin-sw-log-overlay'); if (o) o.remove(); });
    document.getElementById('admin-sw-ask').addEventListener('click', () => askSwForLogs());
    document.getElementById('admin-sw-clear').addEventListener('click', async () => {
        const statusEl = document.getElementById('admin-sw-status');
        try {
            if (statusEl) statusEl.textContent = 'Clearing DB...';
            // First, ask the service worker to clear its copy (if active)
            let swCleared = false;
            try {
                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                    const mc = new MessageChannel();
                    const resp = await new Promise((resolve) => {
                        let settled = false;
                        mc.port1.onmessage = (e) => { settled = true; resolve(e.data); };
                        try { navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_SW_DEBUG_DB' }, [mc.port2]); } catch (e) { settled = true; resolve(null); }
                        setTimeout(() => { if (!settled) resolve(null); }, 3000);
                    });
                    if (resp && (resp.success || resp.type === 'CLEAR_SW_DEBUG_DB_DONE')) swCleared = true;
                }
            } catch (e) {}

            // Fallback: postMessage to active registrations so SW can clear itself
            if (!swCleared && navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === 'function') {
                try {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    for (const r of (regs || [])) {
                        if (r && r.active && typeof r.active.postMessage === 'function') {
                            try { r.active.postMessage({ type: 'CLEAR_SW_DEBUG_DB' }); } catch (e) {}
                        }
                    }

                    // wait briefly for SW to process
                    await new Promise(res => setTimeout(res, 600));
                } catch (e) {}
            }

            // Now clear the client-side view of the DB as well
            await clearSwDebugDb();
            // small delay to ensure DB commits
            await new Promise(r => setTimeout(r, 300));
            refreshAdminSwLogs(true);
        } catch (e) {
            if (statusEl) statusEl.textContent = 'Error clearing DB';
        }
    });
    document.getElementById('admin-sw-tab-pending').addEventListener('click', () => { document.getElementById('admin-sw-tab-pending').style.background='#081122'; document.getElementById('admin-sw-tab-logs').style.background='transparent'; refreshAdminSwLogs(false, 'pending'); });
    document.getElementById('admin-sw-tab-logs').addEventListener('click', () => { document.getElementById('admin-sw-tab-logs').style.background='#081122'; document.getElementById('admin-sw-tab-pending').style.background='transparent'; refreshAdminSwLogs(false, 'logs'); });

    // Load immediately
    setTimeout(() => refreshAdminSwLogs(true), 200);
}

async function refreshAdminSwLogs(forceAll = false, tab = 'both') {
    const listEl = document.getElementById('admin-sw-log-list');
    if (!listEl) return;
    const statusEl = document.getElementById('admin-sw-status');
    if (statusEl) statusEl.textContent = 'Checking SW status...';
    listEl.textContent = 'Loading...';
    try {
        // SW controller/registration status
        let controllerExists = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
        let regInfo = null;
        try {
            const regs = await navigator.serviceWorker.getRegistrations();
            if (regs && regs.length) {
                const r = regs[0];
                regInfo = { scope: r.scope, active: !!r.active, scriptURL: r.active && r.active.scriptURL };
            }
        } catch (e) { regInfo = null; }
        if (statusEl) statusEl.textContent = `controller:${controllerExists} registration:${regInfo ? JSON.stringify(regInfo) : 'none'}`;
        let logs = [];
        let pending = [];

        // First try reading from IndexedDB directly
        try {
            if (tab === 'both' || tab === 'logs') logs = await readSwLogsFromClient(200);
            if (tab === 'both' || tab === 'pending') pending = await readPendingActionsClient(200);
        } catch (dbErr) {
            // ignore and try SW message fallback
            logs = [];
            pending = [];
        }

        // If empty and we want more, ask the service worker via MessageChannel or via registration.active.postMessage
        if ((logs.length === 0 && (tab === 'both' || tab === 'logs')) || (pending.length === 0 && (tab === 'both' || tab === 'pending')) || forceAll) {
            try {
                // Helper: wait for a one-shot message from the SW (fallback when DB reads fail)
                const waitForSwMessage = (timeoutMs = 2500) => new Promise((resolve) => {
                    let done = false;
                    const onMsg = (e) => {
                        try {
                            if (!e || !e.data) return;
                            // Accept SW_DEBUG_LOGS, NOTIFICATION_CLICK_RECEIVED, CLIENT_CLAIMED
                            if (e.data.type === 'SW_DEBUG_LOGS' && (e.data.logs || e.data.pending)) {
                                done = true;
                                navigator.serviceWorker.removeEventListener('message', onMsg);
                                resolve(e.data);
                                return;
                            }
                            if (e.data.type === 'NOTIFICATION_CLICK_RECEIVED' && e.data.payload) {
                                done = true;
                                navigator.serviceWorker.removeEventListener('message', onMsg);
                                resolve({ pending: [e.data.payload] });
                                return;
                            }
                            if (e.data.type === 'CLIENT_CLAIMED') {
                                done = true;
                                navigator.serviceWorker.removeEventListener('message', onMsg);
                                resolve({ claimed: true });
                                return;
                            }
                        } catch (_) {}
                    };
                    try { navigator.serviceWorker.addEventListener('message', onMsg); } catch (_) { resolve(null); return; }
                    setTimeout(() => {
                        if (!done) {
                            try { navigator.serviceWorker.removeEventListener('message', onMsg); } catch (_) {}
                            resolve(null);
                        }
                    }, timeoutMs);
                });

                // Try controller via MessageChannel first (direct port response is ideal)
                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                    try {
                        const mc = new MessageChannel();
                        const result = await new Promise((resolve) => {
                            let settled = false;
                            mc.port1.onmessage = (e) => { settled = true; resolve(e.data); };
                            try { navigator.serviceWorker.controller.postMessage({ type: 'GET_SW_DEBUG_LOGS', limit: 500 }, [mc.port2]); } catch (e) { settled = true; resolve(null); }
                            setTimeout(() => { if (!settled) resolve(null); }, 2000);
                        }).catch(() => null);
                        if (result && result.logs) logs = result.logs;
                    } catch (e) {}
                }

                // If still empty, try registrations fallback and also listen for a broadcasted message from SW
                if ((logs.length === 0) && navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
                    try {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        for (const r of (regs || [])) {
                            if (r && r.active && typeof r.active.postMessage === 'function') {
                                try {
                                    r.active.postMessage({ type: 'GET_SW_DEBUG_LOGS', limit: 500 });
                                } catch (e) {}
                            }
                        }

                        // Wait briefly for the SW to broadcast logs to clients, prefer direct message payload if available
                        const swMsg = await waitForSwMessage(2200);
                        if (swMsg && swMsg.logs && swMsg.logs.length) {
                            logs = swMsg.logs;
                        }

                        // Give SW a moment to write DB and retry reading DB if still empty
                        if (logs.length === 0) {
                            await new Promise(res => setTimeout(res, 800));
                            if (tab === 'both' || tab === 'logs') logs = await readSwLogsFromClient(200);
                            if (tab === 'both' || tab === 'pending') pending = await readPendingActionsClient(200);
                        }
                    } catch (e) {}
                }
            } catch (swMsgErr) {
                // ignore
            }
        }

        let out = '';
        if (tab === 'both' || tab === 'pending') {
            out += '--- Pending Actions ---\n';
            if (!pending || pending.length === 0) out += '(none)\n';
            else pending.forEach(p => out += `${new Date(p.ts).toISOString()} ${p.action} ${JSON.stringify(p.data)}\n`);
            out += '\n';
        }

        if (tab === 'both' || tab === 'logs') {
            out += '--- SW Logs ---\n';
            if (!logs || logs.length === 0) out += '(none)\n';
            else logs.forEach(l => out += `${new Date(l.ts).toISOString()} ${l.type} ${JSON.stringify(l)}\n`);
        }

        listEl.textContent = out;
        listEl.scrollTop = 0;
    } catch (e) {
        listEl.textContent = 'Error reading logs: ' + (e && e.message ? e.message : String(e));
    }
}

// Readers for the SW DB from the client
function openSwDbFromClientSimple() {
    // Open DB and create stores if missing (safe from client side)
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('sw-debug-logs', 1);
        req.onupgradeneeded = (e) => {
            try {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('logs')) db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('pending_actions')) db.createObjectStore('pending_actions', { keyPath: 'id', autoIncrement: true });
            } catch (_) { /* ignore */ }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function readSwLogsFromClient(limit = 100) {
    try {
    const db = await openSwDbFromClientSimple();
        const tx = db.transaction('logs', 'readonly');
        const store = tx.objectStore('logs');
        return await new Promise((resolve, reject) => {
            const items = [];
            const req = store.openCursor(null, 'prev');
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor && items.length < limit) {
                    items.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(items);
                }
            };
            req.onerror = () => reject(req.error);
        }).finally(() => db.close());
    } catch (e) {
        return [];
    }
}

async function readPendingActionsClient(limit = 100) {
    try {
    const db = await openSwDbFromClientSimple();
    const tx = db.transaction('pending_actions', 'readonly');
    const store = tx.objectStore('pending_actions');
        return await new Promise((resolve, reject) => {
            const items = [];
            const req = store.openCursor();
            req.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor && items.length < limit) {
                    items.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(items);
                }
            };
            req.onerror = () => reject(req.error);
        }).finally(() => db.close());
    } catch (e) {
        return [];
    }
}

// Clear the SW debug DB (logs and pending_actions)
function clearSwDebugDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('sw-debug-logs', 1);
        req.onupgradeneeded = (e) => {
            // nothing to do, stores will be created if missing
            try { const db = e.target.result; if (!db.objectStoreNames.contains('logs')) db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true }); if (!db.objectStoreNames.contains('pending_actions')) db.createObjectStore('pending_actions', { keyPath: 'id', autoIncrement: true }); } catch(_){}
        };
        req.onsuccess = () => {
            try {
                const db = req.result;
                const tx = db.transaction(['logs','pending_actions'],'readwrite');
                tx.objectStore('logs').clear();
                tx.objectStore('pending_actions').clear();
                tx.oncomplete = () => { try { db.close(); } catch(_){}; resolve(true); };
                tx.onerror = () => { try { db.close(); } catch(_){}; reject(tx.error || new Error('clear_failed')); };
            } catch (e) { try { req.result && req.result.close(); } catch(_){}; reject(e); }
        };
        req.onerror = () => reject(req.error || new Error('open_failed'));
    });
}

// Copy current overlay logs to clipboard (reads from client DB if necessary)
async function copySwLogsToClipboard() {
    const listEl = document.getElementById('admin-sw-log-list');
    if (!listEl) throw new Error('no_list');
    let text = listEl.textContent || '';

    // If empty, try reading logs directly
    if (!text || text.trim().length === 0) {
        const logs = await readSwLogsFromClient(500);
        const pending = await readPendingActionsClient(500);
        let out = '';
        out += '--- Pending Actions ---\n';
        if (!pending || pending.length === 0) out += '(none)\n'; else pending.forEach(p => out += `${new Date(p.ts).toISOString()} ${p.action} ${JSON.stringify(p.data)}\n`);
        out += '\n--- SW Logs ---\n';
        if (!logs || logs.length === 0) out += '(none)\n'; else logs.forEach(l => out += `${new Date(l.ts).toISOString()} ${l.type} ${JSON.stringify(l)}\n`);
        text = out;
    }

    // Try navigator.clipboard first
    if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
    }

    // Fallback: create textarea and execCommand
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) throw new Error('copy_failed');
        return true;
    } catch (e) {
        try { document.body.removeChild(ta); } catch(_){}
        throw e;
    }
}


    setupAuthListener(auth, db, appId);


    setupSidebar();
    setupModernSidebar();
    setupPageNavigation(startGame, getPlayers, appId);
    setupAccordion();
    setupConfigUI();
    setupScoreInteractions();
    setupTeamSelectionModal();
    setupHistoryPage();
    setupSchedulingPage();
    setupQuickSettings();

    // Listeners for team page buttons
    const generateTeamsButton = document.getElementById('generate-teams-button');
    if (generateTeamsButton) {
        generateTeamsButton.addEventListener('click', () => {
            showConfirmationModal(
                'Deseja gerar os times agora? Isso pode reorganizar os times atuais.',
                () => {
                    generateTeams(appId);
                }
            );
        });
    }

    // --- Indicador visual de overflow (sombra) para a área de times ---
    const teamsSub = document.querySelector('.teams-page-layout-sub');
    if (teamsSub) {
        const updateShadows = () => {
            const scrollTop = teamsSub.scrollTop;
            const scrollHeight = teamsSub.scrollHeight;
            const clientHeight = teamsSub.clientHeight;

            if (scrollTop > 5) {
                teamsSub.classList.add('has-scroll-top');
            } else {
                teamsSub.classList.remove('has-scroll-top');
            }

            if (scrollTop + clientHeight < scrollHeight - 5) {
                teamsSub.classList.add('has-scroll-bottom');
            } else {
                teamsSub.classList.remove('has-scroll-bottom');
            }
        };

        teamsSub.addEventListener('scroll', updateShadows, { passive: true });
        window.addEventListener('resize', updateShadows);
        setTimeout(updateShadows, 100);
    }

    const toggleTimerButton = document.getElementById('toggle-timer-button');
    if (toggleTimerButton) {
        toggleTimerButton.addEventListener('click', () => {
            toggleTimer();
        });
    }

    const swapTeamsButton = document.getElementById('swap-teams-button');
    if (swapTeamsButton) {
        swapTeamsButton.addEventListener('click', () => {
            swapTeams();
        });
    }

    const timerAndSetTimerWrapperElement = Elements.timerAndSetTimerWrapper();
    if (timerAndSetTimerWrapperElement) {
        timerAndSetTimerWrapperElement.addEventListener('click', () => {
            toggleTimer();
        });
    }

    const endGameButton = document.getElementById('end-game-button');
    if (endGameButton) {
        endGameButton.addEventListener('click', () => {
            showConfirmationModal(
                'Are you sure you want to end the game? The score will be saved to history.',
                () => {
                    endGame();
                }
            );
        });
    }

    const googleLoginButton = document.getElementById('google-login-button');
    if (googleLoginButton) {
        googleLoginButton.addEventListener('click', () => {
            loginWithGoogle();
        });
    }

    const anonymousLoginButton = document.getElementById('anonymous-login-button');
    if (anonymousLoginButton) {
        anonymousLoginButton.addEventListener('click', () => {
            signInAnonymouslyUser(appId);
        });
    }
    
    setTimeout(() => {
        if (window.pwaManager) {
            window.pwaManager.checkInstallStatus();
            if (!window.pwaManager.isInstalled) {
                window.pwaManager.showLoginInstallButton();
            }
        }
    }, 2000);

    try {
        await offlineStorage.init();
    } catch (error) {
        // Error initializing offline storage
    }
    

    connectivityManager.onStatusChange(async (status) => {
        if (status === 'online') {
            displayMessage("Online novamente! Sincronizando dados...", "info");
            updateConnectionIndicator('reconnecting');
            
            try {
                const { app, db, auth } = await initFirebaseApp();
                const appId = getAppId();
                
                await setupAuthListener(auth, db, appId);
                await setupFirestorePlayersListener(db, appId);
                updateProfileMenuLoginState();
                updateSchedulingPermissions();
                
                if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = false;
                if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = false;
                
                displayMessage("Dados sincronizados com sucesso!", "success");
                updateConnectionIndicator('online');
            } catch (error) {

                displayMessage("Erro ao sincronizar dados", "error");
                updateConnectionIndicator('offline');
            }
        } else {
            displayMessage("Você está offline. Dados salvos localmente.", "warning");
            
            if (Elements.googleLoginButton()) Elements.googleLoginButton().disabled = true;
            if (Elements.anonymousLoginButton()) Elements.anonymousLoginButton().disabled = true;
            
            updateProfileMenuLoginState();
            updateConnectionIndicator('offline');
            
            await loadOfflineData();
        }
    });

    // Dropdown user menu logic
    const userDropdown = document.getElementById('userDropdown');
    const userDropdownToggle = document.getElementById('userDropdownToggle');
    const userDropdownMenu = document.getElementById('userDropdownMenu');
    const logoutBtn = document.getElementById('logoutBtn');

    if (userDropdown && userDropdownToggle && userDropdownMenu && logoutBtn) {
        userDropdownToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        });

        userDropdownMenu.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        document.addEventListener('click', () => {
            userDropdown.classList.remove('show');
        });

        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            userDropdown.classList.remove('show');
            logout();
        });
    }

    updateConnectionIndicator(connectivityManager.getStatus());

    (function setupScrollbarVisibility() {
        const scrollables = new Set();
        const selectors = [
            'body', '.app-main-content', '.sidebar-menu',
            '#players-page', '#teams-page', '#history-page', '#config-page', '#scheduling-page',
            '.players-list-container', '.teams-page-layout-sub', '.scheduling-container', '.tab-content', '.schedule-modal-content', '.substitute-modal-content', '.substitute-players-list', '.accordion-content', '.select-team-modal-content-wrapper', '.team-players-column'
        ];
        const elems = selectors.flatMap(sel => Array.from(document.querySelectorAll(sel)));
        elems.forEach(el => {
            if (!el) return;
            const handler = () => {
                el.classList.add('is-scrolling');
                clearTimeout(el.__sbTimer);
                el.__sbTimer = setTimeout(() => el.classList.remove('is-scrolling'), 550);
            };
            el.addEventListener('scroll', handler, { passive: true });
            scrollables.add(el);
        });
        window.addEventListener('scroll', () => {
            document.body.classList.add('is-scrolling');
            clearTimeout(window.__sbTimer);
            window.__sbTimer = setTimeout(() => document.body.classList.remove('is-scrolling'), 550);
        }, { passive: true });
    })();

    document.body.addEventListener('touchstart', e => {
        if (e.touches.length !== 1) return;

    const modalOpen = document.querySelector('.quick-settings-modal.active') || document.querySelector('.substitute-modal') || document.querySelector('.select-team-modal-container.modal-active') || document.querySelector('.confirmation-modal-overlay.active') || document.querySelector('.schedule-modal.active');
        if (modalOpen) return;

    if (e.target.closest('.substitute-modal-content') || e.target.closest('.substitute-players-list') || e.target.closest('.teams-page-layout-sub') || e.target.closest('.players-list-container') || e.target.closest('.quick-settings-content') || e.target.closest('.quick-settings-modal') || e.target.closest('.config-page-layout') || e.target.closest('.accordion-content') || e.target.closest('.accordion-content-sub') || e.target.closest('.settings-list') || e.target.closest('.accordion-content-sub-teams') || e.target.closest('.accordion-content-sub-full-width') || e.target.closest('#scheduling-page') || e.target.closest('.scheduling-container') || e.target.closest('.tab-content') || e.target.closest('.schedule-modal') || e.target.closest('.schedule-modal-content')) {
            return;
        }
        const startY = e.touches[0].clientY;
        if (startY <= 10 && window.scrollY === 0) {
            e.preventDefault();
        }
    }, { passive: false });

    document.body.addEventListener('touchmove', e => {
    const modalOpen = document.querySelector('.quick-settings-modal.active') || document.querySelector('.substitute-modal') || document.querySelector('.select-team-modal-container.modal-active') || document.querySelector('.confirmation-modal-overlay.active') || document.querySelector('.schedule-modal.active');
        if (modalOpen) return;

        if (e.target.closest('.players-list-container') ||
            e.target.closest('.player-category-tabs') ||
            e.target.closest('.teams-page-layout-sub') ||
            e.target.closest('.substitute-modal-content') ||
            e.target.closest('.substitute-players-list') ||
            e.target.closest('.quick-settings-content') ||
            e.target.closest('.quick-settings-modal') ||
            e.target.closest('.config-page-layout') ||
            e.target.closest('.accordion-content') ||
            e.target.closest('.accordion-content-sub') ||
            e.target.closest('.settings-list') ||
            e.target.closest('.accordion-content-sub-teams') ||
            e.target.closest('.accordion-content-sub-full-width') ||
            e.target.closest('#scheduling-page') ||
            e.target.closest('.scheduling-container') ||
            e.target.closest('.tab-content') ||
            e.target.closest('.schedule-modal') ||
            e.target.closest('.schedule-modal-content')) {
            return;
        }
        e.preventDefault();
    }, { passive: false });

    loadAppVersion();
    registerServiceWorker();

    try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('clearCache') === '1' && 'serviceWorker' in navigator) {
            if (navigator.serviceWorker.controller) {
                const messageChannel = new MessageChannel();
                messageChannel.port1.onmessage = (event) => {
                    if (event.data && event.data.success) {
                        window.location.reload(true);
                    }
                };
                navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' }, [messageChannel.port2]);
            } else {
                navigator.serviceWorker.getRegistrations().then(regs => Promise.all(regs.map(r => r.unregister()))).then(() => window.location.reload(true));
            }
        }
    } catch (err) {

    }
    
    initDailyReminders();
    
    setupAutoSave();

    if (Elements.sidebarOverlay()) {
        Elements.sidebarOverlay().addEventListener('click', () => {
            closeSidebar();
        });
    }
    
    setTimeout(async () => {
        try {
            const restored = restoreSavedGameIfAny();
            if (restored) {
            }
            await updateStartButtonText();
            forceUpdateIcons();
            
            if (window.pwaManager) {
                window.pwaManager.checkInstallStatus();
                if (!window.pwaManager.isInstalled) {
                    window.pwaManager.showLoginInstallButton();
                }
            }
        } catch (e) {

        }
    }, 100);

    window.isAppReady = true;

    // Verifica se há ações pendentes de notificação
    setTimeout(() => {
        const fromNotification = sessionStorage.getItem('fromNotification');
        const notificationTimestamp = sessionStorage.getItem('notificationTimestamp');
        
        if (fromNotification === 'true' && notificationTimestamp) {
            const timeDiff = Date.now() - parseInt(notificationTimestamp);
            // Se a notificação foi recente (menos de 10 segundos)
            if (timeDiff < 10000) {

                
                // Verifica se há dados de RSVP pendentes
                const lastRSVPData = sessionStorage.getItem('lastRSVPData');
                const pendingScheduleId = sessionStorage.getItem('pendingOpenRsvpScheduleId');
                
                if (lastRSVPData || pendingScheduleId) {
                    // Garante que estamos na página de agendamentos
                    if (typeof showPage === 'function') {
                        showPage('scheduling-page');
                    } else {
                        window.location.hash = '#scheduling-page';
                    }
                }
            }
            
            // Limpa os flags após processar
            sessionStorage.removeItem('fromNotification');
            sessionStorage.removeItem('notificationTimestamp');
        }
    }, 1000);






// Enforce no autocomplete on all forms and inputs, and prevent password save prompts
(function setupNoAutocomplete() {
    function applyNoAutoForInput(el) {
        if (!el) return;
        try {
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                // Generic fields: disable autocomplete and suggestions
                el.setAttribute('autocomplete', 'off');
                el.setAttribute('autocapitalize', 'off');
                el.setAttribute('autocorrect', 'off');
                el.spellcheck = false;

                // Password fields: use new-password to avoid save/update prompts
                if (el.getAttribute('type') === 'password') {
                    el.setAttribute('autocomplete', 'new-password');
                    // Set a neutral name to avoid credential manager heuristics
                    if (!el.hasAttribute('name')) {
                        el.setAttribute('name', 'new-password');
                    }
                }
            }
        } catch (_) { /* noop */ }
    }

    function enforce(root) {
        const scope = root && root.querySelectorAll ? root : document;
        // Forms
        scope.querySelectorAll('form').forEach(f => {
            try { f.setAttribute('autocomplete', 'off'); } catch (_) { /* noop */ }
        });
        // Inputs & textareas
        scope.querySelectorAll('input, textarea').forEach(applyNoAutoForInput);
    }

    // Initial pass
    enforce(document);

    // Observe dynamically added nodes
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            m.addedNodes && m.addedNodes.forEach((node) => {
                if (!(node instanceof Element)) return;
                // Apply directly on the node if relevant
                if (node.matches('form')) {
                    try { node.setAttribute('autocomplete', 'off'); } catch (_) { /* noop */ }
                }
                if (node.matches('input, textarea')) {
                    applyNoAutoForInput(node);
                }
                // And any descendants
                enforce(node);
            });
        }
    });
    try {
        observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch (_) { /* noop */ }
    // Expose for potential cleanup/debug
    window.__noAutocompleteObserver = observer;
})();

// Função para atualizar o texto do botão de iniciar
async function updateStartButtonText() {
    const startButton = document.getElementById('start-game-button');
    if (startButton) {
        const { carregarEstado } = await import('./utils/helpers.js');
        const saved = carregarEstado();
        if (saved && saved.isGameInProgress) {
            startButton.textContent = 'Continuar Partida';
        } else {
            startButton.textContent = 'Começar Jogo';
        }
    }
}

// Função para carregar dados offline
async function loadOfflineData() {
    try {
        // Carrega jogadores do cache offline
        const cachedPlayers = await offlineStorage.getPlayers();
        if (cachedPlayers && cachedPlayers.length > 0) {
        }
        
        // Carrega configurações do cache offline
        const cachedConfig = await offlineStorage.getConfig();
        if (cachedConfig && Object.keys(cachedConfig).length > 0) {
        }
        
        // Carrega histórico do cache offline
        const cachedHistory = await offlineStorage.getGameHistory();
        if (cachedHistory && cachedHistory.length > 0) {
        }
        
    } catch (error) {

    }
}

// Função para configurar salvamento automático
function setupAutoSave() {
    // Salva dados críticos periodicamente
    setInterval(async () => {
        try {
            // Salva estado atual dos jogadores
            const currentPlayers = getPlayers();
            if (currentPlayers && currentPlayers.length > 0) {
                await offlineStorage.savePlayers(currentPlayers);
            }
            
            // Salva configurações atuais
            const currentConfig = loadConfig();
            if (currentConfig) {
                await offlineStorage.saveConfig(currentConfig);
            }
            
        } catch (error) {

        }
    }, 30000); // Salva a cada 30 segundos
    
    // Salva dados antes de fechar a página
    window.addEventListener('beforeunload', async () => {
        try {
            const currentPlayers = getPlayers();
            if (currentPlayers) await offlineStorage.savePlayers(currentPlayers);
            
            const currentConfig = loadConfig();
            if (currentConfig) await offlineStorage.saveConfig(currentConfig);
            
        } catch (error) {

        }
    });
}

// Função global para limpar cache (pode ser chamada das configurações)
window.clearOfflineCache = async () => {
    try {
        await offlineStorage.clearAll();
        
        if (window.clearAppCache) {
            await window.clearAppCache();
        }
        
        displayMessage('Cache offline limpo com sucesso!', 'success');
        
        setTimeout(() => {
            window.location.reload();
        }, 1000);
        
        return true;
    } catch (error) {

        displayMessage('Erro ao limpar cache offline', 'error');
        return false;
    }
};

// Função para obter estatísticas de armazenamento
window.getStorageStats = async () => {
    try {
        const stats = await offlineStorage.getStorageStats();
        return stats;
    } catch (error) {

        return null;
    }
};


// Adiciona navegação baseada no hash da URL
function handleHashNavigation() {
    const hash = window.location.hash.replace('#', '');
    if (hash && hash.endsWith('-page')) {
        showPage(hash);
    }
}
window.addEventListener('hashchange', handleHashNavigation);
document.addEventListener('DOMContentLoaded', () => {
    handleHashNavigation();
});
// Handler centralizado de mensagens do Service Worker foi movido para utils/notifications.js para evitar duplicidade e inconsistências de payload.