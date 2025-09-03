import * as Elements from './elements.js';
import { displayMessage } from './messages.js';
import * as SchedulesData from '../data/schedules.js';
import { getCurrentUser } from '../firebase/auth.js';
import { notifyNewSchedule, notifyCancelledSchedule, areNotificationsEnabled } from '../utils/notifications.js';
import { initSchedulingAnimations, enhanceHoverEffects, setupLoadingAnimations } from './scheduling-animations.js';
import { getPlayers } from '../data/players.js';

const SCHEDULES_STORAGE_KEY = 'voleiScoreSchedules';

let scheduledGames = [];
let unsubscribeSchedules = null;
let listenerInitialized = false;
let scheduleButtonListenerAdded = false;
let fileHandlerInitialized = false;
let currentBase64List = [];
const proofsByGameId = {};
let editingScheduleId = null;

let _savedScrollY = 0;
let _touchMoveBlocker = null;

function lockBodyScroll() {
    _savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.style.top = `-${_savedScrollY}px`;
    document.body.classList.add('modal-open');
}

function unlockBodyScroll() {
    document.body.classList.remove('modal-open');
    document.body.style.top = '';
    window.scrollTo(0, _savedScrollY);
}

function enableTouchMoveBlocker() {
    if (_touchMoveBlocker) return;
    _touchMoveBlocker = function(e) {
        if (e.target.closest && e.target.closest('.schedule-modal-content')) return;
        e.preventDefault();
    };
    document.addEventListener('touchmove', _touchMoveBlocker, { passive: false });
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
}

function disableTouchMoveBlocker() {
    if (!_touchMoveBlocker) return;
    try { document.removeEventListener('touchmove', _touchMoveBlocker, { passive: false }); } catch (e) {}
    _touchMoveBlocker = null;
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
}

function closeScheduleModal() {
    const modal = document.getElementById('schedule-modal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.style.visibility = 'hidden';
    modal.style.opacity = '0';
    unlockBodyScroll();
    disableTouchMoveBlocker();
}

function loadSchedulesFromLocalStorage() {
    const storedSchedules = localStorage.getItem(SCHEDULES_STORAGE_KEY);
    if (storedSchedules) {
        try {
            scheduledGames = JSON.parse(storedSchedules);
        } catch (e) {
            scheduledGames = [];
        }
    } else {
        scheduledGames = [];
    }
}

function saveSchedulesToLocalStorage() {
    try {
        localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(scheduledGames));
    } catch (e) {}
}

/**
 * Sincroniza os agendamentos com o Firestore e o localStorage.
 */
function syncWithFirestoreAndLocalStorage() {
    if (listenerInitialized) return;
    listenerInitialized = true;
    if (unsubscribeSchedules) unsubscribeSchedules();
    
    // Carrega do localStorage primeiro
    loadSchedulesFromLocalStorage();
    renderScheduledGames(); // Renderiza imediatamente
    
    let isFirstLoad = true;
    const previousSchedules = new Map(scheduledGames.map(game => [game.id, game.status]));
    
    // Sempre escuta o Firestore público (todos autenticados podem ler)
    unsubscribeSchedules = SchedulesData.subscribeSchedules((arr) => {
        const firebaseSchedules = Array.isArray(arr) ? arr.slice() : [];
        
        // Detecta mudanças (apenas após o primeiro carregamento)
        if (!isFirstLoad) {
            // Detecta novos agendamentos
            const newSchedules = firebaseSchedules.filter(game => 
                !previousSchedules.has(game.id) && 
                game.status === 'upcoming'
            );
            
            // Detecta cancelamentos
            const cancelledSchedules = firebaseSchedules.filter(game => 
                previousSchedules.has(game.id) && 
                previousSchedules.get(game.id) === 'upcoming' &&
                game.status === 'cancelled'
            );
            
            // Notifica sobre novos agendamentos
            newSchedules.forEach(async (schedule) => {
                if (areNotificationsEnabled()) {
                    await notifyNewSchedule(schedule);
                }
            });
            
            // Notifica sobre cancelamentos
            cancelledSchedules.forEach(async (schedule) => {
                if (areNotificationsEnabled()) {
                    await notifyCancelledSchedule(schedule);
                }
            });
        }
        
        // Mescla dados do Firebase com localStorage preservando RSVPs locais
        const mergedSchedules = firebaseSchedules.map(firebaseGame => {
            const localGame = scheduledGames.find(g => g.id === firebaseGame.id);
            if (localGame && localGame.rsvps && Object.keys(localGame.rsvps).length > 0) {
                // Preserva RSVPs locais se existirem
                return {
                    ...firebaseGame,
                    rsvps: { ...firebaseGame.rsvps, ...localGame.rsvps }
                };
            }
            return firebaseGame;
        });
        
        // Atualiza o mapa para a próxima comparação
        previousSchedules.clear();
        mergedSchedules.forEach(game => previousSchedules.set(game.id, game.status));
        
        scheduledGames = mergedSchedules;
        saveSchedulesToLocalStorage();
        renderScheduledGames();
        
        isFirstLoad = false;
    });
}

export function cleanupSchedulingListener() {
    if (unsubscribeSchedules) {
        unsubscribeSchedules();
        unsubscribeSchedules = null;
    }
    listenerInitialized = false;
}

/**
 * Cancela um jogo, mudando seu status.
 * @param {string} gameId - O ID do jogo a ser cancelado.
 */
export function cancelGame(gameId) {
    const game = scheduledGames.find(g => g.id === gameId);

    if (game) {
        game.status = 'cancelled';
        saveSchedulesToLocalStorage();
    }
    renderScheduledGames(); // Sempre renderizar a UI após tentar uma modificação
}

/**
 * Exclui um jogo permanentemente.
 * @param {string} gameId - O ID do jogo a ser excluído.
 */
export function deleteGame(gameId) {
    scheduledGames = scheduledGames.filter(g => g.id !== gameId); // Filtra o array, criando um novo
    saveSchedulesToLocalStorage();
    renderScheduledGames(); // Sempre renderizar a UI após tentar uma modificação
}

/**
 * Renderiza a lista de jogos agendados na página, separando-os por status.
 */
export function renderScheduledGames() {
    // Tenta usar os novos containers primeiro, depois os antigos para compatibilidade
    let upcomingListContainer = document.querySelector('#upcoming-tab .games-list');
    let pastListContainer = document.querySelector('#past-tab .games-list');
    
    // Fallback para os containers antigos se os novos não existirem
    if (!upcomingListContainer) {
        upcomingListContainer = Elements.upcomingGamesList();
    }
    if (!pastListContainer) {
        pastListContainer = Elements.pastGamesList();
    }
    
    if (!upcomingListContainer || !pastListContainer) {
        return;
    }

    upcomingListContainer.innerHTML = '';
    pastListContainer.innerHTML = '';

    const todayString = new Date().toISOString().slice(0, 10);

    const upcomingGames = [];
    const pastGames = [];

    scheduledGames.forEach(game => {
        const gameDateString = game.date;
        
        // Atualiza o status para 'past' se a data já passou e não foi cancelado
        if (game.status !== 'cancelled' && gameDateString < todayString) {
            game.status = 'past';
        }

        if (game.status === 'past') {
            pastGames.push(game);
        } else {
            upcomingGames.push(game);
        }
    });

    if (upcomingGames.length === 0) {
        upcomingListContainer.innerHTML = '<p class="empty-list-message">Nenhum jogo futuro agendado.</p>';
    } else {
        upcomingGames
            .sort((a, b) => {
                // Prioriza status: upcoming (0) antes de cancelled (1) e outros (2)
                const prio = (g) => g.status === 'upcoming' ? 0 : (g.status === 'cancelled' ? 1 : 2);
                const pa = prio(a);
                const pb = prio(b);
                if (pa !== pb) return pa - pb;
                // Dentro do mesmo status, ordena por data e horário de início
                const dateCmp = (a.date || '').localeCompare(b.date || '');
                if (dateCmp !== 0) return dateCmp;
                return (a.startTime || '').localeCompare(b.startTime || '');
            })
            .forEach(game => {
                upcomingListContainer.appendChild(createGameCard(game));
            });
    }

    if (pastGames.length === 0) {
        pastListContainer.innerHTML = '<p class="empty-list-message">Nenhum jogo passado encontrado.</p>';
    } else {
        pastGames.sort((a, b) => b.date.localeCompare(a.date)).forEach(game => {
            pastListContainer.appendChild(createGameCard(game));
        });
    }



    // Garante que o accordion de jogos passados ajuste sua altura se estiver aberto
    const accordionItem = Elements.pastGamesAccordion(); // Agora pega o item do accordion diretamente
    if (accordionItem) {
        // A classe 'active' está no próprio accordionItem
        if (accordionItem.classList.contains('active')) {
            const content = accordionItem.querySelector('.accordion-content'); // Pega o conteúdo filho
            if (content) {
                // Recalcula a altura para garantir que o conteúdo se ajuste
                content.style.maxHeight = content.scrollHeight + 'px';
            }
        }
    }
}

