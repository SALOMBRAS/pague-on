(() => {
  'use strict';

  const icon = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
  const app = document.querySelector('.app');
  if (!app) return;

  const sidebar = document.createElement('aside');
  sidebar.className = 'desktop-sidebar';
  sidebar.setAttribute('aria-label', 'Navegação do painel');
  sidebar.innerHTML = `
    <div class="desktop-brand"><span class="desktop-brand-mark">${icon('wallet-cards')}</span><span>Pague-<em>On</em></span></div>
    <nav class="desktop-nav" aria-label="Seções do painel">
      <button data-desktop-nav="home">${icon('house')}Visão geral</button>
      <button data-desktop-nav="caixa">${icon('wallet-cards')}Cobranças</button>
      <button data-desktop-nav="stock">${icon('boxes')}Produtos e estoque</button>
      <button data-desktop-nav="wealth">${icon('chart-pie')}Seu resumo</button>
      <button data-desktop-nav="profile">${icon('user-round')}Configurações</button>
    </nav>
    <div class="desktop-sidebar-bottom">
      <button class="desktop-help" data-desktop-rules>${icon('sparkles')} Regras automáticas</button>
      <button class="desktop-user" data-desktop-nav="profile"><span class="desktop-avatar">PO</span><span><b>Sua conta</b><span>Ver perfil e preferências</span></span></button>
    </div>`;

  const topbar = document.createElement('header');
  topbar.className = 'desktop-topbar';
  topbar.innerHTML = `
    <div class="desktop-context"><p>Pague On / painel</p><h2 data-desktop-title>Visão geral</h2></div>
    <div class="desktop-actions">
      <button class="desktop-search" data-desktop-search aria-label="Buscar em tudo">${icon('search')}<span>Buscar</span><kbd>Ctrl K</kbd></button>
      <button class="desktop-icon" data-desktop-notifications aria-label="Abrir notificações">${icon('bell')}</button>
      <button class="desktop-primary" data-desktop-add>${icon('plus')}Nova cobrança</button>
    </div>`;

  app.prepend(topbar);
  app.prepend(sidebar);

  const screenTitles = {
    home: 'Visão geral',
    caixa: 'Cobranças',
    stock: 'Produtos e estoque',
    wealth: 'Seu resumo',
    profile: 'Configurações'
  };

  const decorativeIcons = {
    '🔔': 'bell', '⌕': 'search', '💬': 'bell-ring', '🛒': 'shopping-cart',
    '📦': 'package', '💰': 'wallet-cards', '📥': 'arrow-down-left',
    '📤': 'arrow-up-right', '⚡': 'sparkles', '⏱': 'calendar-days',
    '▦': 'boxes', '↗': 'trending-up', '↓': 'arrow-down-left', '↑': 'arrow-up-right'
  };
  const normalizeDecorativeIcons = (root = document) => {
    const candidates = [];
    if (root.matches?.('i:not([data-lucide])')) candidates.push(root);
    root.querySelectorAll?.('i:not([data-lucide])').forEach((node) => candidates.push(node));
    candidates.forEach((node) => {
      const name = decorativeIcons[node.textContent.trim()];
      if (!name) return;
      node.dataset.lucide = name;
      node.setAttribute('aria-hidden', 'true');
      node.textContent = '';
    });
    root.querySelectorAll?.('.dash-greeting h1').forEach((heading) => { heading.textContent = heading.textContent.replace(/\s*👋\s*/g, ''); });
    window.pagueOnIcons?.render(root);
  };

  const triggerNav = (screen) => {
    const target = document.querySelector(`.bottom-nav [data-nav="${screen}"]`);
    target?.click();
    window.setTimeout(syncNavigation, 0);
  };

  const syncNavigation = () => {
    const active = document.querySelector('.bottom-nav .nav.active')?.dataset.nav || 'caixa';
    document.querySelectorAll('[data-desktop-nav]').forEach((button) => {
      button.classList.toggle('active', button.dataset.desktopNav === active);
      button.setAttribute('aria-current', button.dataset.desktopNav === active ? 'page' : 'false');
    });
    const title = document.querySelector('[data-desktop-title]');
    if (title) title.textContent = screenTitles[active] || 'Pague On';
  };

  document.querySelectorAll('[data-desktop-nav]').forEach((button) => button.addEventListener('click', () => triggerNav(button.dataset.desktopNav)));
  document.querySelector('[data-desktop-add]')?.addEventListener('click', () => document.querySelector('#centerAdd')?.click());
  document.querySelector('[data-desktop-search]')?.addEventListener('click', () => document.querySelector('#searchBtn')?.click());
  document.querySelector('[data-desktop-notifications]')?.addEventListener('click', () => document.querySelector('[data-home-notifications]')?.click() || document.querySelector('[data-open-notifications]')?.click());
  document.querySelector('[data-desktop-rules]')?.addEventListener('click', () => document.querySelector('#rulesQuick')?.click());

  document.addEventListener('keydown', (event) => {
    const tag = document.activeElement?.tagName;
    const editing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;
    if (editing) return;
    if (event.key.toLowerCase() === 'n') { event.preventDefault(); document.querySelector('#centerAdd')?.click(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.querySelector('#searchBtn')?.click(); }
    if (event.key === '/') { event.preventDefault(); document.querySelector('#searchBtn')?.click(); }
    if (event.key === 'Escape') document.querySelector('#sheetCancel')?.click() || document.querySelector('[data-close-panel]')?.click();
  });

  new MutationObserver((records) => {
    syncNavigation();
    records.forEach((record) => record.addedNodes.forEach((node) => { if (node.nodeType === 1) normalizeDecorativeIcons(node); }));
  }).observe(app, { attributes: true, childList: true, subtree: true, attributeFilter: ['class'] });
  syncNavigation();
  normalizeDecorativeIcons(app);
})();
