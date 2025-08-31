// js/test/debug-notifications.js
// Módulo de teste para disparar notificações de depuração.

import { notifyNewSchedule } from '../utils/notifications.js';

const LS_FLAG = 'debugNotificationsEnabled';
let mounted = false;
let disposers = [];

function createEl(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'style' && typeof v === 'object') {
      Object.assign(el.style, v);
    } else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2), v);
      disposers.push(() => el.removeEventListener(k.slice(2), v));
    } else if (k === 'className') {
      el.className = v;
    } else {
      el.setAttribute(k, v);
    }
  });
  children.forEach(child => el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child));
  return el;
}

function injectStyles() {
  const style = createEl('style', { id: 'debugNotifStyles' });
  style.textContent = `
    #debugNotifFab {
      position: fixed; right: 16px; bottom: 16px; z-index: 99999;
      width: 52px; height: 52px; border-radius: 50%;
      background: linear-gradient(135deg, #f59e0b, #d97706); color: white;
      box-shadow: 0 6px 18px rgba(0,0,0,0.25);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; user-select: none; font-weight: 700; font-size: 18px;
    }
    #debugNotifFab:hover { filter: brightness(1.05); }
    #debugNotifPanel {
      position: fixed; right: 16px; bottom: 80px; z-index: 99999;
      width: min(92vw, 360px);
      background: #0f172a; color: #e2e8f0; border-radius: 12px;
      box-shadow: 0 12px 32px rgba(2,6,23,0.55);
      overflow: hidden; border: 1px solid rgba(148,163,184,0.18);
      display: none;
    }
    #debugNotifPanel.debug-open { display: block; }
    #debugNotifPanel .debug-header { padding: 12px 14px; font-weight: 700; background: linear-gradient(135deg,#1f2937,#111827); display:flex; align-items:center; justify-content:space-between; }
    #debugNotifPanel .debug-body { padding: 12px; display: grid; gap: 8px; }
    #debugNotifPanel .debug-row { display:flex; gap: 8px; flex-wrap: wrap; }
    #debugNotifPanel .debug-btn {
      background: #d97706; color: #fff; border: none; border-radius: 8px;
      padding: 10px 12px; cursor: pointer; font-weight: 600; flex: 1; min-width: 120px;
    }
    #debugNotifPanel .debug-btn.debug-secondary { background: #334155; }
    #debugNotifPanel .debug-toggle { display:flex; align-items:center; gap:8px; font-size: 14px; color: #cbd5e1; }
    #debugNotifPanel .debug-alert { background: #f59e0b22; color:#fde68a; border:1px solid #f59e0b55; padding:8px 10px; border-radius:8px; font-size: 13px; }
    #debugNotifPanel .debug-success { background: #16a34a22; color:#86efac; border:1px solid #16a34a55; }
  `;
  document.head.appendChild(style);
  disposers.push(() => style.remove());
}

async function showTestNotification() {
    const schedule = {
        id: 'test-schedule-123',
        date: '2025-12-25',
        startTime: '20:00',
        location: 'Quadra de Teste',
        notes: 'Isso é uma notificação de teste.'
    };
    await notifyNewSchedule(schedule);
}

function showToast(msg, type = 'info') {
  const el = createEl('div', { className: `debug-alert ${type === 'success' ? 'debug-success' : ''}` }, [msg]);
  const body = document.querySelector('#debugNotifPanel .debug-body');
  if (!body) return;
  body.prepend(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, 2200);
}

function mountUI() {
  if (mounted) return;
  injectStyles();

  const fab = createEl('div', { id: 'debugNotifFab', title: 'Debug Notificações' }, ['DBG']);
  const panel = createEl('div', { id: 'debugNotifPanel' }, [
    createEl('div', { className: 'debug-header' }, [
      createEl('span', {}, ['Debug de Notificações']),
      createEl('button', { className: 'debug-btn debug-secondary', onClick: () => panel.classList.remove('debug-open') }, ['Fechar'])
    ]),
    createEl('div', { className: 'debug-body' }, [
      createEl('div', { className: 'debug-row' }, [
        createEl('label', { className: 'debug-toggle' }, [
          (() => { const cb = createEl('input', { type: 'checkbox' }); cb.checked = localStorage.getItem(LS_FLAG) === 'true'; cb.addEventListener('change', () => {
            if (cb.checked) localStorage.setItem(LS_FLAG, 'true'); else localStorage.removeItem(LS_FLAG);
            showToast(cb.checked ? 'Habilitado no próximo carregamento' : 'Desabilitado para o próximo carregamento', 'success');
          }); disposers.push(() => cb.remove()); return cb; })(),
          createEl('span', {}, ['Ativar automaticamente'])
        ])
      ]),
      createEl('div', { className: 'debug-row' }, [
        createEl('button', { className: 'debug-btn', onClick: async () => { try { await showTestNotification(); showToast('Notificação de novo agendamento enviada!', 'success'); } catch (e) { showToast(e.message || 'Erro ao enviar', ''); } } }, ['Novo Agendamento'])
      ])
    ])
  ]);

  fab.addEventListener('click', async () => {
    panel.classList.toggle('debug-open');
  });
  disposers.push(() => fab.removeEventListener('click', () => {}));

  document.body.appendChild(fab);
  document.body.appendChild(panel);
  mounted = true;
}

export async function initDebugNotifications() {
  mountUI();
  return () => {
    try {
      localStorage.removeItem(LS_FLAG);
      const fab = document.getElementById('debugNotifFab');
      const panel = document.getElementById('debugNotifPanel');
      const style = document.getElementById('debugNotifStyles');
      if (fab) fab.remove(); if (panel) panel.remove(); if (style) style.remove();
      disposers.forEach(fn => { try { fn(); } catch(_){} });
      disposers = []; mounted = false;
    } catch (_) { /* noop */ }
  };
}
