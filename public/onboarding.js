(() => {
  // Uma nova chave força esta edição do tour para todas as contas já existentes.
  // O sufixo do usuário impede que uma conta conclua o guia por outra no mesmo aparelho.
  const STORAGE_KEY = 'pagueon_tour_completed_v6';
  const MOBILE_QUERY = '(max-width: 1023px)';
  const state = { index: 0, steps: [], overlay: null, previousFocus: null, autoStartedFor: null, stepTimer: null };

  const mobileSteps = [
    { action: 'home', target: '#financial-dashboard .financial-title, .top', title: 'Bem-vindo ao Pague-On', text: 'Veja quanto você tem para receber e o que está vencido, tudo em um só lugar.' },
    { action: 'home', target: '#centerAdd', title: 'Adicione uma conta', text: 'Toque no + para criar uma cobrança, produto, empréstimo ou outro registro.' },
    { action: 'caixa', target: '.bottom-nav .nav[data-nav="caixa"]', title: 'Acompanhe o caixa', text: 'Cobranças, parcelas, pagamentos e pendências ficam aqui.' },
    { action: 'estoque', target: '.bottom-nav .nav[data-nav="stock"]', title: 'Controle o estoque', text: 'Cadastre produtos, acompanhe quantidades e veja a margem das vendas.' },
    { action: 'profile', target: '.bottom-nav .nav[data-nav="profile"]', title: 'Tudo no Perfil', text: 'Preferências, segurança, notificações, metas, relatórios e cobradores.' }
  ];

  const desktopSteps = [
    { action: 'home', target: '.desk-top', title: 'Bem-vindo ao Pague-On', text: 'Este painel concentra tudo que você precisa para acompanhar o dinheiro.' },
    { action: 'home', target: '#deskNewCharge', title: 'Nova operação', text: 'Crie uma cobrança, venda ou empréstimo em poucos passos. O atalho é N.' },
    { action: 'caixa', target: '.side-nav .nav[data-nav="caixa"]', title: 'Caixa', text: 'Consulte cobranças, parcelas e pagamentos sem sair do controle financeiro.' },
    { action: 'estoque', target: '.side-nav .nav[data-nav="stock"]', title: 'Estoque', text: 'Cadastre produtos, acompanhe as quantidades e analise suas margens.' },
    { action: 'profile', target: '.side-nav .nav[data-nav="profile"]', title: 'Perfil', text: 'Gerencie segurança, notificações e as preferências da sua conta.' }
  ];

  const isMobile = () => window.matchMedia?.(MOBILE_QUERY).matches;
  const isReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const isAuthenticated = () => Boolean(window.pagueOnAuth?.getToken?.());
  const storageKey = () => `${STORAGE_KEY}:${String(window.pagueOnAuth?.getUser?.()?.id || 'session')}`;
  const stepAction = (name) => {
    if (!name) return;
    if (name !== 'clientes') window.pagueOnQuickOperation?.close?.();
    if (name !== 'configuracoes') window.pagueOnFinancialSettings?.close?.();
    const actions = window.pagueOnOnboardingActions;
    if (actions?.[name]) { actions[name](); return; }
    document.querySelector(`[data-nav="${name}"]`)?.click();
  };
  const within = (value, min, max) => Math.max(min, Math.min(value, max));

  function rememberCompleted() {
    try { localStorage.setItem(storageKey(), 'true'); } catch (_) { /* storage can be blocked */ }
  }

  function isCompleted() {
    try { return localStorage.getItem(storageKey()) === 'true'; } catch (_) { return false; }
  }

  function clearStepTimer() {
    if (state.stepTimer) window.clearTimeout(state.stepTimer);
    state.stepTimer = null;
  }

  function stop({ completed = false } = {}) {
    clearStepTimer();
    document.removeEventListener('keydown', onKeydown, true);
    document.body.classList.remove('tour-active');
    state.overlay?.remove();
    state.overlay = null;
    if (completed) rememberCompleted();
    state.previousFocus?.focus?.({ preventScroll: true });
    state.previousFocus = null;
  }

  function complete() {
    stop({ completed: true });
    stepAction('home');
  }

  function focusable() {
    return [...state.overlay?.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])') || []]
      .filter((element) => !element.hidden);
  }

  function onKeydown(event) {
    if (!state.overlay) return;
    if (event.key === 'Escape') { event.preventDefault(); stop({ completed: true }); return; }
    if (event.key === 'ArrowRight' || event.key === 'Enter') { event.preventDefault(); next(); return; }
    if (event.key === 'ArrowLeft') { event.preventDefault(); previous(); return; }
    if (event.key !== 'Tab') return;
    const items = focusable();
    if (!items.length) return;
    const first = items[0]; const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function findTarget(selector) {
    return selector.split(',').map((item) => document.querySelector(item.trim())).find(Boolean);
  }

  function place(target, tooltip, requestedPosition) {
    const viewportPadding = 16;
    const rect = target.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - viewportPadding * 2);
    const height = tooltip.offsetHeight || 190;
    let top = requestedPosition === 'top' ? rect.top - height - 16 : rect.bottom + 16;
    if (requestedPosition === 'center') top = Math.max(viewportPadding, (window.innerHeight - height) / 2);
    if (top + height > window.innerHeight - viewportPadding) top = Math.max(viewportPadding, rect.top - height - 16);
    const left = within(rect.left + rect.width / 2 - width / 2, viewportPadding, window.innerWidth - width - viewportPadding);
    return { rect, top, left, width };
  }

  function ensureOverlay() {
    if (state.overlay?.isConnected) return state.overlay;
    const overlay = document.createElement('section');
    overlay.className = 'onboarding-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'onboarding-title');
    overlay.setAttribute('aria-describedby', 'onboarding-copy');
    overlay.innerHTML = '<div class="onboarding-ambient" aria-hidden="true"></div><div class="onboarding-spotlight" aria-hidden="true"></div><article class="onboarding-tooltip"></article>';
    document.body.append(overlay);
    state.overlay = overlay;
    return overlay;
  }

  function renderStep(overlay, step) {
    const tooltip = overlay.querySelector('.onboarding-tooltip');
    tooltip.innerHTML = `<div class="onboarding-guide"><img class="onboarding-mascot" src="/assets/pague-mascot-user-v3.png" alt="" aria-hidden="true" width="96" height="96" decoding="async"><p class="onboarding-count">Nota apresenta · ${state.index + 1} de ${state.steps.length}</p></div><h2 id="onboarding-title">${step.title}</h2><p id="onboarding-copy">${step.text}</p><div class="onboarding-progress" aria-hidden="true"><i style="width:${((state.index + 1) / state.steps.length) * 100}%"></i></div><div class="onboarding-actions">${state.index ? '<button class="onboarding-prev" type="button" data-tour-prev>Anterior</button>' : ''}<button class="onboarding-skip" type="button" data-tour-skip>Pular tour</button><button class="onboarding-next" type="button" data-tour-next>${state.index === state.steps.length - 1 ? 'Começar' : 'Próximo'}</button></div>`;
    tooltip.querySelector('[data-tour-next]').onclick = next;
    tooltip.querySelector('[data-tour-prev]')?.addEventListener('click', previous);
    tooltip.querySelector('[data-tour-skip]').onclick = () => stop({ completed: true });
    return tooltip;
  }

  function moveOverlay(overlay, layout) {
    const spotlight = overlay.querySelector('.onboarding-spotlight');
    const spotlightStyles = { top: `${Math.max(4, layout.rect.top - 7)}px`, left: `${Math.max(4, layout.rect.left - 7)}px`, width: `${layout.rect.width + 14}px`, height: `${layout.rect.height + 14}px` };
    const tooltip = overlay.querySelector('.onboarding-tooltip');
    const tooltipStyles = { top: `${layout.top}px`, left: `${layout.left}px`, width: `${layout.width}px` };
    const applyPosition = () => {
      Object.assign(spotlight.style, spotlightStyles);
      Object.assign(tooltip.style, tooltipStyles);
    };
    if (!overlay.dataset.positioned) {
      overlay.dataset.positioned = 'true';
      applyPosition();
      return;
    }
    window.requestAnimationFrame(applyPosition);
  }

  function draw() {
    clearStepTimer();
    const step = state.steps[state.index];
    if (!step) { complete(); return; }
    stepAction(step.action);
    state.stepTimer = window.setTimeout(() => {
      const target = findTarget(step.target);
      if (!target) { next(); return; }
      const overlay = ensureOverlay();
      const tooltip = renderStep(overlay, step);
      const layout = place(target, tooltip, step.position);
      moveOverlay(overlay, layout);
      tooltip.querySelector('[data-tour-next]').focus({ preventScroll: true });
    }, isReducedMotion() ? 0 : 260);
  }

  function next() { if (state.index < state.steps.length - 1) { state.index += 1; draw(); } else complete(); }
  function previous() { if (state.index > 0) { state.index -= 1; draw(); } }

  function start({ force = false } = {}) {
    if (state.overlay || (!force && isCompleted()) || (!force && !isAuthenticated())) return false;
    state.steps = isMobile() ? mobileSteps : desktopSteps;
    state.index = 0;
    state.previousFocus = document.activeElement;
    document.body.classList.add('tour-active');
    document.addEventListener('keydown', onKeydown, true);
    draw();
    return true;
  }

  function addProfileControl() {
    const profile = document.querySelector('#profileView.show');
    if (!profile || profile.querySelector('[data-onboarding-reset]')) return;
    const section = document.createElement('section');
    section.className = 'profile-section';
    section.dataset.onboardingReset = 'true';
    section.innerHTML = '<h2>AJUDA</h2><div class="settings-card"><button class="setting" type="button" data-onboarding-reset><span>Como usar o Pague-On</span><span class="setting-hint">Ver tour novamente</span></button></div>';
    profile.querySelector('.signout')?.before(section);
    section.querySelector('[data-onboarding-reset]').onclick = () => start({ force: true });
  }

  function scheduleAutoStart() {
    const key = storageKey();
    if (state.autoStartedFor === key || isCompleted() || !isAuthenticated()) return;
    state.autoStartedFor = key;
    window.setTimeout(() => start(), 520);
  }

  function boot() {
    const app = document.querySelector('.app');
    if (app) new MutationObserver(addProfileControl).observe(app, { childList: true, subtree: true });
    window.addEventListener('pagueon:auth', scheduleAutoStart);
    window.addEventListener('load', scheduleAutoStart, { once: true });
    window.addEventListener('resize', () => { if (state.overlay) { state.steps = isMobile() ? mobileSteps : desktopSteps; state.index = Math.min(state.index, state.steps.length - 1); draw(); } });
    document.addEventListener('keydown', (event) => { if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey && !state.overlay) { const tag = document.activeElement?.tagName; if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) { event.preventDefault(); start({ force: true }); } } });
    addProfileControl();
    scheduleAutoStart();
  }

  window.pagueOnOnboarding = { start, complete, get currentStep() { return state.index; }, get isOpen() { return Boolean(state.overlay); } };
  boot();
})();
