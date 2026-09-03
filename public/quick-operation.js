(() => {
  const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const dateInputValue = (value) => new Date(value).toISOString().slice(0, 10);
  const decimal = (value) => Number(String(value || '').replace(',', '.'));
  const defaultDueDate = () => { const value = new Date(); value.setDate(value.getDate() + 30); return dateInputValue(value); };
  let state = null;
  let searchTimer = null;

  function reset() {
    state = { type: 'PRODUCT', customer: null, customers: [], accounts: [], products: [], preview: null, newCustomer: false, busy: false, draft: { description: '', productId: '', downPaymentAmount: '0', totalInstallments: '10', installmentAmount: '', frequency: 'MONTHLY', firstDueDate: defaultDueDate(), cashAccountId: '', paymentMethod: 'PIX', notes: '' } };
  }

  function screen() { return document.getElementById('quick-operation-screen'); }
  function setMessage(message = '', kind = '') { const node = screen()?.querySelector('[data-quick-message]'); if (!node) return; node.textContent = message; node.dataset.kind = kind; }
  function close() { screen()?.remove(); document.removeEventListener('keydown', onKeydown); }
  function onKeydown(event) { if (event.key === 'Escape') close(); }

  function customerSection() {
    if (state.customer) return `<div class="quick-operation__selected"><span><strong>${escapeHtml(state.customer.name)}</strong><br><small>${escapeHtml(state.customer.phone || 'Sem telefone')}</small></span><button type="button" data-clear-customer>Trocar</button></div>`;
    return `<label class="quick-operation__field">Buscar cliente<input name="customerSearch" autocomplete="off" placeholder="Nome, apelido, CPF ou telefone"></label><div class="quick-operation__customer-results" data-customer-results></div><button class="quick-operation__link" type="button" data-new-customer>${state.newCustomer ? 'Cancelar novo cliente' : '+ Novo cliente'}</button>${state.newCustomer ? `<div class="quick-operation__new-customer"><div class="quick-operation__grid"><label class="quick-operation__field"><span>Nome</span><input name="newCustomerName" value="${escapeHtml(state.draft.newCustomerName || '')}" autocomplete="name" required></label><label class="quick-operation__field"><span>Telefone</span><input name="newCustomerPhone" value="${escapeHtml(state.draft.newCustomerPhone || '')}" autocomplete="tel" inputmode="tel" required></label></div></div>` : ''}`;
  }

  function productForm() {
    const accountOptions = state.accounts.filter((item) => item.isActive).map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');
    const productOptions = state.products.filter((item) => item.isActive).map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');
    return `<section class="quick-operation__section"><h3>Cliente</h3><p>Selecione quem vai pagar. Se for novo, basta nome e telefone agora.</p>${customerSection()}</section>
      <section class="quick-operation__section"><h3>O que foi vendido?</h3><div class="quick-operation__grid"><label class="quick-operation__field quick-operation__field--full"><span>Produto ou descrição</span><input name="description" value="${escapeHtml(state.draft.description)}" required placeholder="Ex.: iPhone 14"></label><label class="quick-operation__field quick-operation__field--full"><span>Produto de estoque (opcional)</span><select name="productId"><option value="">Não controlar estoque nesta operação</option>${productOptions.replace(`value="${state.draft.productId}"`, `value="${state.draft.productId}" selected`)}</select></label></div></section>
      <section class="quick-operation__section"><h3>Como vai receber?</h3><div class="quick-operation__grid"><label class="quick-operation__field"><span>Entrada</span><input name="downPaymentAmount" inputmode="decimal" value="${escapeHtml(state.draft.downPaymentAmount)}" placeholder="0,00"></label><label class="quick-operation__field"><span>Quantidade de parcelas</span><input name="totalInstallments" type="number" min="1" max="360" value="${escapeHtml(state.draft.totalInstallments)}" required></label><label class="quick-operation__field"><span>Valor de cada parcela</span><input name="installmentAmount" inputmode="decimal" value="${escapeHtml(state.draft.installmentAmount)}" placeholder="200,00" required></label><label class="quick-operation__field"><span>Periodicidade</span><select name="frequency"><option value="WEEKLY" ${state.draft.frequency === 'WEEKLY' ? 'selected' : ''}>Semanal</option><option value="BIWEEKLY" ${state.draft.frequency === 'BIWEEKLY' ? 'selected' : ''}>Quinzenal (14 dias)</option><option value="MONTHLY" ${state.draft.frequency === 'MONTHLY' ? 'selected' : ''}>Mensal</option></select></label><label class="quick-operation__field"><span>Primeiro vencimento</span><input name="firstDueDate" type="date" value="${escapeHtml(state.draft.firstDueDate)}" required></label><label class="quick-operation__field"><span>Caixa da entrada</span><select name="cashAccountId"><option value="">Selecione quando houver entrada</option>${accountOptions.replace(`value="${state.draft.cashAccountId}"`, `value="${state.draft.cashAccountId}" selected`)}</select></label><label class="quick-operation__field"><span>Forma de pagamento da entrada</span><select name="paymentMethod"><option value="PIX" ${state.draft.paymentMethod === 'PIX' ? 'selected' : ''}>PIX</option><option value="CASH" ${state.draft.paymentMethod === 'CASH' ? 'selected' : ''}>Dinheiro</option><option value="TRANSFER" ${state.draft.paymentMethod === 'TRANSFER' ? 'selected' : ''}>Transferência</option><option value="CARD" ${state.draft.paymentMethod === 'CARD' ? 'selected' : ''}>Cartão</option><option value="OTHER" ${state.draft.paymentMethod === 'OTHER' ? 'selected' : ''}>Outro</option></select></label></div><details><summary>Mais opções</summary><div><label class="quick-operation__field"><span>Observações</span><textarea name="notes" placeholder="Garantia, condição combinada ou outro detalhe">${escapeHtml(state.draft.notes)}</textarea></label></div></details></section>`;
  }

  function loanForm() {
    return `<section class="quick-operation__section"><div class="quick-operation__loan-note"><strong>Empréstimo com contrato protegido</strong>Este caminho continua usando a simulação, o limite aprovado, a modalidade juridicamente revisada e o consentimento obrigatório já existentes. Ele será incorporado à operação rápida em uma etapa própria, sem reduzir essas proteções.</div><button class="quick-operation__button quick-operation__button--primary" type="button" data-open-loan>Continuar para empréstimo</button></section>`;
  }

  function previewMarkup() {
    if (!state.preview) return `<section class="quick-operation__section"><button type="button" class="quick-operation__button" data-preview>Ver prévia</button></section>`;
    const payment = state.preview.payment;
    return `<section class="quick-operation__section"><div class="quick-operation__preview"><h3>Prévia da operação</h3><div class="quick-operation__totals"><div class="quick-operation__total"><span>Entrada</span><strong>${money(payment.downPaymentAmount)}</strong></div><div class="quick-operation__total"><span>Parcelado</span><strong>${money(payment.financedAmount)}</strong></div><div class="quick-operation__total"><span>Total da venda</span><strong>${money(payment.totalAmount)}</strong></div></div><ol class="quick-operation__schedule">${state.preview.schedule.slice(0, 4).map((item) => `<li>${item.number}ª parcela: ${money(item.amount)} em ${new Date(item.dueDate).toLocaleDateString('pt-BR')}</li>`).join('')}${state.preview.schedule.length > 4 ? `<li>e mais ${state.preview.schedule.length - 4} parcelas.</li>` : ''}</ol></div></section>`;
  }

  function render() {
    const root = screen(); if (!root) return;
    root.innerHTML = `<form class="quick-operation" data-quick-form novalidate aria-busy="${state.busy}"><header class="quick-operation__head"><div><h2 id="quick-operation-title">Nova operação</h2><p>Cliente, condições de pagamento e salvar.</p></div><button class="quick-operation__close" type="button" data-close>Fechar</button></header><div class="quick-operation__body"><p class="quick-operation__message" data-quick-message role="alert" aria-live="assertive"></p><section class="quick-operation__section"><h3>Tipo</h3><div class="quick-operation__type-row"><button class="quick-operation__type" type="button" data-type="PRODUCT" aria-pressed="${state.type === 'PRODUCT'}">Produto</button><button class="quick-operation__type" type="button" data-type="LOAN" aria-pressed="${state.type === 'LOAN'}">Empréstimo</button></div></section>${state.type === 'PRODUCT' ? `${productForm()}${previewMarkup()}` : loanForm()}</div>${state.type === 'PRODUCT' ? `<footer class="quick-operation__footer"><button type="button" class="quick-operation__button" data-preview>Atualizar prévia</button><button type="submit" class="quick-operation__button quick-operation__button--primary" data-save>Salvar operação</button></footer>` : ''}</form>`;
    bind();
  }

  function formValues() {
    const form = screen().querySelector('[data-quick-form]'); const values = Object.fromEntries(new FormData(form));
    Object.assign(state.draft, values);
    return { description: String(values.description || '').trim(), downPaymentAmount: decimal(values.downPaymentAmount), totalInstallments: Number(values.totalInstallments), installmentAmount: decimal(values.installmentAmount), frequency: values.frequency, firstDueDate: values.firstDueDate, cashAccountId: values.cashAccountId || undefined, paymentMethod: values.paymentMethod, productId: values.productId || undefined, notes: values.notes?.trim() || null };
  }

  function invalidatePreview() { state.preview = null; }

  async function findCustomers(query) {
    if (query.trim().length < 2) { state.customers = []; renderCustomerResults(); return; }
    try { state.customers = await window.pagueOnApi.get(`/customers?search=${encodeURIComponent(query.trim())}`); renderCustomerResults(); } catch (error) { setMessage(error.message, 'error'); }
  }

  function renderCustomerResults() {
    const host = screen()?.querySelector('[data-customer-results]'); if (!host) return;
    host.innerHTML = state.customers.map((customer) => `<button class="quick-operation__customer-result" type="button" data-customer-id="${customer.id}"><span><strong>${escapeHtml(customer.name)}</strong><br><small>${escapeHtml(customer.phone || customer.whatsapp || 'Sem telefone')}</small></span><small>${customer.status === 'APPROVED' ? 'Aprovado' : 'Pendente'}</small></button>`).join('');
    host.querySelectorAll('[data-customer-id]').forEach((button) => { button.onclick = () => { state.customer = state.customers.find((item) => item.id === button.dataset.customerId); state.newCustomer = false; state.customers = []; render(); }; });
  }

  async function createCustomer() {
    const name = String(state.draft.newCustomerName || '').trim(); const phone = String(state.draft.newCustomerPhone || '').trim();
    if (!name || !phone) throw new Error('Informe nome e telefone do novo cliente.');
    state.customer = await window.pagueOnApi.post('/customers', { name, phone }); state.newCustomer = false;
    window.dispatchEvent(new CustomEvent('pagueon:customer-created', { detail: { customer: state.customer } }));
  }

  async function preview() {
    try { const values = formValues(); if (!state.customer && !state.newCustomer) throw new Error('Selecione ou cadastre o cliente antes de continuar.'); setMessage('Calculando prévia…'); state.preview = await window.pagueOnApi.post('/quick-operations/product-preview', { description: values.description, downPaymentAmount: values.downPaymentAmount, totalInstallments: values.totalInstallments, installmentAmount: values.installmentAmount, frequency: values.frequency, firstDueDate: values.firstDueDate }); render(); } catch (error) { state.preview = null; setMessage(error.message || 'Não foi possível calcular a prévia.', 'error'); }
  }

  async function submit(event) {
    event.preventDefault();
    try {
      if (!state.preview) { await preview(); if (!state.preview) return; setMessage('Confira a prévia e toque em salvar novamente.'); return; }
      if (!state.customer) await createCustomer();
      state.busy = true; render();
      const values = formValues();
      const sale = { customerId: state.customer.id, productName: values.description, quantity: 1, unitPrice: state.preview.payment.totalAmount, downPaymentAmount: values.downPaymentAmount, cashAccountId: values.cashAccountId, paymentMethod: values.paymentMethod, paymentType: values.totalInstallments > 1 ? 'INSTALLMENT' : 'SINGLE', totalInstallments: values.totalInstallments > 1 ? values.totalInstallments : null, installmentAmount: values.totalInstallments > 1 ? values.installmentAmount : null, frequency: values.frequency, firstDueDate: values.firstDueDate, description: values.description, notes: values.notes };
      if (values.productId) sale.items = [{ productId: values.productId, quantity: 1, unitPrice: state.preview.payment.totalAmount }];
      await window.pagueOnApi.post('/sales', sale);
      window.showToast?.('Operação salva com sucesso.'); window.dispatchEvent(new CustomEvent('pagueon:operation-created')); document.dispatchEvent(new CustomEvent('pagueon:dashboard-request')); close();
    } catch (error) { state.busy = false; render(); setMessage(error.message || 'Não foi possível salvar a operação.', 'error'); }
  }

  function bind() {
    const root = screen(); root.querySelector('[data-close]').onclick = close;
    root.querySelectorAll('[data-type]').forEach((button) => { button.onclick = () => { state.type = button.dataset.type; invalidatePreview(); render(); }; });
    root.querySelector('[data-open-loan]')?.addEventListener('click', () => { close(); window.pagueOnLoans?.open(); });
    root.querySelector('[data-clear-customer]')?.addEventListener('click', () => { state.customer = null; render(); });
    root.querySelector('[data-new-customer]')?.addEventListener('click', () => { state.newCustomer = !state.newCustomer; render(); });
    root.querySelector('[name=customerSearch]')?.addEventListener('input', (event) => { clearTimeout(searchTimer); searchTimer = setTimeout(() => findCustomers(event.target.value), 220); });
    root.querySelectorAll('input,select,textarea').forEach((control) => { if (control.name !== 'customerSearch') control.addEventListener('input', () => { state.draft[control.name] = control.value; if (!control.name.startsWith('newCustomer')) invalidatePreview(); }); });
    root.querySelectorAll('[data-preview]').forEach((button) => { button.onclick = preview; });
    root.querySelector('[data-quick-form]').onsubmit = submit;
  }

  async function open() {
    if (!window.pagueOnApi?.authenticated()) { window.showToast?.('Entre na conta para criar uma operação.'); return; }
    close(); reset(); const root = document.createElement('section'); root.id = 'quick-operation-screen'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'quick-operation-title'); document.body.append(root); render();
    try { const [accounts, products] = await Promise.all([window.pagueOnApi.get('/financial-accounts'), window.pagueOnApi.get('/products')]); state.accounts = accounts; state.products = products; render(); root.querySelector('[name=customerSearch]')?.focus(); } catch (error) { setMessage(error.message || 'Não foi possível carregar os dados necessários.', 'error'); }
    document.addEventListener('keydown', onKeydown);
  }

  window.pagueOnQuickOperation = { open, close };
})();
