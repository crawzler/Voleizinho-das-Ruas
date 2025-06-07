// js/ui/scheduling-ui.js
// Funções relacionadas à interface da página de agendamento

import * as Elements from './elements.js';
import { displayMessage } from './messages.js';
import { showConfirmationModal } from './pages.js'; // Importa o modal de confirmação

const SCHEDULES_STORAGE_KEY = 'voleiScoreSchedules';

// Array para armazenar os jogos agendados
let scheduledGames = []; // Esta variável deve manter o estado em memória

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
        displayMessage('Erro ao salvar agendamentos no seu dispositivo.', 'error');
    }
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
        displayMessage('Jogo cancelado.', 'info');
    } else {
        displayMessage('Erro: Agendamento não encontrado para cancelar.', 'error');
    }
    renderScheduledGames(); // Sempre renderizar a UI após tentar uma modificação
}

/**
 * Exclui um jogo permanentemente.
 * @param {string} gameId - O ID do jogo a ser excluído.
 */
export function deleteGame(gameId) {
    const initialLength = scheduledGames.length;
    scheduledGames = scheduledGames.filter(g => g.id !== gameId); // Filtra o array, criando um novo

    saveSchedulesToLocalStorage();

    if (initialLength === scheduledGames.length) {
        displayMessage('Erro: Agendamento não encontrado para excluir.', 'error');
    } else {
        displayMessage('Agendamento excluído.', 'success');
    }
    renderScheduledGames(); // Sempre renderizar a UI após tentar uma modificação
}

/**
 * Renderiza a lista de jogos agendados na página, separando-os por status.
 */
function renderScheduledGames() {
    const upcomingListContainer = Elements.upcomingGamesList();
    const pastListContainer = Elements.pastGamesList();
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

    card.innerHTML = `
        <div class="card-actions">
            ${game.status === 'upcoming' ? `<button class="cancel-game-button card-action-button" title="Cancelar Jogo"><span class="material-icons">cancel</span></button>` : ''}
            <button class="delete-game-button card-action-button" title="Excluir Jogo"><span class="material-icons">delete</span></button>
        </div>
        <div class="card-content">
            <h3>${statusTitle}</h3> <!-- Dynamic title based on status -->
            <p><span class="material-icons">event</span> ${formattedDate}</p>
            <p><span class="material-icons">schedule</span> ${game.startTime} ${game.endTime ? `- ${game.endTime}` : ''}</p>
            ${game.notes ? `<p><span class="material-icons">notes</span> ${game.notes}</p>` : ''}
            <p><span class="material-icons">location_on</span>${game.location}</p>
        </div>
    `;
    return card;
}

/**
 * Configura os event listeners e a lógica para a página de agendamento.
 */
export function setupSchedulingPage() {
    loadSchedulesFromLocalStorage(); // Load existing schedules when page is setup

    const scheduleButton = Elements.scheduleGameButton();
    const pageContainer = Elements.schedulingPage();

    if (scheduleButton) {
        scheduleButton.addEventListener('click', () => {
            const dateInputEl = Elements.dateInput();
            const date = dateInputEl ? dateInputEl.value.trim() : '';
            
            const startTime = Elements.startTimeInput().value;
            const endTime = Elements.endTimeInput().value;
            const location = Elements.locationInput().value.trim();
            const notes = Elements.notesInput().value.trim();

            if (!date) {
                displayMessage('Por favor, selecione uma data para o agendamento.', 'error');
                return;
            }
            if (!startTime) {
                displayMessage('Por favor, selecione uma hora de início.', 'error');
                return;
            }
            if (!location) {
                displayMessage('Por favor, informe o local do jogo.', 'error');
                return;
            }

            const newSchedule = {
                id: `game_${new Date().getTime()}`.toString(), // Garante que o ID seja uma string
                date,
                startTime,
                endTime,
                location,
                notes,
                status: 'upcoming', // New schedules are always 'upcoming' initially
                createdAt: new Date().toISOString()
            };

            scheduledGames.push(newSchedule);
            saveSchedulesToLocalStorage();
            renderScheduledGames();
            displayMessage('Jogo agendado com sucesso!', 'success');

            // Clear form fields after successful scheduling
            Elements.dateInput().value = '';
            Elements.startTimeInput().value = '';
            Elements.endTimeInput().value = '';
            Elements.locationInput().value = '';
            Elements.notesInput().value = '';
        });
    }
    
    // Delegate click events for action buttons on the scheduling page
    if(pageContainer) {
        pageContainer.addEventListener('click', (event) => {
            const button = event.target.closest('.card-action-button');
            
            if (!button) {
                return; // Not an action button
            }

            const card = button.closest('.scheduled-game-card');
            if (!card) { 
                console.error('Botão de ação encontrado, mas o card pai não. Botão:', button);
                return;
            }

            const gameId = card.dataset.gameId;

            if (button.classList.contains('cancel-game-button')) {
                showConfirmationModal(
                    'Tem certeza que deseja cancelar este agendamento?',
                    () => {
                        cancelGame(gameId); // Agora cancelGame é uma função exportada e acessível
                    }
                );
            } else if (button.classList.contains('delete-game-button')) {
                showConfirmationModal(
                    'Tem certeza que deseja excluir este agendamento?',
                    () => {
                        deleteGame(gameId); // Agora deleteGame é uma função exportada e acessível
                    }
                );
            }
        });
    }

    renderScheduledGames(); // Initial render when page is loaded/setup
}
