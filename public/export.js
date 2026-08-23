(() => {
  const screen = () => document.querySelector('#exportScreen');
  const state = { format: 'pdf', period: 'month', cloud: null, message: '' };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const safeCell = (value) => { const text = String(value ?? ''); return /^[=+\-@]/.test(text) ? `\t${text}` : text; };
  const download = (contents, name, type) => { const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([contents], { type })); link.download = name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 500); };
  const apiBase = () => location.port === '5500' ? 'http://localhost:3000/api/v1' : '/api/v1';
  const token = () => localStorage.getItem('pagueon.token');
  const authHeaders = () => ({ Authorization: `Bearer ${token()}` });
  const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const date = (value) => value ? new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '';
  const stamp = () => new Date().toISOString().slice(0, 10);
  const source = () => window.pagueOnExportData?.snapshot();

  function periodRange() {
    const now = new Date(); const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)); const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    if (state.period === 'last-month') { start.setUTCMonth(start.getUTCMonth() - 1); end.setUTCMonth(end.getUTCMonth() - 1); }
    if (state.period === 'year') { start.setUTCMonth(0, 1); end.setUTCMonth(11, 31); }
    if (state.period === 'all') return null;
    return { start, end };
  }
  function filteredDebts() {
    const data = source()?.data?.debts || []; const range = periodRange();
    return range ? data.filter((item) => { const due = new Date(item.due); return due >= range.start && due <= range.end; }) : data;
  }
  function csv() {
    const header = ['Tipo', 'Descrição', 'Pessoa/Empresa', 'Valor Total', 'Valor Parcela', 'Data Vencimento', 'Status', 'Categoria', 'Tipo Pagamento'];
    const rows = filteredDebts().map((debt) => [debt.type === 'RECEIVABLE' ? 'RECEBER' : 'PAGAR', debt.description, debt.counterparty, Number(debt.amount ?? debt.total ?? 0).toFixed(2), debt.installmentAmount ? Number(debt.installmentAmount).toFixed(2) : '', new Date(debt.due).toISOString().slice(0, 10), debt.status, debt.category, debt.paymentType]);
    const line = (values) => values.map((value) => `"${safeCell(value).replaceAll('"', '""')}"`).join(';');
    return `\uFEFF${line(header)}\n${rows.map(line).join('\n')}`;
  }
  function preview() {
    const rows = filteredDebts().slice(0, 5);
    return `<div class="export-preview"><table><thead><tr><th>Tipo</th><th>Descrição</th><th>Valor</th><th>Venc.</th></tr></thead><tbody>${rows.length ? rows.map((debt) => `<tr><td>${debt.type === 'RECEIVABLE' ? 'Receber' : 'Pagar'}</td><td>${escapeHtml(debt.description)}</td><td>${money(debt.amount ?? debt.total)}</td><td>${date(debt.due)}</td></tr>`).join('') : '<tr><td colspan="4">Nenhum lançamento nesse período.</td></tr>'}</tbody></table></div><p class="eyebrow" style="margin:8px 2px 0">Prévia de até 5 linhas. O arquivo incluirá todos os lançamentos do período.</p>`;
  }
  function reportHtml() {
    const debts = filteredDebts(); const receivable = debts.filter((item) => item.type === 'RECEIVABLE').reduce((sum, item) => sum + Number(item.amount ?? item.total ?? 0), 0); const payable = debts.filter((item) => item.type === 'PAYABLE').reduce((sum, item) => sum + Number(item.amount ?? item.total ?? 0), 0);
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Pague-On — Relatório</title><style>body{font-family:Arial,sans-serif;color:#18201b;padding:34px}h1{color:#078946;margin:0}small{color:#667}section{display:flex;gap:12px;margin:26px 0}.card{flex:1;border:1px solid #d7e3d9;border-radius:10px;padding:14px}.card b{display:block;margin-top:7px;font-size:21px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:9px;text-align:left;font-size:12px}th{color:#667;text-transform:uppercase;font-size:10px}@media print{body{padding:0}}</style></head><body><h1>Pague-On</h1><small>Relatório financeiro · gerado em ${new Date().toLocaleDateString('pt-BR')}</small><section><div class="card">Saldo projetado<b>${money(receivable - payable)}</b></div><div class="card">A receber<b>${money(receivable)}</b></div><div class="card">A pagar<b>${money(payable)}</b></div></section><h2>Contas e dívidas</h2><table><thead><tr><th>Tipo</th><th>Descrição</th><th>Pessoa/Empresa</th><th>Valor</th><th>Vencimento</th><th>Status</th></tr></thead><tbody>${debts.map((item) => `<tr><td>${item.type === 'RECEIVABLE' ? 'A receber' : 'A pagar'}</td><td>${escapeHtml(item.description)}</td><td>${escapeHtml(item.counterparty)}</td><td>${money(item.amount ?? item.total)}</td><td>${date(item.due)}</td><td>${item.status}</td></tr>`).join('') || '<tr><td colspan="6">Nenhum lançamento.</td></tr>'}</tbody></table></body></html>`;
  }
  function queryRange() { const range = periodRange(); return range ? `&startDate=${range.start.toISOString().slice(0, 10)}&endDate=${range.end.toISOString().slice(0, 10)}` : ''; }
  async function downloadFromApi(path, fallback) {
    if (!token()) return fallback();
    const response = await fetch(`${apiBase()}${path}`, { headers: authHeaders() });
    if (!response.ok) throw new Error('Não foi possível preparar o arquivo na conta.');
    const disposition = response.headers.get('content-disposition') || ''; const found = disposition.match(/filename="?([^";]+)"?/i); download(await response.blob(), found?.[1] || `pagueon-${stamp()}`, response.headers.get('content-type') || 'application/octet-stream');
  }
  function localBackup() { const data = source(); if (!data) throw new Error('Os dados locais ainda não estão disponíveis.'); const contents = JSON.stringify(data, null, 2); download(contents, `pagueon-backup-${stamp()}.json`, 'application/json'); localStorage.setItem('pagueon.last-local-backup', JSON.stringify({ at: new Date().toISOString(), bytes: new Blob([contents]).size })); }
  function printFallback() { const popup = window.open('', '_blank'); if (!popup) throw new Error('Permita a abertura da janela de impressão para salvar o PDF.'); popup.document.write(reportHtml()); popup.document.close(); popup.focus(); setTimeout(() => popup.print(), 250); }
  async function exportSelected() {
    try {
      if (state.format === 'csv') await downloadFromApi(`/reports/export?format=csv&type=debts${queryRange()}`, () => download(csv(), `pagueon-dividas-${stamp()}.csv`, 'text/csv;charset=utf-8'));
      if (state.format === 'pdf') await downloadFromApi(`/reports/export?format=pdf&type=report${queryRange()}`, printFallback);
      if (state.format === 'backup') localBackup();
      state.message = 'Arquivo preparado com sucesso.'; render();
    } catch (error) { state.message = error.message || 'Não foi possível exportar agora.'; render(); }
  }
  async function cloudBackup() {
    try {
      if (!token()) { localBackup(); state.message = 'Backup local baixado. Entre na conta sincronizada para guardar uma cópia na nuvem.'; return render(); }
      const response = await fetch(`${apiBase()}/backup/cloud`, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' } }); const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Não foi possível criar o backup na nuvem.'); state.cloud = { latest: body.data }; state.message = 'Backup na nuvem concluído.'; render();
    } catch (error) { state.message = error.message || 'Não foi possível criar o backup.'; render(); }
  }
  async function loadCloud() {
    if (!token()) return;
    try { const response = await fetch(`${apiBase()}/backup/cloud/status`, { headers: authHeaders() }); const body = await response.json(); if (response.ok) { state.cloud = body.data; render(); } } catch (_error) { /* Status local permanece disponível. */ }
  }
  async function restoreCloud() {
    const item = state.cloud?.latest; if (!item || !confirm('Restaurar o backup da nuvem? Os dados atuais serão substituídos na conta.')) return;
    try { const response = await fetch(`${apiBase()}/backup/cloud/${item.id}/restore`, { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'REPLACE' }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Não foi possível restaurar.'); state.message = 'Backup da nuvem restaurado. Atualize os dados para ver a versão recuperada.'; render(); } catch (error) { state.message = error.message || 'Não foi possível restaurar.'; render(); }
  }
  function chooseFile() { screen().querySelector('[data-backup-file]').click(); }
  function restoreFile(file) {
    const reader = new FileReader(); reader.onload = () => { try { const backup = JSON.parse(reader.result); if (!confirm('Restaurar este backup neste dispositivo? Os dados locais atuais serão substituídos.')) return; window.pagueOnExportData.restore(backup); state.message = 'Backup local restaurado com sucesso.'; render(); } catch (error) { state.message = error.message || 'Arquivo de backup inválido.'; render(); } }; reader.readAsText(file);
  }
  function cloudText() { const local = JSON.parse(localStorage.getItem('pagueon.last-local-backup') || 'null'); const latest = state.cloud?.latest; if (latest) return `<strong>Último backup na nuvem:</strong> ${date(latest.exportedAt)} · ${Math.max(1, Math.round(latest.sizeBytes / 1024))} KB`; if (local) return `<strong>Último backup local:</strong> ${date(local.at)} · ${Math.max(1, Math.round(local.bytes / 1024))} KB`; return 'Nenhum backup feito ainda. Baixe um arquivo ou conecte sua conta para guardar uma cópia na nuvem.'; }
  function render() {
    const formats = [{ key: 'pdf', icon: '📊', title: 'PDF — Relatório', copy: 'Relatório completo com resumo, gráfico e tabelas. Ideal para impressão.' }, { key: 'csv', icon: '📄', title: 'CSV — Excel', copy: 'Planilha de lançamentos para abrir no Excel ou Google Sheets.' }, { key: 'backup', icon: '💾', title: 'Backup completo', copy: 'Arquivo JSON com todos os dados deste dispositivo.' }];
    screen().innerHTML = `<header class="export-head"><button class="back" data-export-close>← Voltar</button><h2>📤 Exportar dados</h2><span></span></header><section class="export-group"><h3>PERÍODO</h3><select class="export-select" data-export-period><option value="month" ${state.period === 'month' ? 'selected' : ''}>Este mês</option><option value="last-month" ${state.period === 'last-month' ? 'selected' : ''}>Mês passado</option><option value="year" ${state.period === 'year' ? 'selected' : ''}>Este ano</option><option value="all" ${state.period === 'all' ? 'selected' : ''}>Todo o período</option></select></section><section class="export-group"><h3>FORMATO</h3><div class="export-options">${formats.map((format) => `<button class="export-option ${state.format === format.key ? 'active' : ''}" data-export-format="${format.key}"><i>${format.icon}</i><span><strong>${format.title}</strong><small>${format.copy}</small></span></button>`).join('')}</div>${state.format === 'csv' ? `<div style="margin-top:12px">${preview()}</div>` : ''}<button class="export-primary" data-export-download>📥 Baixar arquivo</button></section><section class="export-group"><h3>💾 BACKUP NA NUVEM</h3><div class="export-status">${cloudText()}</div><button class="export-secondary" data-cloud-backup>🔄 Fazer backup agora</button>${state.cloud?.latest ? '<button class="export-secondary" data-cloud-restore>☁️ Restaurar último backup da nuvem</button>' : ''}<button class="export-secondary" data-restore-file>📥 Restaurar de arquivo</button><input class="file-picker" type="file" accept="application/json,.json" data-backup-file>${state.message ? `<p class="eyebrow" style="margin:11px 2px 0">${escapeHtml(state.message)}</p>` : ''}</section>`;
    screen().classList.add('show');
    screen().querySelector('[data-export-close]').onclick = close;
    screen().querySelector('[data-export-period]').onchange = (event) => { state.period = event.target.value; render(); };
    screen().querySelectorAll('[data-export-format]').forEach((button) => button.onclick = () => { state.format = button.dataset.exportFormat; render(); });
    screen().querySelector('[data-export-download]').onclick = exportSelected;
    screen().querySelector('[data-cloud-backup]').onclick = cloudBackup;
    screen().querySelector('[data-cloud-restore]')?.addEventListener('click', restoreCloud);
    screen().querySelector('[data-restore-file]').onclick = chooseFile;
    screen().querySelector('[data-backup-file]').onchange = (event) => event.target.files?.[0] && restoreFile(event.target.files[0]);
  }
  function close() { screen().classList.remove('show'); }
  function open() { state.message = ''; render(); loadCloud(); }
  document.addEventListener('click', (event) => { const button = event.target.closest('[data-profile-action]'); if (!button || !['pdf', 'export', 'backup'].includes(button.dataset.profileAction)) return; event.preventDefault(); event.stopImmediatePropagation(); state.format = button.dataset.profileAction === 'pdf' ? 'pdf' : button.dataset.profileAction === 'export' ? 'csv' : 'backup'; open(); }, true);
})();
