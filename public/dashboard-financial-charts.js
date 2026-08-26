(() => {
  const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const date = (value) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(value));
  const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const percent = (value, total) => total > 0 ? Math.round((Number(value || 0) / total) * 100) : 0;

  function comparisonRow(label, value, total, tone) {
    return `<div class="financial-comparison-row"><div><span>${label}</span><b>${money(value)}</b></div><div class="financial-progress" role="progressbar" aria-label="${label}: ${money(value)}" aria-valuemin="0" aria-valuemax="${Math.max(1, total)}" aria-valuenow="${Math.max(0, value)}"><i class="${tone}" style="width:${percent(value, total)}%"></i></div></div>`;
  }

  function render({ section, data }) {
    const charts = data.charts || {};
    const existing = section.querySelector('.financial-visuals');
    existing?.remove();
    const receipts = (charts.receipts || []).slice(-7);
    const lent = (charts.lent || []).reduce((total, item) => total + Number(item.value || 0), 0);
    const overdue = (charts.overdue || []).reduce((total, item) => total + Number(item.value || 0), 0);
    const forecast = Number(charts.forecastVsReceived?.expected || 0);
    const received = Number(charts.forecastVsReceived?.received || 0);
    const composition = charts.composition || {};
    const compositionTotal = Number(composition.principal || 0) + Number(composition.interest || 0) + Number(composition.penalties || 0);
    const chart = document.createElement('section');
    chart.className = 'financial-visuals';
    chart.setAttribute('aria-label', 'Gráficos financeiros');
    chart.innerHTML = `
      <style>
        .financial-visuals{display:grid;gap:12px;margin-top:16px}.financial-chart{border:1px solid var(--line);border-radius:14px;background:var(--surface);padding:16px}.financial-chart h3{font-size:15px;margin:0}.financial-chart p{color:var(--muted);font-size:12px;margin:4px 0 14px}.financial-receipt-bars{display:grid;grid-template-columns:repeat(${Math.max(receipts.length, 1)},minmax(28px,1fr));align-items:end;gap:8px;min-height:138px}.financial-receipt-item{display:grid;gap:6px;text-align:center;font-size:11px;color:var(--muted)}.financial-receipt-item i{display:block;min-height:3px;border-radius:6px 6px 2px 2px;background:var(--green)}.financial-receipt-item b{color:var(--text);font-size:11px;overflow-wrap:anywhere}.financial-comparison-row{display:grid;gap:6px;margin:12px 0}.financial-comparison-row>div:first-child{display:flex;justify-content:space-between;gap:12px;font-size:13px}.financial-comparison-row b{font-variant-numeric:tabular-nums}.financial-progress{height:12px;border-radius:999px;background:var(--line);overflow:hidden}.financial-progress i{display:block;height:100%;border-radius:inherit}.financial-progress .planned{background:var(--muted)}.financial-progress .received{background:var(--green)}.financial-progress .principal{background:var(--green)}.financial-progress .interest{background:var(--yellow,#c79000)}.financial-progress .penalties{background:var(--red,#b42318)}.financial-chart-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.financial-chart-summary div{border-left:3px solid var(--line);padding-left:10px}.financial-chart-summary span{display:block;color:var(--muted);font-size:12px}.financial-chart-summary b{font-size:16px;font-variant-numeric:tabular-nums}.financial-chart details{margin-top:12px;color:var(--muted);font-size:12px}.financial-chart table{width:100%;margin-top:8px;border-collapse:collapse;color:var(--text)}.financial-chart th,.financial-chart td{padding:6px;text-align:left;border-bottom:1px solid var(--line)}@media(min-width:760px){.financial-visuals{grid-template-columns:repeat(2,minmax(0,1fr))}.financial-chart:first-child{grid-column:span 2}}
      </style>
      <article class="financial-chart"><h3>Recebimentos por período</h3><p>${receipts.length ? 'Valores confirmados nos últimos dias do filtro.' : 'Ainda não há recebimentos no período selecionado.'}</p>${receipts.length ? `<div class="financial-receipt-bars" role="img" aria-label="Recebimentos por dia: ${receipts.map((item) => `${date(item.date)} ${money(item.value)}`).join(', ')}">${receipts.map((item) => `<div class="financial-receipt-item"><i style="height:${Math.max(3, percent(item.value, Math.max(...receipts.map((entry) => Number(entry.value || 0)))))}%"></i><b>${money(item.value)}</b><span>${date(item.date)}</span></div>`).join('')}</div><details><summary>Ver dados em tabela</summary><table><thead><tr><th>Data</th><th>Recebido</th></tr></thead><tbody>${receipts.map((item) => `<tr><td>${date(item.date)}</td><td>${money(item.value)}</td></tr>`).join('')}</tbody></table></details>` : ''}</article>
      <article class="financial-chart"><h3>Previsto e recebido</h3><p>Comparação de cobranças do período selecionado.</p>${comparisonRow('Previsto', forecast, Math.max(forecast, received), 'planned')}${comparisonRow('Recebido', received, Math.max(forecast, received), 'received')}</article>
      <article class="financial-chart"><h3>Composição da carteira</h3><p>Principal, juros e multas a recuperar.</p>${comparisonRow('Principal', composition.principal, compositionTotal, 'principal')}${comparisonRow('Juros', composition.interest, compositionTotal, 'interest')}${comparisonRow('Multas', composition.penalties, compositionTotal, 'penalties')}</article>
      <article class="financial-chart"><h3>Empréstimos e vencidos</h3><p>Indicadores que exigem acompanhamento.</p><div class="financial-chart-summary"><div><span>Emprestado no período</span><b>${money(lent)}</b></div><div><span>Em atraso</span><b>${money(overdue)}</b></div></div></article>`;
    section.append(chart);
  }

  document.addEventListener('pagueon:financial-dashboard', (event) => render(event.detail));
})();
