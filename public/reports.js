(() => {
  const root = () => document.querySelector('#reportsView');
  const money = (value) => window.pagueOnCurrency?.formatBrl?.(value) || new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const date = (value) => value ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(value)) : '—';
  const escape = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const labels = { INSTALLMENT: 'Parcelado', SIMPLE_INTEREST: 'Juros simples', PRICE: 'Tabela Price', RENEWAL: 'Renovação', PENDING: 'Pendente', PARTIAL: 'Parcial', PAID: 'Quitado', OVERDUE: 'Atrasado', CANCELLED: 'Cancelado', LOAN: 'Empréstimo', PRODUCT: 'Produto', SERVICE: 'Serviço' };
  const state = { catalog: null, reportKey: 'loans-active', filters: { period: 'MONTH' }, model: null, loading: false, error: null, request: 0 };

  const option = (value, label, selected) => `<option value="${escape(value)}"${String(value) === String(selected || '') ? ' selected' : ''}>${escape(label)}</option>`;
  const display = (value) => labels[value] || value || '—';
  const value = (item, type) => type === 'currency' ? money(item) : type === 'date' ? date(item) : type === 'percentage' ? `${Number(item || 0).toFixed(2)}%` : escape(display(item));
  const query = () => {
    const params = new URLSearchParams();
    Object.entries(state.filters).forEach(([key, item]) => { if (item !== undefined && item !== null && item !== '') params.set(key, item); });
    return params.toString();
  };

  function filterOptions(items, current, emptyLabel, labelFor = (item) => item.name || item) {
    return [option('', emptyLabel, current), ...(items || []).map((item) => option(item.id || item, labelFor(item), current))].join('');
  }

  function formMarkup() {
    const catalog = state.catalog || { reports: [], customers: [], collectors: [], accounts: [], categories: [], paymentMethods: [], modalities: [], statuses: [] };
    const custom = state.filters.period === 'CUSTOM';
    return `<aside class="report-filters" aria-label="Filtros do relatório"><h2>Filtros</h2><div class="report-field"><label for="report-key">Relatório</label><select id="report-key">${catalog.reports.map((item) => option(item.key, item.title, state.reportKey)).join('')}</select></div><div class="report-field"><label for="report-period">Período</label><select id="report-period">${option('TODAY', 'Hoje', state.filters.period)}${option('NEXT_7', 'Próximos 7 dias', state.filters.period)}${option('NEXT_8', 'Próximos 8 dias', state.filters.period)}${option('NEXT_15', 'Próximos 15 dias', state.filters.period)}${option('NEXT_30', 'Próximos 30 dias', state.filters.period)}${option('WEEK', 'Esta semana', state.filters.period)}${option('MONTH', 'Este mês', state.filters.period)}${option('ALL', 'Todo o período', state.filters.period)}${option('CUSTOM', 'Período personalizado', state.filters.period)}</select></div><div class="report-custom-dates"${custom ? '' : ' hidden'}><div class="report-field"><label for="report-start">Data inicial</label><input id="report-start" type="date" value="${escape(state.filters.startDate || '')}"></div><div class="report-field"><label for="report-end">Data final</label><input id="report-end" type="date" value="${escape(state.filters.endDate || '')}"></div></div><div class="report-field"><label for="report-customer">Cliente</label><select id="report-customer">${filterOptions(catalog.customers, state.filters.customerId, 'Todos os clientes', (item) => item.nickname ? `${item.name} (${item.nickname})` : item.name)}</select></div><div class="report-field"><label for="report-collector">Cobrador</label><select id="report-collector">${filterOptions(catalog.collectors, state.filters.collectorId, 'Todos os cobradores')}</select></div><div class="report-field"><label for="report-account">Caixa</label><select id="report-account">${filterOptions(catalog.accounts, state.filters.accountId, 'Todos os caixas')}</select></div><div class="report-field"><label for="report-modality">Modalidade</label><select id="report-modality">${filterOptions(catalog.modalities, state.filters.modality, 'Todas as modalidades', display)}</select></div><div class="report-field"><label for="report-status">Situação</label><select id="report-status">${filterOptions(catalog.statuses, state.filters.status, 'Todas as situações', display)}</select></div><div class="report-field"><label for="report-category">Categoria</label><select id="report-category">${filterOptions(catalog.categories, state.filters.category, 'Todas as categorias', display)}</select></div><div class="report-field"><label for="report-payment-method">Forma de pagamento</label><select id="report-payment-method">${filterOptions(catalog.paymentMethods, state.filters.paymentMethod, 'Todas as formas')}</select></div><div class="report-filter-actions"><button class="report-apply" type="button" data-report-apply>Aplicar filtros</button><button class="report-reset" type="button" data-report-reset>Limpar filtros</button></div></aside>`;
  }

  function resultMarkup() {
    if (state.loading) return '<section class="report-results"><div class="report-loading">Preparando o relatório…</div></section>';
    if (state.error) return `<section class="report-results"><div class="report-error">${escape(state.error)}<br><button type="button" data-report-retry>Tentar novamente</button></div></section>`;
    const report = state.model;
    if (!report) return '<section class="report-results"><div class="report-loading">Escolha um relatório para começar.</div></section>';
    const cards = report.kpis.map((item) => `<article class="report-kpi" data-type="${item.type}"><span>${escape(item.label)}</span><b>${value(item.value, item.type)}</b></article>`).join('');
    const header = report.columns.map((column) => `<th scope="col">${escape(column.label)}</th>`).join('');
    const rows = report.rows.map((row) => `<tr>${report.columns.map((column) => `<td>${value(row[column.key], column.type)}</td>`).join('')}</tr>`).join('') || `<tr><td class="report-empty" colspan="${report.columns.length}">Nenhum registro encontrado para os filtros selecionados.</td></tr>`;
    return `<section class="report-results"><div class="report-results-top"><div><h2>${escape(report.report.title)}</h2><p>${escape(report.report.description)}</p></div><div class="report-export"><button type="button" data-report-export="xlsx">Exportar Excel</button><button type="button" data-report-export="pdf">Exportar PDF</button></div></div><div class="report-kpis">${cards}</div>${report.note ? `<p class="report-note">${escape(report.note)}</p>` : ''}<div class="report-table-wrap"><table class="report-table"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div><p class="report-status">Emissão: ${date(report.generatedAt)} · ${escape(report.filters.periodLabel || '')}</p></section>`;
  }

  function bind() {
    const element = root(); if (!element) return;
    element.querySelector('[data-report-apply]')?.addEventListener('click', () => {
      const read = (id) => element.querySelector(id)?.value || '';
      state.reportKey = read('#report-key') || state.reportKey;
      state.filters = { period: read('#report-period') || 'MONTH', customerId: read('#report-customer'), collectorId: read('#report-collector'), accountId: read('#report-account'), modality: read('#report-modality'), status: read('#report-status'), category: read('#report-category'), paymentMethod: read('#report-payment-method'), startDate: read('#report-start'), endDate: read('#report-end') };
      if (state.filters.period !== 'CUSTOM') { delete state.filters.startDate; delete state.filters.endDate; }
      load();
    });
    element.querySelector('#report-period')?.addEventListener('change', (event) => { state.filters.period = event.target.value; render(); });
    element.querySelector('[data-report-reset]')?.addEventListener('click', () => { state.filters = { period: 'MONTH' }; load(); });
    element.querySelector('[data-report-retry]')?.addEventListener('click', load);
    element.querySelectorAll('[data-report-export]').forEach((button) => button.addEventListener('click', () => download(button.dataset.reportExport)));
  }

  function render() {
    const element = root(); if (!element) return;
    element.innerHTML = `<header class="reports-head"><div><p class="eyebrow">Controle e acompanhamento</p><h1>Relatórios</h1><p>Veja um resumo rápido, confira os detalhes e exporte exatamente o que está filtrado.</p></div></header><div class="reports-layout">${formMarkup()}${resultMarkup()}</div>`;
    bind();
  }

  async function loadCatalog() {
    if (state.catalog || !window.pagueOnApi?.authenticated?.()) return;
    state.catalog = await window.pagueOnApi.get('/reports/catalog');
  }

  async function load() {
    const request = ++state.request;
    state.loading = true; state.error = null; render();
    try {
      await loadCatalog();
      const data = await window.pagueOnApi.get(`/reports/${encodeURIComponent(state.reportKey)}?${query()}`);
      if (request !== state.request) return;
      state.model = data;
    } catch (error) {
      if (request !== state.request) return;
      state.error = error?.message || 'Não foi possível carregar este relatório.';
    } finally {
      if (request === state.request) { state.loading = false; render(); }
    }
  }

  function download(format) {
    const url = `${window.pagueOnApi.base()}/reports/${encodeURIComponent(state.reportKey)}/export?${query()}&format=${encodeURIComponent(format)}`;
    window.location.assign(url);
  }

  function open() {
    window.pagueOnAppActions?.navigate?.('reports');
  }

  function addProfileLink() {
    const profile = document.querySelector('#profileView.show');
    if (!profile || profile.querySelector('[data-open-reports]')) return;
    const section = document.createElement('section');
    section.className = 'profile-section';
    section.dataset.reportLink = 'true';
    section.innerHTML = '<h2>RELATÓRIOS</h2><button class="report-profile-link" type="button" data-open-reports><span>Relatórios financeiros</span><span aria-hidden="true">→</span></button>';
    profile.querySelector('.signout')?.before(section);
    section.querySelector('[data-open-reports]').onclick = open;
  }

  window.pagueOnReports = { render, load, open };
  document.addEventListener('pagueon:reports-request', () => { if (!state.model && !state.loading) load(); else render(); });
  new MutationObserver(addProfileLink).observe(document.querySelector('.app'), { childList: true, subtree: true });
})();