/**
 * Cria o elemento de card para um jogo agendado.
 * @param {object} game - O objeto do jogo.
 * @returns {HTMLElement} O elemento do card.
 */
function createGameCard(game) {
    const card = document.createElement('div');
    card.className = `scheduled-game-card status-${game.status}`;
    card.dataset.gameId = game.id;
    // Use a unified drag-and-drop: disable native drag until we intentionally enable it for permitted users
    card.draggable = false;

    // Ensure game.date is a valid date string before splitting
    const [year, month, day] = game.date.split('-').map(Number);
    const gameDate = new Date(year, month - 1, day);

    const formattedDate = gameDate.toLocaleDateString('pt-BR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    let statusTitle = '';
    switch (game.status) {
        case 'upcoming':
            statusTitle = 'Agendado';
            break;
        case 'cancelled':
            statusTitle = 'Cancelado';
            break;
        case 'past':
            statusTitle = 'Passado';
            break;
        default:
            statusTitle = 'Desconhecido';
    }

    // Verifica autenticação e chave admin (apenas chave admin necessária)
    const config = JSON.parse(localStorage.getItem('volleyballConfig') || '{}');
    let canDelete = config.adminKey === 'admin998939';

    // Cria o HTML do card igual admin-action
    card.innerHTML = `
        <div class="card-content">
            <div class="game-details">
                <h3>${statusTitle}</h3>
                <p>
                    <span class="material-icons">event</span>
                    ${formattedDate}
                </p>
                <p>
                    <span class="material-icons">schedule</span>
                    ${game.startTime}${game.endTime ? ` - ${game.endTime}` : ''}
                </p>
                <p>
                    <span class="material-icons">place</span>
                    ${game.location}
                </p>
                <p>
                    <span class="material-icons">sports_volleyball</span>
                    ${game.surface || 'Quadra'}
                </p>
                ${game.notes ? `<p><span class="material-icons">notes</span>${game.notes}</p>` : ''}
                ${game.status === 'cancelled' && game.cancelReason ? `<div class="cancel-reason" style="flex-direction: row; align-items: center; gap: 0.5rem;"><span class="material-icons">report_problem</span>Motivo: ${game.cancelReason}</div>` : ''}
            </div>
        </div>
        <div class="card-actions">
            <button class="card-more-btn" aria-haspopup="true" aria-expanded="false" title="Ações"><span class="material-icons">more_vert</span></button>
            <div class="card-more-menu" data-open="false" role="menu" aria-hidden="true">
                ${game.status === 'upcoming' ? `<button class="menu-responses" data-game-id='${game.id}' role="menuitem"><span class="material-icons">group</span> Presença</button>` : ''}
                ${game.paymentProofs && game.paymentProofs.length ? `<button class="menu-proof" data-game-id='${game.id}' data-proofs-count='${game.paymentProofs.length}' role="menuitem"><span class="material-icons">receipt_long</span> Comprovantes</button>` : ''}
                ${canDelete && game.status === 'upcoming' ? `<button class="menu-edit" data-game-id='${game.id}' role="menuitem"><span class="material-icons">edit</span> Editar</button>` : ''}
                ${canDelete && game.status === 'upcoming' ? `<button class="menu-redispatch" data-game-id='${game.id}' role="menuitem"><span class="material-icons">notification_add</span> Redisparar</button>` : ''}
                ${canDelete && game.status === 'upcoming' ? `<button class="menu-cancel" data-game-id='${game.id}' role="menuitem"><span class="material-icons">close</span> Cancelar</button>` : ''}
            </div>
        </div>
    `;
    // Attach proofs off-DOM to avoid embedding large base64 strings in attributes
    if (game.paymentProofs && game.paymentProofs.length) {
        proofsByGameId[game.id] = game.paymentProofs;
    }
    return card;
}

/**
 * Verifica se o usuário tem permissão para agendar jogos
 */
function canUserSchedule() {
    try {
        const config = JSON.parse(localStorage.getItem('volleyballConfig') || '{}');
        return config.adminKey === 'admin998939';
    } catch (error) {
        return false;
    }
}

/**
 * Verifica se o usuário atual é Google (não anônimo) e possui a chave admin.
 */
function isGoogleAdmin() {
    try {
        const user = getCurrentUser();
        if (!user || user.isAnonymous) return false;
        const config = JSON.parse(localStorage.getItem('volleyballConfig') || '{}');
        return config.adminKey === 'admin998939';
    } catch (e) {
        return false;
    }
}

/**
 * Abre o modal de edição para um agendamento existente.
 * Exported so other modules (e.g., notifications handler) can call it.
 */
export async function openEditSchedule(scheduleId) {
    if (!isGoogleAdmin()) {
        displayMessage('Somente administradores autenticados pelo Google podem editar agendamentos.', 'error');
        return;
    }
    const schedule = scheduledGames.find(g => g.id === scheduleId);
    if (!schedule) {
        displayMessage('Agendamento não encontrado para edição.', 'error');
        return;
    }
    // Preenche o modal com os valores do agendamento
    const modal = document.getElementById('schedule-modal');
    if (!modal) return;
    editingScheduleId = scheduleId;
    const dateInput = Elements.dateInput();
    if (dateInput) dateInput.value = schedule.date || '';
    if (Elements.startTimeInput) Elements.startTimeInput().value = schedule.startTime || '';
    if (Elements.endTimeInput) Elements.endTimeInput().value = schedule.endTime || '';
    if (Elements.locationInput) Elements.locationInput().value = schedule.location || '';
    if (Elements.surfaceSelect) Elements.surfaceSelect.value = schedule.surface || '';
    if (Elements.notesInput) Elements.notesInput().value = schedule.notes || '';
    // Show modal
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.visibility = 'visible';
    lockBodyScroll();
    enableTouchMoveBlocker();
}

/**
 * Re-dispara a notificação de um agendamento (apenas admin Google).
 */
export async function redispatchNotification(scheduleId) {
    if (!isGoogleAdmin()) {
        displayMessage('Somente administradores autenticados pelo Google podem redisparar notificações.', 'error');
        return;
    }
    const schedule = scheduledGames.find(g => g.id === scheduleId);
    if (!schedule) {
        displayMessage('Agendamento não encontrado para redisparo.', 'error');
        return;
    }
    try {
        if (areNotificationsEnabled()) {
            await notifyNewSchedule(schedule);
            displayMessage('Notificação redisparada com sucesso.', 'success');
        } else {
            displayMessage('Notificações estão desativadas nas preferências.', 'info');
        }
    } catch (e) {
        console.error('Erro ao redisparar notificação:', e);
        displayMessage('Erro ao redisparar notificação. Veja console.', 'error');
    }
}

/**
 * Atualiza a visibilidade do botão flutuante baseado nas permissões
 */
function updateFloatingButtonVisibility() {
    const floatingBtn = document.getElementById('floating-add-btn');
    if (floatingBtn) {
        const schedulingPage = document.getElementById('scheduling-page');
        const schedulingActive = schedulingPage && schedulingPage.classList.contains('app-page--active');
        floatingBtn.style.display = (canUserSchedule() && schedulingActive) ? 'flex' : 'none';
    }
}

function portalFloatingButtonToBody() {
    const floatingBtn = document.getElementById('floating-add-btn');
    if (!floatingBtn) return;
    if (floatingBtn.parentElement === document.body) return;
    try {
        document.body.appendChild(floatingBtn);
    } catch (e) {
        // ignore
    }
}

// Garante que o modal de agendamento não fique dentro de um container rolável
function portalScheduleModalToBody() {
    const modal = document.getElementById('schedule-modal');
    if (!modal) return;
    if (modal.parentElement === document.body) return;
    try {
        document.body.appendChild(modal);
    } catch (e) {
        // ignore
    }
}




/**
 * Configura os event listeners e a lógica para a página de agendamento.
 */
export function setupSchedulingPage() {
    syncWithFirestoreAndLocalStorage();
    setupTabs(); // Configura as abas
    setupModal(); // Configura o modal
    setupFileHandling(); // Configura o upload de arquivos
    updateFloatingButtonVisibility(); // Atualiza visibilidade do botão
    portalFloatingButtonToBody(); // move button to body so fixed positioning works
    portalScheduleModalToBody(); // move modal to body to avoid scroll/container offset issues
    
    // Inicializa animações do novo design
    initSchedulingAnimations();
    enhanceHoverEffects();
    setupLoadingAnimations();

    const scheduleButton = Elements.scheduleGameButton();
    const pageContainer = Elements.schedulingPage();

    // Listener removido - RSVP agora é registrado diretamente no modal

    // Garante que o event listener do botão só é adicionado uma vez
    if (scheduleButton && !scheduleButtonListenerAdded) {
        scheduleButtonListenerAdded = true;
    scheduleButton.addEventListener('click', async () => {
            const dateInputEl = Elements.dateInput();
            const date = dateInputEl ? dateInputEl.value.trim() : '';
            const startTime = Elements.startTimeInput().value;
            const endTime = Elements.endTimeInput().value;
            const location = Elements.locationInput().value.trim();
            const surface = Elements.surfaceSelect ? Elements.surfaceSelect().value : '';
            const notes = Elements.notesInput().value.trim();
            const paymentProofInput = document.getElementById('payment-proof-input');
            
            if (!date) {
                displayMessage('Por favor, selecione uma data para o agendamento.', 'error');
                return;
            }
            if (!startTime) {
                displayMessage('Por favor, selecione uma hora de início.', 'error');
                return;
            }
            if (!surface) {
                displayMessage('Por favor, selecione o tipo de quadra (Quadra ou Areia).', 'error');
                return;
            }
            if (!location) {
                displayMessage('Por favor, informe o local do jogo.', 'error');
                return;
            }

            // Use currentBase64List (already converted and respecting individual removals)
            const paymentProofs = Array.isArray(currentBase64List) ? currentBase64List.slice(0, 5) : [];

            // Monta objeto de dados
            const payload = {
                date,
                startTime,
                endTime,
                location,
                surface,
                notes,
                paymentProofs
            };

            const isEdit = !!editingScheduleId;
            try {
                if (isEdit) {
                    // Edição: somente admin Google pode editar
                    if (!isGoogleAdmin()) {
                        displayMessage('Somente administradores autenticados pelo Google podem editar agendamentos.', 'error');
                        return;
                    }
                    const game = scheduledGames.find(g => g.id === editingScheduleId);
                    if (!game) {
                        displayMessage('Agendamento para edição não encontrado.', 'error');
                        editingScheduleId = null;
                        return;
                    }
                    // Atualiza campos locais
                    Object.assign(game, payload);
                    game.updatedAt = new Date().toISOString();
                    await SchedulesData.updateSchedule(game);
                    displayMessage('Agendamento atualizado com sucesso!', 'success');
                    editingScheduleId = null;
                } else {
                    // Criação normal
                    const newSchedule = Object.assign({
                        id: `game_${new Date().getTime()}`.toString(),
                        status: 'upcoming',
                        createdAt: new Date().toISOString()
                    }, payload);

                    await SchedulesData.saveSchedule(newSchedule);
                    // Envia notificação para todos os usuários
                    if (areNotificationsEnabled()) {
                        await notifyNewSchedule(newSchedule);
                    }
                    displayMessage('Jogo agendado com sucesso!', 'success');
                }

                // Fecha o modal
                const modal = document.getElementById('schedule-modal');
                if (modal) {
                    modal.style.display = 'none';
                    modal.style.visibility = 'hidden';
                    modal.style.opacity = '0';
                    unlockBodyScroll();
                    disableTouchMoveBlocker();
                }
                // Limpa campos somente no caso de criação
                if (!isEdit) {
                    Elements.dateInput().value = '';
                    Elements.startTimeInput().value = '';
                    Elements.endTimeInput().value = '';
                    Elements.locationInput().value = '';
                    if (Elements.surfaceSelect) Elements.surfaceSelect.value = '';
                    Elements.notesInput().value = '';
                    const paymentProofInput = document.getElementById('payment-proof-input');
                    if (paymentProofInput) {
                        paymentProofInput.value = '';
                        const preview = document.getElementById('file-preview');
                        const previewsList = document.getElementById('file-previews');
                        if (previewsList) previewsList.innerHTML = '';
                        currentBase64List = [];
                        if (preview) preview.style.display = 'none';
                    }
                }
            } catch (err) {
                if (err && err.code === "permission-denied") {
                    displayMessage('Você não tem permissão para agendar/editar jogos. Apenas administradores podem.', 'error');
                } else {
                    displayMessage('Erro ao salvar agendamento. Tente novamente.', 'error');
                }
                return; // Não limpa o formulário se houve erro
            }

            // Clear form fields after successful scheduling
            Elements.dateInput().value = '';
            Elements.startTimeInput().value = '';
            Elements.endTimeInput().value = '';
            Elements.locationInput().value = '';
            if (Elements.surfaceSelect) Elements.surfaceSelect().value = '';
            Elements.notesInput().value = '';
            if (paymentProofInput) {
                paymentProofInput.value = '';
                const preview = document.getElementById('file-preview');
                const previewsList = document.getElementById('file-previews');
                if (previewsList) previewsList.innerHTML = '';
                currentBase64List = [];
                if (preview) preview.style.display = 'none';
            }
        });
    }
    
    // CORRIGIDO: Adiciona o listener apenas uma vez para evitar múltiplos modais
    if (pageContainer && !pageContainer.dataset.listenerAdded) {
        pageContainer.dataset.listenerAdded = 'true'; // Marca que o listener foi adicionado
        // Global click handler for card actions and the compact menu
        pageContainer.addEventListener('click', async (event) => {
            // Toggle 'more' menu
            const moreBtn = event.target.closest('.card-more-btn');
            if (moreBtn) {
                const card = moreBtn.closest('.scheduled-game-card');
                const menu = card.querySelector('.card-more-menu');
                const isOpen = menu && menu.getAttribute('data-open') === 'true';
                if (menu) {
                    menu.setAttribute('data-open', String(!isOpen));
                    menu.style.display = !isOpen ? 'block' : 'none';
                    moreBtn.setAttribute('aria-expanded', String(!isOpen));
                }
                return;
            }

            // Clicks on menu items
            const menuItem = event.target.closest('.card-more-menu button');
            if (menuItem) {
                const gameId = menuItem.dataset.gameId;
                if (menuItem.classList.contains('menu-responses')) {
                    const game = scheduledGames.find(g => g.id === gameId);
                    if (game) showResponsesModal(game);
                    else displayMessage('Agendamento não encontrado.', 'error');
                } else if (menuItem.classList.contains('menu-proof')) {
                    const proofs = proofsByGameId[gameId];
                    if (proofs && proofs.length) showProofViewer(proofs);
                    else displayMessage('Não foi possível carregar os comprovantes.', 'error');
                } else if (menuItem.classList.contains('menu-edit')) {
                    openEditSchedule(gameId);
                } else if (menuItem.classList.contains('menu-redispatch')) {
                    redispatchNotification(gameId);
                } else if (menuItem.classList.contains('menu-cancel')) {
                    showCancelReasonModal(gameId);
                }
                // close any open menu after action
                const parentMenu = menuItem.closest('.card-more-menu');
                if (parentMenu) {
                    parentMenu.setAttribute('data-open', 'false');
                    parentMenu.style.display = 'none';
                    const btn = parentMenu.parentElement.querySelector('.card-more-btn');
                    if (btn) btn.setAttribute('aria-expanded', 'false');
                }
                return;
            }

            // Fallback: if clicked outside menu, close all open menus
            if (!event.target.closest('.card-more-menu') && !event.target.closest('.card-more-btn')) {
                document.querySelectorAll('.card-more-menu[data-open="true"]').forEach(m => {
                    m.setAttribute('data-open', 'false');
                    m.style.display = 'none';
                    const btn = m.parentElement.querySelector('.card-more-btn');
                    if (btn) btn.setAttribute('aria-expanded', 'false');
                });
            }
        });
    }

    // Sistema de drag and drop para excluir agendamentos
    setupScheduleDragAndDrop();
    
    // Processa ações pendentes de notificação
    setTimeout(() => {
        const pendingScheduleId = sessionStorage.getItem('pendingOpenRsvpScheduleId');
        if (pendingScheduleId) {
            sessionStorage.removeItem('pendingOpenRsvpScheduleId');
            const game = scheduledGames.find(g => g.id === pendingScheduleId);
            if (game) {
                showResponsesModal(game);
            }
        }
    }, 1000);
    
    // Não chama renderScheduledGames aqui, pois o listener do Firestore já atualiza a UI
}

/**
 * Configura a navegação da página de agendamentos (igual config)
 */
function setupTabs() {
    const navButtons = document.querySelectorAll('.scheduling-nav-item');
    const sections = document.querySelectorAll('.scheduling-section');
    
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetSection = button.dataset.section;
            
            // Remove active de todos os botões e seções
            navButtons.forEach(btn => btn.classList.remove('active'));
            sections.forEach(section => section.classList.remove('active'));
            
            // Adiciona active ao botão clicado
            button.classList.add('active');
            
            // Mostra a seção correspondente
            const targetContent = document.getElementById(targetSection);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });

    // --- Mobile: swipe to change tabs ---
    let touchStartX = 0;
    let touchStartY = 0;
    const threshold = 40; // mínimo de deslocamento para considerar swipe

    const tabArea = document.getElementById('scheduling-page');
    if (tabArea) {
        tabArea.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }
        }, { passive: true });

        tabArea.addEventListener('touchend', (e) => {
            const touch = e.changedTouches && e.changedTouches[0];
            if (!touch) return;
            const dx = touch.clientX - touchStartX;
            const dy = touch.clientY - touchStartY;
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
                // horizontal swipe detected
                const buttons = Array.from(navButtons);
                const activeIndex = buttons.findIndex(b => b.classList.contains('active'));
                if (activeIndex === -1) return;
                let newIndex = activeIndex;
                if (dx < 0) newIndex = Math.min(buttons.length - 1, activeIndex + 1); // swipe left -> next
                else newIndex = Math.max(0, activeIndex - 1); // swipe right -> prev

                if (newIndex !== activeIndex) {
                    buttons[newIndex].click();
                }
            }
        }, { passive: true });
    }
}

