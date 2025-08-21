// js/ui/scheduling-ui.js
// Funções relacionadas à interface da página de agendamento

import * as Elements from './elements.js';
import { displayMessage } from './messages.js';
import { showConfirmationModal } from './pages.js'; // Importa o modal de confirmação
import * as SchedulesData from '../data/schedules.js';
import { getCurrentUser } from '../firebase/auth.js';
import { notifyNewSchedule, notifyCancelledSchedule, areNotificationsEnabled } from '../utils/notifications.js';

const SCHEDULES_STORAGE_KEY = 'voleiScoreSchedules';

// Array para armazenar os jogos agendados
let scheduledGames = []; // Esta variável deve manter o estado em memória
let unsubscribeSchedules = null;
let listenerInitialized = false;
// NOVO: Flag para garantir que o event listener do botão só é adicionado uma vez
let scheduleButtonListenerAdded = false;
let fileHandlerInitialized = false;
// Current selected images (base64 strings) tracked in memory so user can remove individual images
let currentBase64List = [];
// Map to keep proofs out of the DOM to avoid huge attributes (base64 blobs)
const proofsByGameId = {};

// Body scroll lock helpers at module scope so any code in this module can lock/unlock
let _savedScrollY = 0;
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

// More robust lock implementation: prevent touchmove on document while modal open
let _touchMoveBlocker = null;
function enableTouchMoveBlocker() {
    if (_touchMoveBlocker) return;
    _touchMoveBlocker = function(e) {
        // Allow scroll inside modal content only
        if (e.target.closest && e.target.closest('.schedule-modal-content')) return;
        e.preventDefault();
    };
    document.addEventListener('touchmove', _touchMoveBlocker, { passive: false });
    // Also hide overflow on html/body as extra measure
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
}
function disableTouchMoveBlocker() {
    if (!_touchMoveBlocker) return;
    try { document.removeEventListener('touchmove', _touchMoveBlocker, { passive: false }); } catch (e) { /* ignore */ }
    _touchMoveBlocker = null;
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
}

/**
 * Carrega os agendamentos do localStorage.
 */
function loadSchedulesFromLocalStorage() {
    const storedSchedules = localStorage.getItem(SCHEDULES_STORAGE_KEY);
    if (storedSchedules) {
        try {
            scheduledGames = JSON.parse(storedSchedules);
        } catch (e) {
            console.error('Erro ao analisar agendamentos do localStorage:', e);
            scheduledGames = []; // Reseta se houver erro de parsing
        }
    } else {
        scheduledGames = []; // Garante que é um array vazio se não houver nada no storage
    }
}

/**
 * Salva os agendamentos no localStorage.
 */
function saveSchedulesToLocalStorage() {
    try {
        localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(scheduledGames));
    } catch (e) {
        console.error('Erro ao salvar agendamentos no localStorage:', e);
    }
}

/**
 * Sincroniza os agendamentos com o Firestore e o localStorage.
 */
