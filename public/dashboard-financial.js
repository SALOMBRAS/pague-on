(() => {
  const api = () => location.port === '5500' ? 'http://localhost:3000/api/v1' : '/api/v1';
  const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  let lastKey = '';

  function card(label, value, report) {
    return `<button class="financial-card" type="button" data-financial-report="${report}" aria-label="${label}: ${money(value)}. Abrir relatório detalhado"><span>${label}</span><b>${money(value)}</b><small>Ver relatório</small></button>`;
  }

  function selected(value, expected) { return value === expected ? ' selected' : ''; }

  function queryFrom(form) {
    const data = new FormData(form);
    const params = new URLSearchParams();
    const period = data.get('period') || 'MONTH';
    params.set('period', period);
    ['cashAccountId', 'collectorId', 'status'].forEach((name) => { if (data.get(name)) params.set(name, data.get(name)); });
    if (period === 'CUSTOM') ['startDate', 'endDate'].forEach((name) => { if (data.get(name)) params.set(name, data.get(name)); });
    return params.toString();
  }

  function openReport(report) {
    document.querySelector('[data-nav="caixa"]')?.click();
    document.dispatchEvent(new CustomEvent('pagueon:financial-report', { detail: { report } }));
  }

  async function render() {
    const host = document.getElementById('homeView');
    if (!host || !window.pagueOnAuth?.getToken?.()) return;
    const existing = host.querySelector('#financial-dashboard');
    const params = new URLSearchParams(existing?.dataset.query || 'period=MONTH');
    const key = params.toString();
    if (key === lastKey && existing) return;
    lastKey = key;
    const response = await window.fetch(`${api()}/dashboard/financial?${params}`);
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) return;

    const data = result.data;
    const period = data.filters.period || 'MONTH';
    const collectors = data.filters.collectors || [];
    const section = document.createElement('section');
    section.id = 'financial-dashboard';
    section.dataset.query = key;
    section.innerHTML = `
      <style>
        #financial-dashboard{margin:0 0 24px}.financial-title{margin:0 0 12px;font-size:18px}
        .financial-filters{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px;align-items:end}.financial-filters fieldset{display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0;border:0}.financial-filters label{display:grid;gap:4px;color:var(--muted);font-size:12px}
        .financial-filters button,.financial-filters select,.financial-filters input{min-height:44px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--text);padding:0 12px}.financial-filters button,.financial-card{cursor:pointer}.financial-filters button:hover,.financial-card:hover{border-color:var(--green)}.financial-filters button:focus-visible,.financial-filters select:focus-visible,.financial-filters input:focus-visible,.financial-card:focus-visible{outline:3px solid color-mix(in srgb,var(--green) 45%,transparent);outline-offset:2px}.financial-filters button[aria-pressed=true]{border-color:var(--green);color:var(--green);font-weight:700}.financial-custom[hidden]{display:none}
        .financial-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.financial-card{min-height:112px;border:1px solid var(--line);border-radius:14px;padding:14px;background:var(--surface);color:var(--text);text-align:left}.financial-card span,.financial-card small{display:block;color:var(--muted);font-size:12px}.financial-card b{display:block;margin:9px 0 6px;font-size:18px;line-height:1.15}.financial-card small{color:var(--green)}
        @media(min-width:760px){.financial-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:374px){.financial-grid{grid-template-columns:1fr}}@media(prefers-reduced-motion:no-preference){.financial-card{transition:border-color 140ms ease,box-shadow 140ms ease}.financial-card:hover{box-shadow:0 5px 14px color-mix(in srgb,var(--text) 9%,transparent)}}
      </style>
      <h2 class="financial-title">Resumo financeiro</h2>
      <form class="financial-filters" aria-label="Filtros financeiros">
        <fieldset aria-label="Período"><button type="button" data-period="TODAY" aria-pressed="${period === 'TODAY'}">Hoje</button><button type="button" data-period="WEEK" aria-pressed="${period === 'WEEK'}">Semana</button><button type="button" data-period="MONTH" aria-pressed="${period === 'MONTH'}">Mês</button><button type="button" data-period="CUSTOM" aria-pressed="${period === 'CUSTOM'}">Período</button></fieldset>
        <input type="hidden" name="period" value="${escapeHtml(period)}">
        <span class="financial-custom" ${period === 'CUSTOM' ? '' : 'hidden'}><label>Início<input name="startDate" type="date" value="${period === 'CUSTOM' ? escapeHtml(String(data.filters.startDate).slice(0, 10)) : ''}" required></label><label>Fim<input name="endDate" type="date" value="${period === 'CUSTOM' ? escapeHtml(String(data.filters.endDate).slice(0, 10)) : ''}" required></label></span>
        <label>Caixa<select name="cashAccountId"><option value="">Todos os caixas</option>${data.accounts.map((account) => `<option value="${account.id}"${selected(params.get('cashAccountId'), account.id)}>${escapeHtml(account.name)}</option>`).join('')}</select></label>
        <label>Cobrador<select name="collectorId"><option value="">Todos os cobradores</option>${collectors.map((collector) => `<option value="${collector.id}"${selected(params.get('collectorId'), collector.id)}>${escapeHtml(collector.name)}</option>`).join('')}</select></label>
        <label>Situação<select name="status"><option value="">Todas as situações</option>${[['PENDING','Pendente'],['PARTIAL','Parcial'],['OVERDUE','Vencido'],['PAID','Pago'],['CANCELLED','Cancelado']].map(([value,label]) => `<option value="${value}"${selected(params.get('status'), value)}>${label}</option>`).join('')}</select></label>
      </form>
      <div class="financial-grid">
        ${card('Disponível em caixa', data.metrics.availableCash, 'cashflow')}${card('Capital em circulação', data.metrics.capitalInCirculation, 'loans')}${card('Total a receber', data.metrics.totalReceivable, 'receivables')}${card('Recebido hoje', data.metrics.receivedToday, 'cashflow')}${card('A receber hoje', data.metrics.dueToday, 'receivables')}${card('Recebido nesta semana', data.metrics.receivedWeek, 'cashflow')}${card('A receber nesta semana', data.metrics.dueWeek, 'receivables')}${card('Recebido neste mês', data.metrics.receivedMonth, 'cashflow')}${card('A receber neste mês', data.metrics.dueMonth, 'receivables')}${card('Total vencido', data.metrics.overdueTotal, 'overdue')}${card('Clientes ativos', data.metrics.activeCustomers, 'customers')}${card('Empréstimos ativos', data.metrics.activeLoans, 'loans')}
      </div>`;
    existing?.replaceWith(section);
    if (!existing) host.prepend(section);
    const form = section.querySelector('form');
    const apply = () => { section.dataset.query = queryFrom(form); lastKey = ''; render(); };
    section.querySelectorAll('[data-period]').forEach((button) => { button.onclick = () => { form.elements.period.value = button.dataset.period; section.querySelector('.financial-custom').hidden = button.dataset.period !== 'CUSTOM'; if (button.dataset.period !== 'CUSTOM' || (form.elements.startDate.value && form.elements.endDate.value)) apply(); }; });
    form.querySelectorAll('select,input[type=date]').forEach((control) => { control.onchange = () => { if (form.elements.period.value !== 'CUSTOM' || (form.elements.startDate.value && form.elements.endDate.value)) apply(); }; });
    section.querySelectorAll('[data-financial-report]').forEach((button) => { button.onclick = () => openReport(button.dataset.financialReport); });
    document.dispatchEvent(new CustomEvent('pagueon:financial-dashboard', { detail: { section, data } }));
  }

  window.addEventListener('pagueon:auth', () => setTimeout(render, 0));
  new MutationObserver(() => { if (document.getElementById('homeView')?.classList.contains('show')) render(); }).observe(document.body, { childList: true, subtree: true });
})();
