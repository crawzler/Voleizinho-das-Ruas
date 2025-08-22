// js/ui/notification-permission-help.js
// Mostra um modal explicativo quando a permissão de notificações está negada

function detectPlatform() {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isChrome = /Chrome\//i.test(ua) && !/Edg\//i.test(ua) && !/OPR\//i.test(ua);
  const isFirefox = /Firefox\//i.test(ua);
  const isEdge = /Edg\//i.test(ua);
  const isSafari = /Safari\//i.test(ua) && !/Chrome\//i.test(ua) && !/Edg\//i.test(ua);
  const isStandalonePWA = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  return { isAndroid, isIOS, isChrome, isFirefox, isEdge, isSafari, isStandalonePWA };
}

function tryOpenNotificationSettings() {
  // Evita usar esquemas bloqueados como intent://, app-settings:, chrome:// ou about:
  // Navegadores geralmente bloqueiam e geram erros no console. Preferimos instruções manuais.
  return false;
}

function buildInstructionsHTML() {
  const { isAndroid, isIOS, isChrome, isFirefox, isSafari } = detectPlatform();

  if (isAndroid && isChrome) {
    return `
      <ol>
        <li>Toque no ícone ⋮ do navegador.</li>
        <li>Acesse <strong>Informações do site</strong>.</li>
        <li>Entre em <strong>Permissões</strong> e toque em <strong>Notificações</strong>.</li>
        <li>Selecione <strong>Permitir</strong>.</li>
      </ol>`;
  }
  if (isAndroid && isFirefox) {
    return `
      <ol>
        <li>Toque no ícone ⋮ do navegador.</li>
        <li>Acesse <strong>Configurações</strong> &gt; <strong>Permissões do site</strong>.</li>
        <li>Abra <strong>Notificações</strong> e permita para este site.</li>
      </ol>`;
  }
  if (isIOS && isSafari) {
    return `
      <ol>
        <li>Abra <strong>Ajustes</strong> do iOS.</li>
        <li>Vá em <strong>Safari</strong> &gt; <strong>Notificações</strong>.</li>
        <li>Permita <strong>Notificações Push</strong> e volte ao app.</li>
        <li>No site, quando solicitado novamente, escolha <strong>Permitir</strong>.</li>
      </ol>`;
  }
  // Desktop genérico
  if (isChrome) {
    return `
      <ol>
        <li>Clique no cadeado (🔒) ao lado do endereço do site.</li>
        <li>Abra <strong>Configurações do site</strong>.</li>
        <li>Em <strong>Notificações</strong>, selecione <strong>Permitir</strong>.</li>
      </ol>`;
  }
  if (isFirefox) {
    return `
      <ol>
        <li>Clique no ícone de permissões ao lado do endereço.</li>
        <li>Gerencie as permissões e permita <strong>Notificações</strong> para este site.</li>
      </ol>`;
  }
  if (isSafari) {
    return `
      <ol>
        <li>Abra <strong>Safari &gt; Preferências</strong>.</li>
        <li>Vá em <strong>Websites</strong> &gt; <strong>Notifications</strong>.</li>
        <li>Defina este site como <strong>Permitir</strong>.</li>
      </ol>`;
  }

  // Fallback
  return `
    <ol>
      <li>Clique no cadeado (🔒) ao lado do endereço do site.</li>
      <li>Abra as <strong>Configurações do site</strong>.</li>
      <li>Em <strong>Notificações</strong>, selecione <strong>Permitir</strong>.</li>
    </ol>`;
}

export function showNotificationPermissionHelp() {
  // Evita múltiplas instâncias
  if (document.getElementById('notif-permission-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'notif-permission-overlay';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.right = '0';
  overlay.style.bottom = '0';
  overlay.style.background = 'rgba(0,0,0,0.6)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '9999';

  const modal = document.createElement('div');
  modal.style.width = '90%';
  modal.style.maxWidth = '520px';
  modal.style.background = 'var(--card-bg, #fff)';
  modal.style.color = 'var(--text-color, #111)';
  modal.style.borderRadius = '12px';
  modal.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
  modal.style.padding = '20px';

  modal.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
      <span class="material-icons" aria-hidden="true">notifications_off</span>
      <h3 style="margin:0;">Ativar notificações</h3>
    </div>
    <p style="margin:8px 0 12px;">Para avisarmos sobre novos jogos e alterações, precisamos da sua permissão.</p>

    <div style="background:rgba(0,0,0,0.04);padding:12px;border-radius:8px;margin-bottom:12px;">
      <strong>Como ativar</strong>
      ${buildInstructionsHTML()}
    </div>

    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
      <button id="notif-permission-cancel" class="button" style="padding:10px 14px;border-radius:8px;background:#e5e7eb;">Fechar</button>
      <button id="notif-permission-open-settings" class="button button--primary" style="padding:10px 14px;border-radius:8px;background:#2563EB;color:#fff;">Ativar notificações</button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = () => {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  };

  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) close();
  });
  modal.querySelector('#notif-permission-cancel')?.addEventListener('click', close);

  modal.querySelector('#notif-permission-open-settings')?.addEventListener('click', async () => {
    // Tenta solicitar permissão novamente (alguns navegadores permitem se o gesto for explícito)
    try {
      if ('Notification' in window && Notification.permission !== 'granted') {
        let result = 'default';
        try {
          result = await Notification.requestPermission();
        } catch (_) { /* ignore */ }

        if (result === 'granted') {
          // Fecha modal ao conceder
          close();
          return;
        }
      }
    } catch (_) { /* ignore */ }

    // Se não for possível ou continuar negado, mantemos apenas as instruções
    // Nada adicional aqui para evitar erros no console
  });
}