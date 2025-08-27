// js/test/mi-band-test-notifications.js
// Módulo de teste isolado para disparar notificações simuladas ao Mi Band
// - Carregado dinamicamente apenas quando habilitado
// - Mantém dados isolados usando chaves específicas de teste no localStorage
// - Pode ser removido sem afetar o restante do app

import { requestNotificationPermission, areNotificationsSupported } from '../utils/notifications.js';

const LS_FLAG = 'miBandTestNotifEnabled';
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
  const style = createEl('style', { id: 'miBandTestStyles' });
  style.textContent = `
    #miBandTestFab {
      position: fixed; right: 16px; bottom: 16px; z-index: 99999;
      width: 52px; height: 52px; border-radius: 50%;
      background: linear-gradient(135deg, #2563EB, #1D4ED8); color: white;
      box-shadow: 0 6px 18px rgba(0,0,0,0.25);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; user-select: none; font-weight: 700; font-size: 18px;
    }
    #miBandTestFab:hover { filter: brightness(1.05); }
    #miBandTestPanel {
      position: fixed; right: 16px; bottom: 80px; z-index: 99999;
      width: min(92vw, 360px);
      background: #0f172a; color: #e2e8f0; border-radius: 12px;
      box-shadow: 0 12px 32px rgba(2,6,23,0.55);
      overflow: hidden; border: 1px solid rgba(148,163,184,0.18);
      display: none;
    }
    #miBandTestPanel.mi-open { display: block; }
    #miBandTestPanel .mi-header { padding: 12px 14px; font-weight: 700; background: linear-gradient(135deg,#1f2937,#111827); display:flex; align-items:center; justify-content:space-between; }
    #miBandTestPanel .mi-body { padding: 12px; display: grid; gap: 8px; }
    #miBandTestPanel .mi-row { display:flex; gap: 8px; flex-wrap: wrap; }
    #miBandTestPanel .mi-btn {
      background: #1d4ed8; color: #fff; border: none; border-radius: 8px;
      padding: 10px 12px; cursor: pointer; font-weight: 600; flex: 1; min-width: 120px;
    }
    #miBandTestPanel .mi-btn.mi-secondary { background: #334155; }
    #miBandTestPanel .mi-btn.mi-danger { background: #dc2626; }
    #miBandTestPanel .mi-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    #miBandTestPanel .mi-toggle { display:flex; align-items:center; gap:8px; font-size: 14px; color: #cbd5e1; }
    #miBandTestPanel .mi-alert { background: #f59e0b22; color:#fde68a; border:1px solid #f59e0b55; padding:8px 10px; border-radius:8px; font-size: 13px; }
    #miBandTestPanel .mi-success { background: #16a34a22; color:#86efac; border:1px solid #16a34a55; }
  `;
  document.head.appendChild(style);
  disposers.push(() => style.remove());
}

async function ensurePermission() {
  if (!areNotificationsSupported()) {
    throw new Error('Notificações não são suportadas neste navegador.');
  }
  if (Notification.permission !== 'granted') {
    const granted = await requestNotificationPermission();
    if (!granted) throw new Error('Permissão de notificação negada.');
  }
}

async function showTestNotification(kind = 'simple') {
  await ensurePermission();
  const registration = await navigator.serviceWorker.ready;
  const base = {
    icon: './images/icon-192x192.png',
    badge: './images/icon-96x96.png',
    tag: `mi-band-test-${kind}-${Date.now()}`,
    data: { origin: 'mi-band-test', kind },
  };

  switch (kind) {
    case 'simple':
      await registration.showNotification('Mi Band • Teste simples', {
        ...base,
        body: 'Olá! Esta é uma notificação de teste.',
        vibrate: [100, 50, 100],
        actions: [{ action: 'view', title: 'Abrir' }, { action: 'close', title: 'Fechar' }],
      });
      break;
    case 'long':
      await registration.showNotification('Mi Band • Texto longo', {
        ...base,
        body: 'Mensagem longa de teste para verificar truncamento e exibição no Mi Band. Linha 1. Linha 2. Linha 3. ✅',
        vibrate: [200, 70, 200],
        requireInteraction: false,
      });
      break;
    case 'emoji':
      await registration.showNotification('Mi Band • Emojis', {
        ...base,
        body: '🏐 Jogo hoje! ⏰ 19:00 📍 Quadra Central 💪🔥',
        vibrate: [120, 50, 120, 50, 120],
      });
      break;
    case 'persistent':
      await registration.showNotification('Mi Band • Persistente', {
        ...base,
        body: 'Fica até você interagir (requireInteraction).',
        vibrate: [300, 120, 300],
        requireInteraction: true,
        actions: [{ action: 'view', title: 'Ver' }, { action: 'close', title: 'Fechar' }],
      });
      break;
    case 'actions':
      await registration.showNotification('Mi Band • Ações', {
        ...base,
        body: 'Teste com ações View/Close para service worker.',
        vibrate: [180, 60, 180],
        actions: [
          { action: 'view', title: '👀 Ver' },
          { action: 'close', title: '❌ Fechar' },
        ],
      });
      break;
  }
}