/**
 * Configura o modal de agendamento
 */
function setupModal() {
    const floatingBtn = document.getElementById('floating-add-btn');
    const modal = document.getElementById('schedule-modal');
    
    // Injeta botão de fechar no header do modal (apenas uma vez)
    if (modal && !modal.__closeButtonInjected) {
        const header = modal.querySelector('.modal-header');
        if (header && !header.querySelector('#close-schedule-modal')) {
            const btn = document.createElement('button');
            btn.id = 'close-schedule-modal';
            btn.className = 'close-modal-btn';
            btn.title = 'Fechar';
            btn.innerHTML = '<span class="material-icons">close</span>';
            header.appendChild(btn);
            btn.addEventListener('click', closeScheduleModal);
        } else if (header) {
            const btn = header.querySelector('#close-schedule-modal');
            if (btn && !btn.__listenerAdded) {
                btn.addEventListener('click', closeScheduleModal);
                btn.__listenerAdded = true;
            }
        }
        modal.__closeButtonInjected = true;
    }

    // Fecha ao clicar fora (overlay)
    if (modal && !modal.__overlayListenerAdded) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeScheduleModal();
            }
        });
        modal.__overlayListenerAdded = true;
    }

    // Abre o modal ao clicar no botão flutuante
    if (floatingBtn && !floatingBtn.__openListenerAdded) {
        floatingBtn.addEventListener('click', () => {
            if (canUserSchedule()) {
                if (modal) {
                    modal.style.display = 'flex';
                    modal.style.opacity = '1';
                    modal.style.visibility = 'visible';
                    lockBodyScroll();
                    enableTouchMoveBlocker();
                }
            }
        });
        floatingBtn.__openListenerAdded = true;
    }

    // Fecha com ESC (uma vez)
    if (modal && !modal.__escListenerAdded) {
        const escHandler = (e) => {
            if (e.key === 'Escape' && modal.style.display !== 'none' && modal.style.visibility !== 'hidden') {
                closeScheduleModal();
            }
        };
        document.addEventListener('keydown', escHandler);
        modal.__escListenerAdded = true;
    }
}

