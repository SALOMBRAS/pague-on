(() => {
  const STORAGE_KEY = 'pagueon_onboarding_done';
  const steps = [
    { target: '.dash-hero', action: 'home', title: '💰 Seu saldo projetado', description: 'Aqui você acompanha o que tem a receber, o que precisa pagar e o saldo previsto.' },
    { target: '#centerAdd', action: 'home', title: '➕ Adicionar em segundos', description: 'Use este botão para cadastrar contas, produtos, compras, lembretes ou escanear um boleto.' },
    { target: '.nav[data-nav="caixa"]', action: 'caixa', title: '💳 Controle de contas', description: 'No Caixa, acompanhe vencimentos, parcelas, recorrências e registre pagamentos.' },
    { target: '.nav[data-nav="stock"]', action: 'estoque', title: '📦 Estoque e margem', description: 'Cadastre produtos, registre compras e acompanhe a margem de lucro automaticamente.' },
    { target: '#formView.show', action: 'lembrete', title: '🔔 Lembretes que ajudam', description: 'Crie alertas para não esquecer vencimentos e manter suas cobranças organizadas.' },
  ];
  let current = 0; let overlay; let keyHandler;
  const action = (name) => window.pagueOnOnboardingActions?.[name]?.();
  const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

  function remove() { overlay?.remove(); overlay = null; document.removeEventListener('keydown', keyHandler); }
  function position(target, tooltip) {
    const rect = target.getBoundingClientRect(); const padding = 12; const tooltipWidth = Math.min(286, window.innerWidth - 32); const height = tooltip.offsetHeight || 175;
    let top = rect.bottom + padding; if (top + height > window.innerHeight - 16) top = Math.max(16, rect.top - height - padding);
    const left = clamp(rect.left + rect.width / 2 - tooltipWidth / 2, 16, window.innerWidth - tooltipWidth - 16);
    return { rect, top, left, tooltipWidth };
  }
  function render() {
    const step = steps[current]; action(step.action);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const target = document.querySelector(step.target); if (!target) return next();
      remove(); overlay = document.createElement('section'); overlay.className = 'onboarding-overlay'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', `Tour do Pague-On, etapa ${current + 1}`);
      overlay.innerHTML = `<div class="onboarding-spotlight"></div><article class="onboarding-tooltip"><div class="onboarding-count">${current + 1} DE ${steps.length}</div><h2>${step.title}</h2><p>${step.description}</p><div class="onboarding-actions">${current ? '<button class="onboarding-prev" data-onboarding-prev>Anterior</button>' : ''}<button class="onboarding-next" data-onboarding-next>${current === steps.length - 1 ? 'Concluir' : 'Próximo'}</button><button class="onboarding-skip" data-onboarding-skip>Pular tour</button></div></article>`;
      document.body.append(overlay); const tooltip = overlay.querySelector('.onboarding-tooltip'); const layout = position(target, tooltip); const spotlight = overlay.querySelector('.onboarding-spotlight'); Object.assign(spotlight.style, { top: `${Math.max(4, layout.rect.top - 7)}px`, left: `${Math.max(4, layout.rect.left - 7)}px`, width: `${layout.rect.width + 14}px`, height: `${layout.rect.height + 14}px` }); Object.assign(tooltip.style, { top: `${layout.top}px`, left: `${layout.left}px`, width: `${layout.tooltipWidth}px` });
      overlay.querySelector('[data-onboarding-next]').onclick = next; overlay.querySelector('[data-onboarding-prev]')?.addEventListener('click', previous); overlay.querySelector('[data-onboarding-skip]').onclick = complete; keyHandler = (event) => { if (event.key === 'Escape') complete(); if (event.key === 'ArrowRight') next(); if (event.key === 'ArrowLeft' && current) previous(); }; document.addEventListener('keydown', keyHandler); overlay.querySelector('[data-onboarding-next]').focus();
    }));
  }
  function next() { if (current < steps.length - 1) { current += 1; render(); } else complete(); }
  function previous() { if (current > 0) { current -= 1; render(); } }
  function complete() { remove(); localStorage.setItem(STORAGE_KEY, 'true'); action('finish'); }
  function start(force = false) { if (!force && localStorage.getItem(STORAGE_KEY) === 'true') return; current = 0; render(); }
  function reset() { localStorage.removeItem(STORAGE_KEY); start(true); }
  function addProfileControl() { const profile = document.querySelector('#profileView.show'); if (!profile || profile.querySelector('[data-onboarding-reset]')) return; const section = document.createElement('section'); section.className = 'profile-section'; section.dataset.onboardingReset = 'true'; section.innerHTML = `<h2>✨ AJUDA</h2><div class="settings-card"><button class="setting" data-onboarding-reset><label>Ver tour novamente</label><span>Como usar o Pague-On <i class="chev">›</i></span></button></div>`; profile.querySelector('.signout')?.before(section); section.querySelector('[data-onboarding-reset]').onclick = reset; }
  function boot() { const app = document.querySelector('.app'); new MutationObserver(addProfileControl).observe(app, { childList: true, subtree: true }); addProfileControl(); setTimeout(() => start(), 450); }
  window.pagueOnOnboarding = { start, reset, complete, get currentStep() { return current; } };
  boot();
})();