function syncWithFirestoreAndLocalStorage() {
    if (listenerInitialized) return;
    listenerInitialized = true;
    if (unsubscribeSchedules) unsubscribeSchedules();
    
    let isFirstLoad = true;
    const previousSchedules = new Map(scheduledGames.map(game => [game.id, game.status]));
    
    // Sempre escuta o Firestore público (todos autenticados podem ler)
    unsubscribeSchedules = SchedulesData.subscribeSchedules((arr) => {
        const newScheduledGames = Array.isArray(arr) ? arr.slice() : [];
        
        // Detecta mudanças (apenas após o primeiro carregamento)
        if (!isFirstLoad) {
            // Detecta novos agendamentos
            const newSchedules = newScheduledGames.filter(game => 
                !previousSchedules.has(game.id) && 
                game.status === 'upcoming'
            );
            
            // Detecta cancelamentos
            const cancelledSchedules = newScheduledGames.filter(game => 
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
        
        // Atualiza o mapa para a próxima comparação
        previousSchedules.clear();
        newScheduledGames.forEach(game => previousSchedules.set(game.id, game.status));
        
        scheduledGames = newScheduledGames;
        saveSchedulesToLocalStorage();
        renderScheduledGames();
        
        isFirstLoad = false;
    });
}

// NOVO: Função para remover o listener (chame ao deslogar)
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
        upcomingGames.sort((a, b) => a.date.localeCompare(b.date)).forEach(game => {
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

    // Verifica autenticação e chave admin
    const config = JSON.parse(localStorage.getItem('volleyballConfig') || '{}');
    
    // Tenta obter o usuário, mas com proteção contra erros de inicialização
    let user = null;
    let canDelete = false;
    try {
        user = getCurrentUser();
        const isAdminKey = config.adminKey === 'admin998939';
        const isGoogleUser = user && !user.isAnonymous;
        canDelete = isAdminKey && isGoogleUser;
    } catch (error) {
        console.warn('Erro ao obter usuário atual:', error);
        // Continue mesmo com erro, tratando como usuário não autenticado
    }

    // Cria o HTML do card diretamente
    card.innerHTML = `
        <div class="card-actions">
            ${game.status === 'upcoming' ? `<button class="cancel-game-button card-action-button" title="Cancelar Jogo"><span class="material-icons">cancel</span></button>` : ''}
            <button class="delete-game-button card-action-button ${canDelete ? 'visible' : ''}" title="Excluir Jogo"><span class="material-icons">delete</span></button>
        </div>
        <div class="card-content">
            <h3>${statusTitle}</h3>
            <p><span class="material-icons">event</span> ${formattedDate}</p>
            <p><span class="material-icons">schedule</span> ${game.startTime} ${game.endTime ? `- ${game.endTime}` : ''}</p>
            ${game.notes ? `<p><span class="material-icons">notes</span> ${game.notes}</p>` : ''}
            <p><span class="material-icons">place</span> ${game.location} - <strong>${game.surface || 'Quadra'}</strong></p>
            ${game.paymentProofs && game.paymentProofs.length ? `<button class="proof-button card-action-button" data-game-id='${game.id}' data-proofs-count='${game.paymentProofs.length}'><span class="material-icons">receipt</span> <span>Ver Comprovante</span></button>` : ''}
        </div>
    `;
    // Attach proofs off-DOM to avoid embedding large base64 strings in attributes
    if (game.paymentProofs && game.paymentProofs.length) {
        const proofBtn = card.querySelector('.proof-button');
        if (proofBtn) {
            // store the array reference directly on the element and in the object by game id
            proofBtn.__proofs = game.paymentProofs;
            proofsByGameId[game.id] = game.paymentProofs;
        }
    }
    return card;
}

/**
 * Verifica se o usuário tem permissão para agendar jogos
 */
function canUserSchedule() {
    try {
        const user = getCurrentUser();
        const config = JSON.parse(localStorage.getItem('volleyballConfig') || '{}');
        
        const isGoogleUser = user && !user.isAnonymous;
        const hasAdminKey = config.adminKey === 'admin998939';
        
        return isGoogleUser && hasAdminKey;
    } catch (error) {
        console.warn('Erro ao verificar permissões:', error);
        return false;
    }
}

/**
 * Atualiza a visibilidade do botão flutuante baseado nas permissões
 */
function updateFloatingButtonVisibility() {
    const floatingBtn = document.getElementById('floating-add-btn');
    if (floatingBtn) {
    // Only show the floating button if the user can schedule AND the scheduling
    // page is currently active. This prevents the button from appearing on other pages
    // after we ported it to document.body.
    const schedulingPage = document.getElementById('scheduling-page');
    const schedulingActive = schedulingPage && schedulingPage.classList.contains('app-page--active');
    floatingBtn.style.display = (canUserSchedule() && schedulingActive) ? 'flex' : 'none';
    }
}

// Some containers in the app use CSS transforms which create a new containing block
// and make `position: fixed` behave like `position: absolute` inside that container.
// To guarantee the floating button is fixed relative to the viewport, port it to
// document.body when the scheduling page is initialized.
function portalFloatingButtonToBody() {
    const floatingBtn = document.getElementById('floating-add-btn');
    if (!floatingBtn) return;
    if (floatingBtn.parentElement === document.body) return; // already portaled
    try {
        document.body.appendChild(floatingBtn);
        // keep the same display logic
    } catch (e) {
        console.warn('[scheduling-ui] failed to portal floating button to body', e);
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

    const scheduleButton = Elements.scheduleGameButton();
    const pageContainer = Elements.schedulingPage();

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

            const newSchedule = {
                id: `game_${new Date().getTime()}`.toString(),
                date,
                startTime,
                endTime,
                location,
                surface,
                notes,
                paymentProofs,
                status: 'upcoming',
                createdAt: new Date().toISOString()
            };

            try {
                await SchedulesData.saveSchedule(newSchedule);
                
                // Envia notificação para todos os usuários
                if (areNotificationsEnabled()) {
                    await notifyNewSchedule(newSchedule);
                }
                
                displayMessage('Jogo agendado com sucesso!', 'success');
                
                // Fecha o modal
                const modal = document.getElementById('schedule-modal');
                if (modal) {
                    modal.classList.remove('active');
                    // unlock body scroll when modal is closed programmatically
                    console.debug('[scheduling-ui] programmatic modal close after save, unlocking body');
                    try { unlockBodyScroll(); } catch (e) { console.warn('unlockBodyScroll failed', e); }
                    try { disableTouchMoveBlocker(); } catch (e) { console.warn('disableTouchMoveBlocker failed', e); }
                }
                
            } catch (err) {
                if (err && err.code === "permission-denied") {
                    displayMessage('Você não tem permissão para agendar jogos. Apenas administradores podem agendar.', 'error');
                } else {
                    displayMessage('Erro ao agendar jogo. Tente novamente.', 'error');
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
    
    if(pageContainer) {
        pageContainer.addEventListener('click', async (event) => {
            const button = event.target.closest('.card-action-button');
            if (!button) return;
            const card = button.closest('.scheduled-game-card');
            if (!card) return;
            const gameId = card.dataset.gameId;

            if (button.classList.contains('cancel-game-button')) {
                showConfirmationModal(
                    'Tem certeza que deseja cancelar este agendamento?',
                    async () => {
                        const game = scheduledGames.find(g => g.id === gameId);
                        if (game) {
                            game.status = 'cancelled';
                            saveSchedulesToLocalStorage();
                            try {
                                await SchedulesData.updateSchedule(game);
                            } catch (err) {
                                if (err && err.code === "permission-denied") {
                                    displayMessage('Você não tem permissão para cancelar jogos. Apenas administradores podem cancelar.', 'error');
                                } else {
                                    displayMessage('Erro ao cancelar jogo. Tente novamente.', 'error');
                                }
                            }
                        }
                    }
                );
            } else if (button.classList.contains('delete-game-button')) {
                showConfirmationModal(
                    'Tem certeza que deseja excluir este agendamento?',
                    async () => {
                        scheduledGames = scheduledGames.filter(g => g.id !== gameId);
                        saveSchedulesToLocalStorage();
                        try {
                            await SchedulesData.deleteSchedule(gameId);
                        } catch (err) {
                            if (err && err.code === "permission-denied") {
                                displayMessage('Você não tem permissão para excluir jogos. Apenas administradores podem excluir.', 'error');
                            } else {
                                displayMessage('Erro ao excluir agendamento. Tente novamente.', 'error');
                            }
                        }
                    }
                );
            } else if (button.classList.contains('proof-button')) {
                // Usar os comprovantes armazenados no elemento ou no objeto
                const proofs = button.__proofs || proofsByGameId[gameId];
                if (proofs && proofs.length) {
                    showProofViewer(proofs);
                } else {
                    displayMessage('Não foi possível carregar os comprovantes.', 'error');
                }
            }
        });
    }

    // Não chama renderScheduledGames aqui, pois o listener do Firestore já atualiza a UI
}

/**
 * Configura as abas da página de agendamentos
 */
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;
            
            // Remove active de todos os botões e conteúdos
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Adiciona active ao botão clicado
            button.classList.add('active');
            
            // Mostra o conteúdo correspondente
            const targetContent = document.getElementById(`${targetTab}-tab`);
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
                const buttons = Array.from(tabButtons);
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
    const closeBtn = document.getElementById('close-schedule-modal');

    // uses module-level lockBodyScroll/unlockBodyScroll
    
    // Abre o modal
    if (floatingBtn) {
        floatingBtn.addEventListener('click', () => {
            if (canUserSchedule()) {
                if (modal) {
                    // Portal the modal to document.body so it's positioned relative to the
                    // viewport and not affected by ancestor transforms/positioning.
                    if (modal.parentElement !== document.body) {
                        try {
                            // save original place to restore later
                            modal.__origParent = modal.parentElement;
                            modal.__origNext = modal.nextSibling;
                            document.body.appendChild(modal);
                        } catch (e) {
                            console.warn('[scheduling-ui] portal modal failed', e);
                        }
                    }

                    modal.classList.add('active');
                    console.debug('[scheduling-ui] opening schedule modal, scrollY=', window.scrollY);
                    lockBodyScroll();
                    enableTouchMoveBlocker();
                }
            }
        });
    }
    
    // Fecha o modal
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (modal) {
                modal.classList.remove('active');
                console.debug('[scheduling-ui] close modal via closeBtn, unlocking body');
                // restore modal to original parent if it was portaled
                if (modal.__origParent) {
                    try {
                        modal.__origParent.insertBefore(modal, modal.__origNext || null);
                        modal.__origParent = null;
                        modal.__origNext = null;
                    } catch (e) {
                        console.warn('[scheduling-ui] restore modal parent failed', e);
                    }
                }
                unlockBodyScroll();
                disableTouchMoveBlocker();
            }
        });
    }
    
    // Fecha o modal clicando fora
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                console.debug('[scheduling-ui] close modal via backdrop click, unlocking body');
                // restore modal to original parent if it was portaled
                if (modal.__origParent) {
                    try {
                        modal.__origParent.insertBefore(modal, modal.__origNext || null);
                        modal.__origParent = null;
                        modal.__origNext = null;
                    } catch (err) {
                        console.warn('[scheduling-ui] restore modal parent failed', err);
                    }
                }
                unlockBodyScroll();
                disableTouchMoveBlocker();
            }
        });
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
    image.src = proofs[0] || '';
    
    // Adicionar ou atualizar contador de imagens
    let counter = modal.querySelector('.proof-counter');
    if (!counter) {
        counter = document.createElement('div');
        counter.className = 'proof-counter';
        const headerEl = modal.querySelector('.proof-viewer-header');
        if (headerEl) {
            headerEl.appendChild(counter);
        }
    }
    
    // Atualizar contador
    updateProofCounter(modal);
    
    modal.classList.add('active');

    // attach keyboard navigation
    function keyHandler(e) {
        if (!modal.classList.contains('active')) return;
        if (e.key === 'ArrowRight') showNext();
        if (e.key === 'ArrowLeft') showPrev();
        if (e.key === 'Escape') modal.classList.remove('active');
    }

    function showNext() {
        if (!modal.__proofs) return;
        modal.__proofIndex = (modal.__proofIndex + 1) % modal.__proofs.length;
        image.src = modal.__proofs[modal.__proofIndex];
        updateProofCounter(modal);
    }

    function showPrev() {
        if (!modal.__proofs) return;
        modal.__proofIndex = (modal.__proofIndex - 1 + modal.__proofs.length) % modal.__proofs.length;
        image.src = modal.__proofs[modal.__proofIndex];
        updateProofCounter(modal);
    }

    // expose navigation on modal element for buttons
    modal.showNext = showNext;
    modal.showPrev = showPrev;
    document.addEventListener('keydown', keyHandler);

    // remove listener when modal closed
    const removeListener = () => {
        document.removeEventListener('keydown', keyHandler);
        modal.removeEventListener('click', onModalClick);
        const btnNext = document.getElementById('proof-next');
        const btnPrev = document.getElementById('proof-prev');
        if (btnNext) btnNext.removeEventListener('click', showNext);
        if (btnPrev) btnPrev.removeEventListener('click', showPrev);
    };

    function onModalClick(e) {
        if (e.target === modal) {
            modal.classList.remove('active');
            removeListener();
        }
    }

    modal.addEventListener('click', onModalClick);
    const btnNext = document.getElementById('proof-next');
    const btnPrev = document.getElementById('proof-prev');
    if (btnNext) btnNext.addEventListener('click', (e) => { e.stopPropagation(); showNext(); });
    if (btnPrev) btnPrev.addEventListener('click', (e) => { e.stopPropagation(); showPrev(); });
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
                    console.warn('Falha ao converter arquivo para base64', err);
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

// Exporta função para atualizar visibilidade (para ser chamada quando login/logout)
export function updateSchedulingPermissions() {
    updateFloatingButtonVisibility();
}