/**
 * Converte arquivo para base64
 */
function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Atualiza o contador de imagens no modal de visualização
 */
function updateProofCounter(modal) {
    if (!modal || !modal.__proofs || !Array.isArray(modal.__proofs)) return;
    
    const counter = modal.querySelector('.proof-counter');
    if (!counter) return;
    
    const total = modal.__proofs.length;
    const current = modal.__proofIndex + 1;
    counter.textContent = `${current} / ${total}`;
}

/**
 * Atualiza os dots de navegação do carrossel
 */
function updateProofDots(modal) {
    if (!modal || !modal.__proofs || !Array.isArray(modal.__proofs)) return;
    
    const dotsContainer = modal.querySelector('#proof-dots');
    if (!dotsContainer) return;
    
    // Limpa dots existentes
    dotsContainer.innerHTML = '';
    // Adiciona guarda de clique em captura para suprimir cliques sintetizados pós-swipe
    if (!dotsContainer.__guardAttached) {
        dotsContainer.addEventListener('click', (e) => {
            if (modal.__suppressDotClick) {
                e.stopPropagation();
                e.preventDefault();
            }
        }, true);
        dotsContainer.__guardAttached = true;
    }
    
    // Cria dots para cada imagem
    modal.__proofs.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.className = 'proof-dot';
        if (index === modal.__proofIndex) {
            dot.classList.add('active');
        }
        
        // Adiciona evento de clique no dot
        dot.addEventListener('click', (e) => {
            // Se um swipe acabou de ocorrer, ignora o clique sintetizado
            if (modal.__suppressDotClick || modal.__suppressClick) return;
            modal.__proofIndex = index;
            const image = modal.querySelector('#proof-image');
            if (image) {
                image.src = modal.__proofs[index];
            }
            updateProofCounter(modal);
            updateProofDots(modal);
            updateNavButtons(modal);
        });
        
        dotsContainer.appendChild(dot);
    });
}

