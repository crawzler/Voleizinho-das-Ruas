// js/ui/scheduling-ui.js
// Funções relacionadas à interface da página de agendamento

import * as Elements from './elements.js';
import { displayMessage } from './messages.js';
import { showConfirmationModal } from './pages.js'; // Importa o modal de confirmação
import * as SchedulesData from '../data/schedules.js';
import { getCurrentUser } from '../firebase/auth.js';
import { notifyNewSchedule, notifyCancelledSchedule, areNotificationsEnabled } from '../utils/notifications.js';
import { initSchedulingAnimations, enhanceHoverEffects, setupLoadingAnimations } from './scheduling-animations.js';

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

// Fecha o modal de agendamento com restauração do scroll/touch
function closeScheduleModal() {
    const modal = document.getElementById('schedule-modal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.style.visibility = 'hidden';
    modal.style.opacity = '0';
    unlockBodyScroll();
    disableTouchMoveBlocker();
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
            // Log removido
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
        // Log removido
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
        ${canDelete && game.status === 'upcoming' && game.status !== 'cancelled' ? `<button class="card-cancel-x" title="Cancelar"><span class="material-icons">close</span></button>` : ''}
        ${game.paymentProofs && game.paymentProofs.length ? `<button class="card-proof-btn" data-game-id='${game.id}' data-proofs-count='${game.paymentProofs.length}' title="Ver comprovantes">Comprovantes</button>` : ''}
    `;
    // Attach proofs off-DOM to avoid embedding large base64 strings in attributes
    if (game.paymentProofs && game.paymentProofs.length) {
        const proofBtn = card.querySelector('.card-proof-btn');
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
        const config = JSON.parse(localStorage.getItem('volleyballConfig') || '{}');
        return config.adminKey === 'admin998939';
    } catch (error) {
        return false;
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
                    modal.style.display = 'none';
                    modal.style.visibility = 'hidden';
                    modal.style.opacity = '0';
                    unlockBodyScroll();
                    disableTouchMoveBlocker();
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
            const button = event.target.closest('.card-cancel-x, .card-proof-btn');
            if (!button) return;
            const card = button.closest('.scheduled-game-card');
            if (!card) return;
            const gameId = card.dataset.gameId;

            if (button.classList.contains('card-cancel-x')) {
                showCancelReasonModal(gameId);
            } else if (button.classList.contains('card-proof-btn')) {
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

    // Sistema de drag and drop para excluir agendamentos
    setupScheduleDragAndDrop();
    
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
                showConfirmationModal(
                    'Tem certeza que deseja excluir este agendamento?',
                    async () => {
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
                );
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
        
        card.addEventListener('touchend', (e) => {
            clearTimeout(longPressTimer);
            if (isDragging) {
                const touch = e.changedTouches[0];
                
                if (dragGhost) dragGhost.style.display = 'none';
                const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                if (dragGhost) dragGhost.style.display = 'block';
                
                if (elementBelow && elementBelow.closest('#scheduling-delete-zone')) {
                    const gameId = card.dataset.gameId;
                    showConfirmationModal(
                        'Tem certeza que deseja excluir este agendamento?',
                        async () => {
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
                    );
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
