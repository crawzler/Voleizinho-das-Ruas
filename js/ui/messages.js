// js/ui/messages.js
// Módulo para exibir mensagens de notificação na interface do usuário.

const messageContainer = document.getElementById('message-container');

// Lista de mensagens permitidas (apenas agendamentos)
const ALLOWED_MESSAGES = [
    'Por favor, selecione uma data para o agendamento.',
    'Por favor, selecione uma hora de início.',
    'Por favor, informe o local do jogo.',
    'Você não tem permissão para agendar jogos. Apenas administradores podem agendar.',
    'Erro ao agendar jogo. Tente novamente.',
    'Você não tem permissão para cancelar jogos. Apenas administradores podem cancelar.',
    'Erro ao cancelar jogo. Tente novamente.',
    'Você não tem permissão para excluir jogos. Apenas administradores podem excluir.',
    'Erro ao excluir agendamento. Tente novamente.'
];

/**
 * Exibe uma mensagem de notificação temporária na tela.
 * @param {string} message - O texto da mensagem a ser exibida.
 * @param {'success' | 'error' | 'info'} type - O tipo da mensagem (para estilização).
 * @param {number} duration - Duração em milissegundos que a mensagem ficará visível. Padrão: 4000ms (ajustado para corresponder à animação CSS).
 */
export function displayMessage(message, type = 'info', duration = 4000) {
    // Filtra mensagens - apenas permite as de agendamento
    if (!ALLOWED_MESSAGES.includes(message)) {
        return; // Bloqueia todas as outras mensagens
    }

    if (!messageContainer) {
        // Log removido
        return;
    }

    // Remove todas as mensagens anteriores
    messageContainer.innerHTML = '';

    const messageBox = document.createElement('div');
    messageBox.className = `message-box ${type}`;
    messageBox.textContent = message;

    messageContainer.appendChild(messageBox);

    setTimeout(() => {
        messageBox.remove();
    }, duration);
}
