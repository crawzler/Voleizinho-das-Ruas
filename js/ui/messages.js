// js/ui/messages.js
// Módulo para exibir mensagens de notificação na interface do usuário.

const messageContainer = document.getElementById('message-container');

/**
 * Exibe uma mensagem de notificação temporária na tela.
 * @param {string} message - O texto da mensagem a ser exibida.
 * @param {'success' | 'error' | 'info'} type - O tipo da mensagem (para estilização).
 * @param {number} duration - Duração em milissegundos que a mensagem ficará visível. Padrão: 4000ms (ajustado para corresponder à animação CSS).
 */
export function displayMessage(message, type = 'info', duration = 4000) { // Alterado o padrão para 4000ms
    if (!messageContainer) {
        console.error("Elemento '#message-container' não encontrado no DOM.");
        return;
    }

    // Adiciona um console log para depuração
    console.log(`[displayMessage] Exibindo mensagem: "${message}" (Tipo: ${type}, Duração: ${duration}ms)`);

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