function showToast(msg, type = 'info') {
  const el = createEl('div', { className: `mi-alert ${type === 'success' ? 'mi-success' : ''}` }, [msg]);
  const body = document.querySelector('#miBandTestPanel .mi-body');
  if (!body) return;
  body.prepend(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, 2200);
}

function mountUI() {
  if (mounted) return;
  injectStyles();

  const fab = createEl('div', { id: 'miBandTestFab', title: 'Teste Mi Band' }, ['MB']);
  const panel = createEl('div', { id: 'miBandTestPanel' }, [
    createEl('div', { className: 'mi-header' }, [
      createEl('span', {}, ['Teste de Notificações Mi Band']),
      createEl('button', { className: 'mi-btn mi-secondary', onClick: () => panel.classList.remove('mi-open') }, ['Fechar'])
    ]),
    createEl('div', { className: 'mi-body' }, [
      createEl('div', { className: 'mi-row' }, [
        createEl('label', { className: 'mi-toggle' }, [
          (() => { const cb = createEl('input', { type: 'checkbox' }); cb.checked = localStorage.getItem(LS_FLAG) === 'true'; cb.addEventListener('change', () => {
            if (cb.checked) localStorage.setItem(LS_FLAG, 'true'); else localStorage.removeItem(LS_FLAG);
            showToast(cb.checked ? 'Habilitado no próximo carregamento' : 'Desabilitado para o próximo carregamento', 'success');
          }); disposers.push(() => cb.remove()); return cb; })(),
          createEl('span', {}, ['Ativar automaticamente'])
        ])
      ]),
      createEl('div', { className: 'mi-row' }, [
        createEl('button', { className: 'mi-btn', onClick: async () => { try { await showTestNotification('simple'); showToast('Notificação simples enviada!', 'success'); } catch (e) { showToast(e.message || 'Erro ao enviar', ''); } } }, ['Simples']),
        createEl('button', { className: 'mi-btn', onClick: async () => { try { await showTestNotification('long'); showToast('Notificação longa enviada!', 'success'); } catch (e) { showToast(e.message || 'Erro ao enviar', ''); } } }, ['Longa'])
      ]),
      createEl('div', { className: 'mi-row' }, [
        createEl('button', { className: 'mi-btn', onClick: async () => { try { await showTestNotification('emoji'); showToast('Notificação com emojis enviada!', 'success'); } catch (e) { showToast(e.message || 'Erro ao enviar', ''); } } }, ['Emojis']),
        createEl('button', { className: 'mi-btn', onClick: async () => { try { await showTestNotification('persistent'); showToast('Notificação persistente enviada!', 'success'); } catch (e) { showToast(e.message || 'Erro ao enviar', ''); } } }, ['Persistente'])
      ]),
      createEl('div', { className: 'mi-row' }, [
        createEl('button', { className: 'mi-btn mi-secondary', onClick: async () => { try { await showTestNotification('actions'); showToast('Notificação com ações enviada!', 'success'); } catch (e) { showToast(e.message || 'Erro ao enviar', ''); } } }, ['Ações (SW)']),
        createEl('button', { className: 'mi-btn mi-danger', onClick: () => {
          localStorage.removeItem(LS_FLAG);
          panel.classList.remove('mi-open');
          fab.remove(); panel.remove();
          disposers.forEach(fn => { try { fn(); } catch(_){} });
          disposers = [];
          mounted = false;
          alert('Sistema de teste desativado. Recarregue a página para removê-lo completamente.');
        } }, ['Desativar e Remover'])
      ])
    ])
  ]);

  fab.addEventListener('click', async () => {
    panel.classList.toggle('mi-open');
    try {
      await ensurePermission();
    } catch (e) {
      showToast(e.message || 'Permissão não concedida');
    }
  });
  disposers.push(() => fab.removeEventListener('click', () => {}));

  document.body.appendChild(fab);
  document.body.appendChild(panel);
  mounted = true;
}

export async function initMiBandTestNotifications() {
  try {
    // Não tocar em configurações do app principal; apenas garantir SW pronto
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.ready;
    }
  } catch (_) { /* noop */ }
  mountUI();
  return () => {
    try {
      localStorage.removeItem(LS_FLAG);
      const fab = document.getElementById('miBandTestFab');
      const panel = document.getElementById('miBandTestPanel');
      const style = document.getElementById('miBandTestStyles');
      if (fab) fab.remove(); if (panel) panel.remove(); if (style) style.remove();
      disposers.forEach(fn => { try { fn(); } catch(_){} });
      disposers = []; mounted = false;
    } catch (_) { /* noop */ }
  };
}