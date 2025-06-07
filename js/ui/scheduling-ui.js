// js/ui/scheduling-ui.js
// Funções relacionadas à interface da página de agendamento

import * as Elements from './elements.js';
import { displayMessage } from './messages.js';

const SCHEDULES_STORAGE_KEY = 'voleiScoreSchedules';

// Array para armazenar os jogos agendados
let scheduledGames = [];

/**
 * Carrega os agendamentos do localStorage.
 */
function loadSchedulesFromLocalStorage() {
    const storedSchedules = localStorage.getItem(SCHEDULES_STORAGE_KEY);
    if (storedSchedules) {
        scheduledGames = JSON.parse(storedSchedules);
    }
}

/**
 * Salva os agendamentos no localStorage.
 */
function saveSchedulesToLocalStorage() {
    localStorage.setItem(SCHEDULES_STORAGE_KEY, JSON.stringify(scheduledGames));
}

/**
 * Cancela um jogo, mudando seu status.
 * @param {string} gameId - O ID do jogo a ser cancelado.
 */
function cancelGame(gameId) {
    const game = scheduledGames.find(g => g.id === gameId);
    if (game) {
        game.status = 'cancelled';
        saveSchedulesToLocalStorage();
        renderScheduledGames();
        displayMessage('Jogo cancelado.', 'info');
    }
}

/**
 * Exclui um jogo permanentemente.
 * @param {string} gameId - O ID do jogo a ser excluído.
 */
function deleteGame(gameId) {
    scheduledGames = scheduledGames.filter(g => g.id !== gameId);
    saveSchedulesToLocalStorage();
    renderScheduledGames();
    displayMessage('Agendamento excluído.', 'success');
}

/**
 * Renderiza a lista de jogos agendados na página, separando-os por status.
 */
function renderScheduledGames() {
    const upcomingListContainer = Elements.upcomingGamesList();
    const pastListContainer = Elements.pastGamesList();
    if (!upcomingListContainer || !pastListContainer) return;

    upcomingListContainer.innerHTML = '';
    pastListContainer.innerHTML = '';

    const todayString = new Date().toISOString().slice(0, 10);

    const upcomingGames = [];
    const pastGames = [];

    scheduledGames.forEach(game => {
        const gameDateString = game.date;
        
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

    // This part is important, but the global setupAccordion will handle the click.
    // We just need to ensure that if the accordion is ALREADY open, its height is adjusted.
    const accordionHeader = Elements.pastGamesAccordion();
    if (accordionHeader) {
        const accordionItem = accordionHeader.parentElement;
        if (accordionItem.classList.contains('active')) {
            const content = accordionHeader.nextElementSibling;
            content.style.maxHeight = content.scrollHeight + 'px';
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

    const [year, month, day] = game.date.split('-').map(Number);
    const gameDate = new Date(year, month - 1, day);

    const formattedDate = gameDate.toLocaleDateString('pt-BR', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    card.innerHTML = `
        <div class="card-actions">
            ${game.status === 'upcoming' ? `<button class="card-action-button cancel-game-button" title="Cancelar Jogo"><span class="material-icons">cancel</span></button>` : ''}
            <button class="card-action-button delete-game-button" title="Excluir Jogo"><span class="material-icons">delete</span></button>
        </div>
        <div class="card-content">
            <h3>${game.location}</h3>
            <p><span class="material-icons">event</span> ${formattedDate}</p>
            <p><span class="material-icons">schedule</span> ${game.startTime} ${game.endTime ? `- ${game.endTime}` : ''}</p>
            ${game.notes ? `<p><span class="material-icons">notes</span> ${game.notes}</p>` : ''}
        </div>
    `;
    return card;
}

/**
 * Configura os event listeners e a lógica para a página de agendamento.
 */
export function setupSchedulingPage() {
    loadSchedulesFromLocalStorage();

    const scheduleButton = Elements.scheduleGameButton();
    const pageContainer = Elements.schedulingPage();

    if (scheduleButton) {
        scheduleButton.addEventListener('click', () => {
            const date = Elements.dateInput().value;
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
                id: `game_${new Date().getTime()}`,
                date,
                startTime,
                endTime,
                location,
                notes,
                status: 'upcoming',
                createdAt: new Date().toISOString()
            };

            scheduledGames.push(newSchedule);
            saveSchedulesToLocalStorage();
            renderScheduledGames();
            displayMessage('Jogo agendado com sucesso!', 'success');

            Elements.dateInput().value = '';
            Elements.startTimeInput().value = '';
            Elements.endTimeInput().value = '';
            Elements.locationInput().value = '';
            Elements.notesInput().value = '';
        });
    }
    
    if(pageContainer) {
        pageContainer.addEventListener('click', (event) => {
            const button = event.target.closest('.card-action-button');
            if (!button) return;

            const card = button.closest('.scheduled-game-card');
            const gameId = card.dataset.gameId;

            if (button.classList.contains('cancel-game-button')) {
                cancelGame(gameId);
            } else if (button.classList.contains('delete-game-button')) {
                if (confirm('Tem certeza que deseja excluir este agendamento?')) {
                    deleteGame(gameId);
                }
            }
        });
    }

    renderScheduledGames();
}