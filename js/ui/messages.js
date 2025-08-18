// js/ui/messages.js
// Módulo para exibir mensagens de notificação na interface do usuário.

const messageContainer = document.getElementById('message-container');

/**
 * Exibe uma mensagem de notificação temporária na tela.
 * @param {string} message - O texto da mensagem a ser exibida.
 * @param {'success' | 'error' | 'info'} type - O tipo da mensagem (para estilização).
 * @param {number} duration - Duração em milissegundos que a mensagem ficará visível. Padrão: 4000ms (ajustado para corresponder à animação CSS).
 */
export function displayMessage(message, type = 'info', duration = 4000) {
    if (!messageContainer) {
        // Apenas erro grave mantido
        console.error("Elemento '#message-container' não encontrado no DOM.");
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