/**
 * Atualiza o estado dos botões de navegação
 */
function updateNavButtons(modal) {
    if (!modal || !modal.__proofs || !Array.isArray(modal.__proofs)) return;
    
    const prevBtn = modal.querySelector('#proof-prev');
    const nextBtn = modal.querySelector('#proof-next');
    const carouselNav = modal.querySelector('.proof-carousel-nav');
    
    // Se há apenas uma imagem, oculta toda a navegação
    if (modal.__proofs.length <= 1) {
        if (carouselNav) {
            carouselNav.style.display = 'none';
        }
        return;
    }
    
    // Mostra a navegação se há múltiplas imagens
    if (carouselNav) {
        carouselNav.style.display = 'flex';
    }
    
    if (prevBtn) {
        prevBtn.disabled = modal.__proofIndex === 0;
    }
    
    if (nextBtn) {
        nextBtn.disabled = modal.__proofIndex === modal.__proofs.length - 1;
    }
}

/**
 * Mostra o modal de visualização de comprovante
 */
function showProofViewer(proofData) {
    // proofData can be a single base64 string or an array of strings
    const modal = document.getElementById('proof-viewer-modal');
    const image = document.getElementById('proof-image');
    if (!modal || !image) return;

    let proofs = [];
    if (Array.isArray(proofData)) proofs = proofData;
    else if (typeof proofData === 'string') proofs = [proofData];

    // store index and list on modal for navigation
    modal.__proofs = proofs;
    modal.__proofIndex = 0;
    // Flag para suprimir cliques nos dots após um swipe
    modal.__suppressDotClick = false;
    // Flag para indicar swipe em andamento
    modal.__isSwiping = false;
    image.src = proofs[0] || '';
    
    // Adicionar ou atualizar contador de imagens
    let counter = modal.querySelector('.proof-counter');
    const headerEl = modal.querySelector('.proof-viewer-header');
    if (!counter) {
        counter = document.createElement('div');
        counter.className = 'proof-counter';
    }
    if (headerEl) {
        const closeBtn = headerEl.querySelector('#close-proof-viewer');
        if (closeBtn) {
            headerEl.insertBefore(counter, closeBtn);
        } else {
            headerEl.appendChild(counter);
        }
    }
    
    // Atualizar contador, dots e botões
    updateProofCounter(modal);
    updateProofDots(modal);
    updateNavButtons(modal);
    
    modal.classList.add('active');

    // Setup click suppression guard in capture phase to avoid synthetic clicks after swipe
    modal.__suppressClick = false;
    const _clickGuard = (ev) => { if (modal.__suppressClick) { ev.preventDefault(); ev.stopPropagation(); } };
    modal.addEventListener('click', _clickGuard, true);

    // attach keyboard navigation
    function keyHandler(e) {
        if (!modal.classList.contains('active')) return;
        if (e.key === 'ArrowRight') showNext();
        if (e.key === 'ArrowLeft') showPrev();
        if (e.key === 'Escape') modal.classList.remove('active');
    }

    // Touch/swipe navigation
    let touchStartX = 0;
    let touchStartY = 0;
    const imageContainer = modal.querySelector('.proof-image-container');
    
    function handleTouchStart(e) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        modal.__isSwiping = false;
    }
    
    function handleTouchEnd(e) {
        if (!touchStartX || !touchStartY) return;
        
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = touchStartX - touchEndX;
        const deltaY = touchStartY - touchEndY;
        
        // Só navega se foi detectado swipe horizontal válido durante o movimento
        if (modal.__isSwiping && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            // Janela de supressão para evitar cliques sintetizados pós-swipe
            modal.__suppressDotClick = true;
            modal.__suppressClick = true;
            const dots = modal.querySelector('#proof-dots');
            const nav = modal.querySelector('.proof-carousel-nav');
            if (dots) dots.style.pointerEvents = 'none';
            if (nav) nav.style.pointerEvents = 'none';
            setTimeout(() => {
                modal.__suppressDotClick = false;
                modal.__suppressClick = false;
                if (dots) dots.style.pointerEvents = '';
                if (nav) nav.style.pointerEvents = '';
            }, 600);
            
            // Evita que o navegador gere um click após o touchend
            if (e.cancelable) e.preventDefault();
            
            if (deltaX > 0) {
                showNext(); // Swipe left = next
            } else {
                showPrev(); // Swipe right = previous
            }
        }
        
        touchStartX = 0;
        touchStartY = 0;
        modal.__isSwiping = false;
    }
    
    function handleTouchMove(e) {
        if (!touchStartX || !touchStartY) return;
        const x = e.touches[0].clientX;
        const y = e.touches[0].clientY;
        const dx = touchStartX - x;
        const dy = touchStartY - y;
        // Detecta swipe horizontal em andamento
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
            modal.__isSwiping = true;
            if (e.cancelable) e.preventDefault();
        }
    }
    
    if (imageContainer) {
        imageContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
        imageContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
        imageContainer.addEventListener('touchend', handleTouchEnd, { passive: false });
    }

    function showNext() {
        if (!modal.__proofs || modal.__proofIndex >= modal.__proofs.length - 1) return;
        modal.__proofIndex++;
        image.src = modal.__proofs[modal.__proofIndex];
        updateProofCounter(modal);
        updateProofDots(modal);
        updateNavButtons(modal);
    }

    function showPrev() {
        if (!modal.__proofs || modal.__proofIndex <= 0) return;
        modal.__proofIndex--;
        image.src = modal.__proofs[modal.__proofIndex];
        updateProofCounter(modal);
        updateProofDots(modal);
        updateNavButtons(modal);
    }

    // expose navigation on modal element for buttons
    modal.showNext = showNext;
    modal.showPrev = showPrev;
    document.addEventListener('keydown', keyHandler);

    // remove listener when modal closed
    const removeListener = () => {
        document.removeEventListener('keydown', keyHandler);
        modal.removeEventListener('click', onModalClick);
        modal.removeEventListener('click', _clickGuard, true);
        if (imageContainer) {
            imageContainer.removeEventListener('touchstart', handleTouchStart);
            imageContainer.removeEventListener('touchend', handleTouchEnd);
        }
    };

    function onModalClick(e) {
        if (e.target === modal) {
            modal.classList.remove('active');
            removeListener();
        }
    }

    modal.addEventListener('click', onModalClick);
    // Garantir que fechar pelo botão X também limpe listeners
    const closeBtn = document.getElementById('close-proof-viewer');
    if (closeBtn) {
        const onCloseClick = () => {
            modal.classList.remove('active');
            removeListener();
            closeBtn.removeEventListener('click', onCloseClick);
        };
        closeBtn.addEventListener('click', onCloseClick);
    }
}

/**
 * Configura o preview de arquivo e modal de comprovante
 */
