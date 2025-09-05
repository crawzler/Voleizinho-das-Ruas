// js/utils/dom-utils.js
// Utilitários para manipulação segura do DOM

/**
 * Query selector seguro que não falha se elemento não existir
 * @param {string} selector - Seletor CSS
 * @param {Element} parent - Elemento pai (padrão: document)
 * @returns {Element|null} - Elemento encontrado ou null
 */
export function safeQuerySelector(selector, parent = document) {
    try {
        return parent.querySelector(selector);
    } catch (e) {
        console.warn(`Erro ao buscar elemento: ${selector}`, e);
        return null;
    }
}

/**
 * Query selector seguro com validação obrigatória
 * @param {string} selector - Seletor CSS
 * @param {Element} parent - Elemento pai (padrão: document)
 * @returns {Element} - Elemento encontrado
 * @throws {Error} - Se elemento não for encontrado
 */
export function requireElement(selector, parent = document) {
    const element = safeQuerySelector(selector, parent);
    if (!element) {
        throw new Error(`Elemento obrigatório não encontrado: ${selector}`);
    }
    return element;
}

/**
 * Atualiza texto de elemento se existir
 * @param {string} selector - Seletor CSS
 * @param {string} text - Texto a definir
 * @param {Element} parent - Elemento pai (padrão: document)
 */
export function safeSetText(selector, text, parent = document) {
    const element = safeQuerySelector(selector, parent);
    if (element) {
        element.textContent = text;
    }
}

/**
 * Atualiza valor de input se existir
 * @param {string} selector - Seletor CSS
 * @param {string} value - Valor a definir
 * @param {Element} parent - Elemento pai (padrão: document)
 */
export function safeSetValue(selector, value, parent = document) {
    const element = safeQuerySelector(selector, parent);
    if (element && 'value' in element) {
        element.value = value;
    }
}