// js/ui/messages.js
// Módulo para exibir mensagens de notificação na interface do usuário.

const messageContainer = document.getElementById('message-container');

/**
 * Exibe uma mensagem de notificação temporária na tela.
 * @param {string} message - O texto da mensagem a ser exibida.
 * @param {'success' | 'error' | 'info'} type - O tipo da mensagem (para estilização).
 * @param {number} duration - Duração em milissegundos que a mensagem ficará visível. Padrão: 3000ms.
 */
export function displayMessage(message, type = 'info', duration = 3000) {
    if (!messageContainer) {
        console.error("Elemento '#message-container' não encontrado no DOM.");
        return;
    }

    const messageBox = document.createElement('div');
    messageBox.className = `message-box ${type}`;
    messageBox.textContent = message;

    // Adiciona a mensagem ao container
    messageContainer.appendChild(messageBox);

    // Remove a mensagem após a duração especificada
    setTimeout(() => {
        messageBox.remove();
    }, duration);
}