function setupFileHandling() {
    const fileInput = document.getElementById('payment-proof-input');
    const preview = document.getElementById('file-preview');
    const previewsList = document.getElementById('file-previews');
    const proofModal = document.getElementById('proof-viewer-modal');
    const closeProofBtn = document.getElementById('close-proof-viewer');
    // Prevent attaching multiple listeners
    if (fileInput && !fileHandlerInitialized) {
        fileHandlerInitialized = true;
        fileInput.addEventListener('change', async (e) => {
            const selectedFiles = Array.from(e.target.files || []);
            if (!previewsList) return;

            // Determine how many more files we can accept (max 5)
            const remaining = Math.max(0, 5 - currentBase64List.length);
            if (remaining === 0) {
                // already at limit
                displayMessage('Você já atingiu o limite de 5 comprovantes.', 'error');
                // clear input to avoid confusion
                fileInput.value = '';
                return;
            }

            const files = selectedFiles.slice(0, remaining);
            if (!files.length) {
                if (preview) preview.style.display = 'none';
                return;
            }

            // Convert and append to the existing list (do not overwrite)
            for (const f of files) {
                try {
                    const base64 = await convertFileToBase64(f);
                    currentBase64List.push(base64);
                } catch (err) {
                    // Log removido
                }
            }

            // helper to render previews from currentBase64List
            function reRenderPreviews() {
                if (!previewsList) return;
                previewsList.innerHTML = '';
                currentBase64List.forEach((b64, idx) => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'thumbnail-item';

                    const img = document.createElement('img');
                    img.src = b64;
                    img.alt = `comprovante-${idx+1}`;
                    img.className = 'thumbnail-image';
                    wrapper.appendChild(img);

                    // remove button for this thumbnail
                    const removeThumbBtn = document.createElement('button');
                    removeThumbBtn.type = 'button';
                    removeThumbBtn.className = 'thumbnail-remove-btn';
                    removeThumbBtn.title = 'Remover imagem';
                    removeThumbBtn.innerHTML = '<span class="material-icons">close</span>';
                    removeThumbBtn.addEventListener('click', (ev) => {
                        ev.stopPropagation(); // don't open viewer
                        currentBase64List.splice(idx, 1);
                        updateFileCountAndHelp();
                        reRenderPreviews();
                    });
                    wrapper.appendChild(removeThumbBtn);

                    // clicking thumbnail opens the viewer with this single image
                    wrapper.addEventListener('click', () => showProofViewer(b64));
                    previewsList.appendChild(wrapper);
                });
                if (currentBase64List.length === 0 && preview) preview.style.display = 'none';
                else if (preview) preview.style.display = 'block';
            }

            function updateFileCountAndHelp() {
                const fileHelp = document.getElementById('file-input-help');
                if (fileHelp) fileHelp.textContent = currentBase64List.length ? `${currentBase64List.length} selecionada(s)` : 'PNG, JPG • Máx. 5';
            }

            reRenderPreviews();
            updateFileCountAndHelp();
        });
    }
    
    // global remove-all button removed from markup; per-thumbnail removal handled in reRenderPreviews
    
    if (closeProofBtn) {
        closeProofBtn.addEventListener('click', () => {
            proofModal.classList.remove('active');
        });
    }
    
    if (proofModal) {
        proofModal.addEventListener('click', (e) => {
            if (e.target === proofModal) {
                proofModal.classList.remove('active');
            }
        });
    }
}

