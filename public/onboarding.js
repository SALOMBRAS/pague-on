(() => {
  // Uma nova chave força esta edição do tour para todas as contas já existentes.
  // O sufixo do usuário impede que uma conta conclua o guia por outra no mesmo aparelho.
  const STORAGE_KEY = 'pagueon_tour_completed_v3';
  const MOBILE_QUERY = '(max-width: 1023px)';
  const state = { index: 0, steps: [], overlay: null, previousFocus: null, autoStartedFor: null, stepTimer: null };

  const mobileSteps = [
    { target: '.app', title: 'Bem-vindo ao Pague-On', text: 'Controle seus recebimentos e lembretes em um só lugar.', position: 'center' },
    { action: 'home', target: '#homeView', title: 'Seu resumo', text: 'Veja o que tem para receber e o que precisa de atenção.' },
    { action: 'home', target: '#centerAdd', title: 'Adicionar uma conta', text: 'Toque aqui para registrar uma cobrança, produto ou lembrete.' },
    { action: 'caixa', target: '.bottom-nav .nav[data-nav="caixa"]', title: 'Acompanhar pagamentos', text: 'No Resumo você acompanha o que está aberto, pago ou atrasado.' },
    { action: 'profile', target: '.bottom-nav .nav[data-nav="profile"]', title: 'Lembretes e preferências', text: 'No Perfil você ativa alertas e pode rever este tour.' },
    { action: 'home', target: '.bottom-nav', title: 'Tudo pronto', text: 'Comece quando quiser. Seus dados continuam protegidos.', position: 'top' }
  ];

  const desktopSteps = [
    { target: '.app', title: 'Bem-vindo ao Pague-On', text: 'Seu painel para acompanhar cobranças e recebimentos.', position: 'center' },
    { action: 'home', target: '#financial-dashboard, #homeView', title: 'Visão geral', text: 'Aqui estão seus valores a receber, atrasados e recebidos no período.' },
    { action: 'caixa', target: '.side-nav .nav[data-nav="caixa"]', title: 'Cobranças', text: 'Abra o Caixa para consultar parcelas, pagamentos e pendências.' },
    { action: 'home', target: '#deskNewCharge', title: 'Nova operação', text: 'Registre uma nova cobrança em poucos passos ou pressione N.' },
    { action: 'profile', target: '.side-nav .nav[data-nav="profile"]', title: 'Configurações', text: 'Ajuste sua conta, segurança, notificações e veja este tour depois.' },
    { action: 'home', target: '.side-foot', title: 'Atalhos rápidos', text: 'N cria, / busca, ? abre esta ajuda e Esc fecha painéis.' },
    { action: 'home', target: '.desk-top', title: 'Tudo pronto', text: 'Use o painel para manter seus recebimentos sob controle.', position: 'bottom' }
  ];

  const isMobile = () => window.matchMedia?.(MOBILE_QUERY).matches;
  const isReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const isAuthenticated = () => Boolean(window.pagueOnAuth?.getToken?.());
  const storageKey = () => `${STORAGE_KEY}:${String(window.pagueOnAuth?.getUser?.()?.id || 'session')}`;
  const stepAction = (name) => {
    if (!name) return;
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
    const app = document.querySelector('.app');
    if (app) app.inert = false;
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
    // Esta edição é obrigatória: Esc não pode liberar a interface antes da conclusão.
    if (event.key === 'Escape') { event.preventDefault(); return; }
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

  function draw() {
    clearStepTimer();
    const step = state.steps[state.index];
    if (!step) { complete(); return; }
    stepAction(step.action);
    state.stepTimer = window.setTimeout(() => {
      const target = findTarget(step.target);
      if (!target) { next(); return; }
      state.overlay?.remove();
      const overlay = document.createElement('section');
      overlay.className = 'onboarding-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'onboarding-title');
      overlay.setAttribute('aria-describedby', 'onboarding-copy');
      overlay.innerHTML = `<div class="onboarding-spotlight" aria-hidden="true"></div><article class="onboarding-tooltip"><div class="onboarding-guide"><img class="onboarding-mascot" src="/assets/pague-mascot-dollar-v2.png" alt="" aria-hidden="true" width="96" height="96" decoding="async"><p class="onboarding-count">Nota apresenta · ${state.index + 1} de ${state.steps.length}</p></div><h2 id="onboarding-title">${step.title}</h2><p id="onboarding-copy">${step.text}</p><p class="onboarding-required">Conclua este guia rápido para liberar o painel.</p><div class="onboarding-progress" aria-hidden="true"><i style="width:${((state.index + 1) / state.steps.length) * 100}%"></i></div><div class="onboarding-actions">${state.index ? '<button class="onboarding-prev" type="button" data-tour-prev>Anterior</button>' : ''}<button class="onboarding-next" type="button" data-tour-next>${state.index === state.steps.length - 1 ? 'Concluir tutorial' : 'Próximo'}</button></div></article>`;
      document.body.append(overlay);
      state.overlay = overlay;
      const tooltip = overlay.querySelector('.onboarding-tooltip');
      const layout = place(target, tooltip, step.position);
      const spotlight = overlay.querySelector('.onboarding-spotlight');
      Object.assign(spotlight.style, { top: `${Math.max(4, layout.rect.top - 7)}px`, left: `${Math.max(4, layout.rect.left - 7)}px`, width: `${layout.rect.width + 14}px`, height: `${layout.rect.height + 14}px` });
      Object.assign(tooltip.style, { top: `${layout.top}px`, left: `${layout.left}px`, width: `${layout.width}px` });
      overlay.querySelector('[data-tour-next]').onclick = next;
      overlay.querySelector('[data-tour-prev]')?.addEventListener('click', previous);
      overlay.querySelector('[data-tour-next]').focus({ preventScroll: true });
    }, isReducedMotion() ? 0 : 80);
  }

  function next() { if (state.index < state.steps.length - 1) { state.index += 1; draw(); } else complete(); }
  function previous() { if (state.index > 0) { state.index -= 1; draw(); } }

  function start({ force = false } = {}) {
    if (state.overlay || (!force && isCompleted()) || (!force && !isAuthenticated())) return false;
    state.steps = isMobile() ? mobileSteps : desktopSteps;
    state.index = 0;
    state.previousFocus = document.activeElement;
    document.querySelector('.app')?.setAttribute('inert', '');
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