// Função para configurar drag and drop dos agendamentos
function setupScheduleDragAndDrop() {
    let deleteZoneSetup = false;
    
    // Configura a zona de exclusão
    function setupDeleteZone() {
        if (deleteZoneSetup) return;
        
        let deleteZone = document.getElementById('scheduling-delete-zone');
        if (!deleteZone) {
            deleteZone = document.createElement('div');
            deleteZone.id = 'scheduling-delete-zone';
            deleteZone.className = 'delete-zone';
            deleteZone.innerHTML = '<span class="material-icons">delete</span> Arraste aqui para excluir';
            deleteZone.style.display = 'none';
            document.body.appendChild(deleteZone);
        } else {
            // Ensure the delete zone is attached to document.body so position: fixed is relative to the viewport
            try {
                if (deleteZone.parentElement !== document.body) {
                    document.body.appendChild(deleteZone);
                }
            } catch (e) { /* ignore */ }
        }
        
        deleteZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            deleteZone.classList.add('drag-over');
        });
        
        deleteZone.addEventListener('dragleave', (e) => {
            if (!deleteZone.contains(e.relatedTarget)) {
                deleteZone.classList.remove('drag-over');
            }
        });
        
        deleteZone.addEventListener('drop', async (e) => {
            e.preventDefault();
            deleteZone.classList.remove('drag-over');
            
            const gameId = e.dataTransfer.getData('text/plain');
            if (gameId && gameId.trim()) {
                if (confirm('Tem certeza que deseja excluir este agendamento?')) {
                    scheduledGames = scheduledGames.filter(g => g.id !== gameId);
                    saveSchedulesToLocalStorage();
                    try {
                        await SchedulesData.deleteSchedule(gameId);
                        displayMessage('Agendamento excluído com sucesso!', 'success');
                    } catch (err) {
                        if (err && err.code === "permission-denied") {
                            displayMessage('Você não tem permissão para excluir jogos. Apenas administradores podem excluir.', 'error');
                        } else {
                            displayMessage('Erro ao excluir agendamento. Tente novamente.', 'error');
                        }
                    }
                }
            }
            
            hideDeleteZone();
        });
        
        deleteZoneSetup = true;
    }
    
    function hideDeleteZone() {
        const deleteZone = document.getElementById('scheduling-delete-zone');
        if (deleteZone) {
            deleteZone.classList.remove('active', 'drag-over');
            setTimeout(() => {
                deleteZone.style.display = 'none';
            }, 300);
        }
    }
    
    function showDeleteZone() {
        const deleteZone = document.getElementById('scheduling-delete-zone');
        if (deleteZone) {
            deleteZone.style.display = 'flex';
            // z-index is controlled in CSS; avoid lowering it via inline styles
            setTimeout(() => deleteZone.classList.add('active'), 10);
        }
    }
    
    // Configura drag and drop para um card específico
    function setupCardDragAndDrop(card) {
        if (!card || card.hasAttribute('data-drag-initialized')) return;
        
        let longPressTimer;
        let isDragging = false;
        let touchStartY = 0;
        let isMouseDown = false;
        let dragGhost = null;
        let ghostOffsetX = 50;
        let ghostOffsetY = 25;
        
        const createDragGhost = (x, y) => {
            dragGhost = card.cloneNode(true);
            const rect = card.getBoundingClientRect();
            // Calculate offsets first to position ghost centered under cursor
            ghostOffsetX = rect.width / 2;
            ghostOffsetY = rect.height / 2;
            // Base styles
            dragGhost.style.position = 'fixed';
            dragGhost.style.width = rect.width + 'px';
            dragGhost.style.height = rect.height + 'px';
            dragGhost.style.left = (x - ghostOffsetX) + 'px';
            dragGhost.style.top = (y - ghostOffsetY) + 'px';
            dragGhost.style.zIndex = '9999';
            dragGhost.style.pointerEvents = 'none';
            dragGhost.style.opacity = '0.8';
            // Force-disable any rotation/animation that might come from CSS
            try {
                dragGhost.style.setProperty('transform', 'none', 'important');
                dragGhost.style.setProperty('animation', 'none', 'important');
            } catch (e) { /* ignore */ }
            dragGhost.classList.add('drag-ghost');
            document.body.appendChild(dragGhost);
        };
        
        const updateDragGhost = (x, y) => {
            if (dragGhost) {
                dragGhost.style.left = (x - ghostOffsetX) + 'px';
                dragGhost.style.top = (y - ghostOffsetY) + 'px';
            }
        };
        
        const removeDragGhost = () => {
            if (dragGhost) {
                dragGhost.remove();
                dragGhost = null;
            }
        };
        // Desktop helper to keep custom ghost synced with cursor during native drag
        const onDocDragOver = (e) => {
            if (isDragging && dragGhost) {
                e.preventDefault();
                updateDragGhost(e.clientX, e.clientY);
            }
        };
        
        // Touch events
        card.addEventListener('touchstart', (e) => {
            if (isMouseDown) return;
            
            touchStartY = e.touches[0].clientY;
            longPressTimer = setTimeout(() => {
                const config = JSON.parse(localStorage.getItem('volleyballConfig') || '{}');
                const canDelete = config.adminKey === 'admin998939';
                
                if (!canDelete) {
                    displayMessage('Apenas administradores podem excluir agendamentos.', 'error');
                    return;
                }
                
                isDragging = true;
                try { card.style.setProperty('transform', 'none', 'important'); card.style.setProperty('animation', 'none', 'important'); } catch (e) {}
                createDragGhost(e.touches[0].clientX, e.touches[0].clientY);
                showDeleteZone();
                e.preventDefault();
            }, 500);
        });
        
        card.addEventListener('touchmove', (e) => {
            if (isDragging) {
                e.preventDefault();
                const touch = e.touches[0];
                
                updateDragGhost(touch.clientX, touch.clientY);
                
                if (dragGhost) dragGhost.style.display = 'none';
                const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                if (dragGhost) dragGhost.style.display = 'block';
                
                const deleteZone = document.getElementById('scheduling-delete-zone');
                if (elementBelow && elementBelow.closest('#scheduling-delete-zone')) {
                    if (deleteZone) deleteZone.classList.add('drag-over');
                } else {
                    if (deleteZone) deleteZone.classList.remove('drag-over');
                }
            } else {
                const touch = e.touches[0];
                const deltaY = Math.abs(touch.clientY - touchStartY);
                if (deltaY > 10) {
                    clearTimeout(longPressTimer);
                }
            }
        });
        
    card.addEventListener('touchend', async (e) => {
            clearTimeout(longPressTimer);
            if (isDragging) {
                const touch = e.changedTouches[0];
                
                if (dragGhost) dragGhost.style.display = 'none';
                const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                if (dragGhost) dragGhost.style.display = 'block';
                
                if (elementBelow && elementBelow.closest('#scheduling-delete-zone')) {
                    const gameId = card.dataset.gameId;
                    if (confirm('Tem certeza que deseja excluir este agendamento?')) {
                        scheduledGames = scheduledGames.filter(g => g.id !== gameId);
                        saveSchedulesToLocalStorage();
                        try {
                            await SchedulesData.deleteSchedule(gameId);
                            displayMessage('Agendamento excluído com sucesso!', 'success');
                        } catch (err) {
                            if (err && err.code === "permission-denied") {
                                displayMessage('Você não tem permissão para excluir jogos. Apenas administradores podem excluir.', 'error');
                            } else {
                                displayMessage('Erro ao excluir agendamento. Tente novamente.', 'error');
                            }
                        }
                    }
                }
                
                isDragging = false;
                try { card.style.removeProperty('transform'); card.style.removeProperty('animation'); } catch (e) {}
                card.classList.remove('dragging');
                removeDragGhost();
                hideDeleteZone();
            }
        });
        
        // Mouse events
        card.addEventListener('mousedown', (e) => {
            isMouseDown = true;
            const startX = e.clientX;
            const startY = e.clientY;
            longPressTimer = setTimeout(() => {
                const config = JSON.parse(localStorage.getItem('volleyballConfig') || '{}');
                const canDelete = config.adminKey === 'admin998939';
                
                if (!canDelete) {
                    displayMessage('Apenas administradores podem excluir agendamentos.', 'error');
                    return;
                }
                
                isDragging = true;
                card.draggable = true;
                try { card.style.setProperty('transform', 'none', 'important'); card.style.setProperty('animation', 'none', 'important'); } catch (e) {}
                createDragGhost(startX, startY);
                document.addEventListener('dragover', onDocDragOver);
                showDeleteZone();
            }, 500);
        });
        
        card.addEventListener('mouseup', () => {
            isMouseDown = false;
            clearTimeout(longPressTimer);
        });
        
        card.addEventListener('mouseleave', () => {
            isMouseDown = false;
            clearTimeout(longPressTimer);
        });
        
        card.addEventListener('dragstart', (e) => {
            if (e.dataTransfer) {
                e.dataTransfer.setData('text/plain', card.dataset.gameId);
                e.dataTransfer.effectAllowed = 'move';
                // Hide the browser's default drag image; we render our own ghost
                try {
                    const transparentImg = new Image();
                    transparentImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
                    e.dataTransfer.setDragImage(transparentImg, 0, 0);
                } catch (err) { /* ignore */ }
            }
        });
        
        card.addEventListener('dragend', () => {
            isDragging = false;
            try { card.style.removeProperty('transform'); card.style.removeProperty('animation'); } catch (e) {}
            card.classList.remove('dragging');
            card.draggable = false;
            removeDragGhost();
            document.removeEventListener('dragover', onDocDragOver);
            hideDeleteZone();
        });
        
        card.setAttribute('data-drag-initialized', 'true');
    }
    
    // Configura todos os cards existentes
    function setupAllCards() {
        const cards = document.querySelectorAll('.scheduled-game-card');
        cards.forEach(setupCardDragAndDrop);
    }
    
    // Observa mudanças no DOM
    const observer = new MutationObserver(() => {
        setTimeout(setupAllCards, 50);
    });
    
    const schedulingPage = document.getElementById('scheduling-page');
    if (schedulingPage) {
        observer.observe(schedulingPage, { childList: true, subtree: true });
    }
    
    setupDeleteZone();
    setupAllCards();
}

/**
 * Mostra o modal para solicitar motivo do cancelamento
 */
function showCancelReasonModal(gameId) {
    const modal = document.getElementById('cancel-reason-modal');
    const reasonInput = document.getElementById('cancel-reason-input');
    const confirmBtn = document.getElementById('confirm-cancel-btn');
    const cancelBtn = document.getElementById('cancel-cancel-btn');
    
    if (!modal) return;
    
    // Limpa o input e mostra o modal
    reasonInput.value = '';
    modal.classList.add('active');
    
    // Foca no textarea
    setTimeout(() => reasonInput.focus(), 100);
    
    // Remove listeners anteriores (evita múltiplos handlers)
    const newConfirmBtn = confirmBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    // Utilitário para fechar e limpar listeners de teclado
    const escHandler = (e) => {
        if (e.key === 'Escape') close();
    };
    function close() {
        modal.classList.remove('active');
        document.removeEventListener('keydown', escHandler);
    }
    document.addEventListener('keydown', escHandler);

    // Confirmar cancelamento
    newConfirmBtn.addEventListener('click', async () => {
        const reason = reasonInput.value.trim();
        if (!reason) {
            displayMessage('Por favor, informe o motivo do cancelamento.', 'error');
            return;
        }

        const game = scheduledGames.find(g => g.id === gameId);
        if (game) {
            game.status = 'cancelled';
            game.cancelReason = reason;
            game.cancelledAt = new Date().toISOString();
            saveSchedulesToLocalStorage();

            try {
                await SchedulesData.updateSchedule(game);
                displayMessage('Jogo cancelado com sucesso.', 'success');
                close();
            } catch (err) {
                if (err && err.code === "permission-denied") {
                    displayMessage('Você não tem permissão para cancelar jogos. Apenas administradores podem cancelar.', 'error');
                } else {
                    displayMessage('Erro ao cancelar jogo. Tente novamente.', 'error');
                }
                // Mantém modal aberto para correção do motivo ou tentar novamente
            }
        } else {
            displayMessage('Agendamento não encontrado.', 'error');
        }
    });

    // Cancelar ação
    newCancelBtn.addEventListener('click', close);

    // Fechar clicando fora
    const onOverlayClick = (e) => { if (e.target === modal) close(); };
    // Evita múltiplos bindings: remove antes de adicionar
    modal.removeEventListener('click', onOverlayClick);
    modal.addEventListener('click', onOverlayClick);
}

// Exporta função para atualizar visibilidade (para ser chamada quando login/logout)
export function updateSchedulingPermissions() {
    updateFloatingButtonVisibility();
}



export function showResponsesModal(game) {
    try {
        lockBodyScroll();
        enableTouchMoveBlocker();

        const overlay = document.createElement('div');
        overlay.className = 'attendance-modal-overlay';
        overlay.classList.add('active');

        const content = document.createElement('div');
        content.className = 'attendance-modal';

        const rsvps = game.rsvps || {};
        const players = getPlayers();
        const currentUser = getCurrentUser();
        const getPlayer = (uid) => players.find(p => p.uid === uid || p.id === uid) || null;
        const getName = (uid) => {
            const p = getPlayer(uid);
            return p ? (p.name || `Usuário ${uid}`).replace(' [local]','') : `Usuário ${uid}`;
        };
        const getPhoto = (uid) => {
            const p = getPlayer(uid);
            return (p && !p.isManual && p.photoURL) ? p.photoURL : 'assets/default-user-icon.svg';
        };

        const going = [];
        const maybe = [];
        const notGoing = [];
        Object.entries(rsvps).forEach(([uid, response]) => {
            const item = { uid, name: getName(uid), photo: getPhoto(uid) };
            if (response === 'going') going.push(item);
            else if (response === 'maybe') maybe.push(item);
            else notGoing.push(item);
        });
        const byName = (a,b) => a.name.localeCompare(b.name);
        going.sort(byName); maybe.sort(byName); notGoing.sort(byName);

        const myResponse = currentUser ? (rsvps[currentUser.uid] || null) : null;

        const renderPerson = ({name, photo}) => `
            <li class="att-list-item">
                <img class="att-list-avatar" src="${photo}" alt="${name}" onerror="this.src='assets/default-user-icon.svg'">
                <span class="att-list-name">${name}</span>
            </li>`;

        const renderGroup = (label, icon, colorVar, list) => `
            <section class="att-group">
                <header class="att-group__header">
                    <span class="material-icons att-group__icon">${icon}</span>
                    <h4 class="att-group__title">${label}</h4>
                    <span class="att-group__count">${list.length}</span>
                </header>
                ${list.length ? `<ul class="att-list">${list.map(renderPerson).join('')}</ul>` : `<p class="att-group__empty">Ninguém aqui ainda.</p>`}
            </section>`;

        const actions = `
            <div class="att-picker ${currentUser ? '' : 'att-picker--disabled'}">
                <div class="att-choice att-going ${myResponse==='going' ? 'is-active' : ''}">
                    <span class="material-icons">check_circle</span>
                    <span class="att-choice__label">Vou</span>
                </div>
                <div class="att-choice att-maybe ${myResponse==='maybe' ? 'is-active' : ''}">
                    <span class="material-icons">help</span>
                    <span class="att-choice__label">Talvez</span>
                </div>
                <div class="att-choice att-not-going ${myResponse==='not_going' ? 'is-active' : ''}">
                    <span class="material-icons">cancel</span>
                    <span class="att-choice__label">Não vou</span>
                </div>
            </div>
            <p class="att-helper-text">${currentUser ? 'Toque em uma opção para registrar sua presença' : 'Faça login para registrar sua presença'}</p>
        `;

        content.innerHTML = `
            <header class="att-modal__header">
                <div class="att-modal__head">
                    <div>
                        <h3 class="att-modal__title">Respostas de Presença</h3>
                    </div>
                </div>
                <button class="close-modal-btn" aria-label="Fechar">
                    <span class="material-icons">close</span>
                </button>
            </header>
            ${actions}
            <div class="att-groups">
                ${renderGroup('Quem vai', 'check_circle', '--success', going)}
                ${renderGroup('Talvez', 'help', '--warning', maybe)}
                ${renderGroup('Não vai', 'cancel', '--danger', notGoing)}
            </div>
        `;

        overlay.appendChild(content);
        document.body.appendChild(overlay);

        const close = () => {
            try { overlay.remove(); } catch (_) {}
            unlockBodyScroll();
            disableTouchMoveBlocker();
        };

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
        content.querySelector('.close-modal-btn')?.addEventListener('click', close);

        // Handlers para RSVP
        const onAnonClick = () => displayMessage('Faça login para definir sua presença.', 'error');
        
        // Referências aos elementos do picker e do container de grupos
        const groupsContainer = content.querySelector('.att-groups');
        const goingChoice = content.querySelector('.att-going');
        const maybeChoice = content.querySelector('.att-maybe');
        const notGoingChoice = content.querySelector('.att-not-going');

        // Recalcula listas e estado do usuário a partir do game.rsvps atual
        function computeLists() {
            const rsvpsObj = game.rsvps || {};
            const going = [];
            const maybe = [];
            const notGoing = [];
            Object.entries(rsvpsObj).forEach(([uid, response]) => {
                const item = { uid, name: getName(uid), photo: getPhoto(uid) };
                if (response === 'going') going.push(item);
                else if (response === 'maybe') maybe.push(item);
                else notGoing.push(item);
            });
            const byName = (a,b) => a.name.localeCompare(b.name);
            going.sort(byName); maybe.sort(byName); notGoing.sort(byName);
            const myResponse = currentUser ? (rsvpsObj[currentUser.uid] || null) : null;
            return { going, maybe, notGoing, myResponse };
        }

        // Atualiza UI do modal com base no estado atual (grupos e destaque do picker)
        function refreshUI() {
            console.log(`[DEBUG: scheduling-ui.js] refreshUI called`);
            const { going, maybe, notGoing, myResponse } = computeLists();
            console.log(`[DEBUG: scheduling-ui.js] myResponse:`, myResponse);
            if (groupsContainer) {
                groupsContainer.innerHTML = `
                ${renderGroup('Quem vai', 'check_circle', '--success', going)}
                ${renderGroup('Talvez', 'help', '--warning', maybe)}
                ${renderGroup('Não vai', 'cancel', '--danger', notGoing)}
            `;
            }
            if (goingChoice && maybeChoice && notGoingChoice) {
                goingChoice.classList.toggle('is-active', myResponse === 'going');
                maybeChoice.classList.toggle('is-active', myResponse === 'maybe');
                notGoingChoice.classList.toggle('is-active', myResponse === 'not_going');
            }
        }

        // Registra resposta diretamente sem modal de confirmação
        const onRsvp = async (action) => {
            console.log(`[DEBUG: scheduling-ui.js] onRsvp called with action: ${action}`);
            if (!currentUser) { 
                console.log(`[DEBUG: scheduling-ui.js] No current user, calling onAnonClick`);
                onAnonClick(); 
                return; 
            }
            
            console.log(`[DEBUG: scheduling-ui.js] Setting RSVP for user ${currentUser.uid} to ${action}`);
            if (!game.rsvps) game.rsvps = {};
            game.rsvps[currentUser.uid] = action;
            console.log(`[DEBUG: scheduling-ui.js] Updated game.rsvps:`, game.rsvps);
            refreshUI();
            
            // Salva diretamente sem evento customizado
            try {
                saveSchedulesToLocalStorage();
                await SchedulesData.updateSchedule(game);
                displayMessage('Resposta registrada com sucesso!', 'success');
            } catch (error) {
                console.error('Erro ao salvar RSVP:', error);
                displayMessage('Erro ao registrar sua resposta. Tente novamente.', 'error');
            }
        };

        if (currentUser) {
            goingChoice?.addEventListener('click', () => onRsvp('going'));
            maybeChoice?.addEventListener('click', () => onRsvp('maybe'));
            notGoingChoice?.addEventListener('click', () => onRsvp('not_going'));
        } else {
            goingChoice?.addEventListener('click', onAnonClick);
            maybeChoice?.addEventListener('click', onAnonClick);
            notGoingChoice?.addEventListener('click', onAnonClick);
        }
    } catch (_) {
        displayMessage('Não foi possível abrir as respostas.', 'error');
    }
}
