(() => {
  const GOAL_KEY = 'pagueon.goals.v1';
  const api = () => location.port === '5500' ? 'http://localhost:3000/api/v1' : '/api/v1';
  // A sessão vive no sessionStorage, sob a guarda do auth.js — clearSession()
  // inclusive apaga a chave antiga do localStorage que este módulo lia.
  const token = () => window.pagueOnAuth?.getToken() || null;
  const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });
  const money = (value) => window.pagueOnLock?.config?.hideValues ? '••••' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
  const number = (value) => Number(value || 0);
  const read = () => { try { return JSON.parse(localStorage.getItem(GOAL_KEY) || '[]'); } catch (_error) { return []; } };
  const write = (goals) => { localStorage.setItem(GOAL_KEY, JSON.stringify(goals)); window.dispatchEvent(new CustomEvent('pagueon:data-change')); };
  const parseMoney = (value) => { const raw = String(value).replace(/\s/g, ''); return Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/[^\d.]/g, '')); };
  const stock = (goal) => { const current = number(goal.currentAmount ?? goal.current ?? 0); const target = number(goal.targetAmount ?? goal.target ?? 0); return { current, target, progress: target > 0 ? Math.max(0, Math.min(100, Math.round((current / target) * 100))) : 0 }; };

  let host = null;
  const setHost = (element) => { host = element || document.querySelector('#goalsView'); };

  function card(goal) {
    const { current, target, progress } = stock(goal);
    const icon = goal.icon || '🎯';
    return `<article class="goal-card"><header><b>${icon} ${goal.name}</b><span>${progress}%</span></header><div class="goal-bar" aria-label="Progresso do cofrinho"><i style="width:${progress}%"></i></div><small>${money(current)} de ${money(target)} no cofrinho</small><nav><button data-goal-deposit="${goal.id}">➕ Depositar</button><button data-goal-withdraw="${goal.id}">➖ Resgatar</button><button data-goal-edit="${goal.id}">✏️ Editar</button><button class="goal-remove" data-goal-remove="${goal.id}" aria-label="Remover cofrinho">🗑️</button></nav></article>`;
  }

  function render() {
    if (!host) return;
    const goals = read();
    host.innerHTML = `<header class="goals-head"><div><p class="eyebrow">Economize com propósito</p><h1>🎯 Minhas Metas</h1></div><button class="goals-refresh" data-goals-refresh aria-label="Atualizar cofrinhos">↻</button></header>${goals.length ? goals.map(card).join('') : '<div class="empty"><strong>Crie seu primeiro cofrinho</strong><span>Defina uma meta, deposite aos poucos e acompanhe o progresso até chegar lá.</span></div>'}<button class="goals-add" data-goals-add>➕ Novo cofrinho</button>`;
    host.querySelector('[data-goals-add]').onclick = () => openForm();
    host.querySelector('[data-goals-refresh]').onclick = () => refresh();
    host.querySelectorAll('[data-goal-deposit]').forEach((button) => (button.onclick = () => move(button.dataset.goalDeposit, 'deposit')));
    host.querySelectorAll('[data-goal-withdraw]').forEach((button) => (button.onclick = () => move(button.dataset.goalWithdraw, 'withdraw')));
    host.querySelectorAll('[data-goal-edit]').forEach((button) => (button.onclick = () => openForm(read().find((goal) => goal.id === button.dataset.goalEdit))));
    host.querySelectorAll('[data-goal-remove]').forEach((button) => (button.onclick = () => remove(button.dataset.goalRemove)));
  }

  function openForm(goal = null) {
    const form = document.querySelector('#goalsForm'); if (!form) return;
    const item = goal || { name: '', icon: '🎯', targetAmount: '', targetDate: '' };
    form.innerHTML = `<header class="goals-form-head"><button class="back" data-goals-close>← Voltar</button><h2>${goal ? 'Editar cofrinho' : 'Novo cofrinho'}</h2><span></span></header><div class="form-body"><div class="field"><label>Nome</label><input data-goal-name value="${String(item.name).replaceAll('"', '&quot;')}" placeholder="Ex: Viagem dos sonhos"></div><div class="field"><label>Emoji</label><input data-goal-icon value="${String(item.icon || '🎯')}" maxlength="4" placeholder="🎯"></div><div class="field money"><label>Valor alvo</label><i>R$</i><input data-goal-target inputmode="decimal" value="${item.targetAmount === '' ? '' : Number(number(item.targetAmount)).toFixed(2).replace('.', ',')}" placeholder="0,00"></div><div class="field"><label>Data alvo (opcional)</label><input data-goal-date type="date" value="${item.targetDate || ''}"></div></div><div class="form-footer"><button class="form-next" data-goal-save>💾 Salvar cofrinho</button></div>`;
    form.classList.add('show');
    form.querySelector('[data-goals-close]').onclick = closeForm;
    form.querySelector('[data-goal-save]').onclick = () => save(goal?.id, { name: form.querySelector('[data-goal-name]').value.trim(), icon: form.querySelector('[data-goal-icon]').value.trim(), targetAmount: form.querySelector('[data-goal-target]').value, targetDate: form.querySelector('[data-goal-date]').value || null });
  }

  function closeForm() { document.querySelector('#goalsForm')?.classList.remove('show'); }

  async function save(id, input) {
    const targetAmount = parseMoney(input.targetAmount);
    if (!input.name || !Number.isFinite(targetAmount) || targetAmount <= 0) return alert('Informe um nome e um valor alvo válido.');
    const payload = { name: input.name, icon: input.icon || '🎯', targetAmount, targetDate: input.targetDate };
    let saved;
    if (token()) {
      try {
        const response = await fetch(`${api()}/goals${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', headers: headers(), body: JSON.stringify(payload) });
        const result = await response.json();
        if (response.ok) saved = result.data;
      } catch (_error) { /* Preserva o lançamento local para sincronização posterior. */ }
    }
    const goals = read();
    const existing = id ? goals.find((goal) => goal.id === id) : null;
    const local = saved || { ...payload, id: id || `goal-${Date.now()}`, currentAmount: existing?.currentAmount ?? existing?.current ?? 0, current: existing?.currentAmount ?? existing?.current ?? 0 };
    const index = goals.findIndex((goal) => goal.id === local.id);
    if (index >= 0) goals[index] = local; else goals.push(local);
    write(goals); closeForm(); render();
  }

  async function remove(id) {
    if (!confirm('Remover este cofrinho?')) return;
    if (token()) { try { await fetch(`${api()}/goals/${id}`, { method: 'DELETE', headers: headers() }); } catch (_error) { /* A remoção local permanece válida quando estiver offline. */ } }
    write(read().filter((goal) => goal.id !== id)); render();
  }

  async function transport(id, direction, amountValue, note = null) {
    const value = Number(amountValue);
    const goals = read();
    const index = goals.findIndex((goal) => goal.id === id);
    const goal = goals[index];
    if (!goal) return;
    let saved;
    if (token()) {
      try {
        const response = await fetch(`${api()}/goals/${id}/${direction}`, { method: 'POST', headers: headers(), body: JSON.stringify({ amount: value, note }) });
        const result = await response.json();
        if (response.ok) saved = result.data;
      } catch (_error) { /* Mantém local quando offline. */ }
    }
    if (saved) goals[index] = saved;
    else {
      const current = number(goal.currentAmount ?? goal.current ?? 0);
      goals[index].currentAmount = Math.max(0, current + (direction === 'deposit' ? value : -value));
      goals[index].current = goals[index].currentAmount;
    }
    write(goals); render();
    return goals[index];
  }

  function move(id, direction) {
    const goal = read().find((item) => item.id === id); if (!goal) return;
    const amount = prompt(direction === 'deposit' ? `Quanto depositar em "${goal.name}"?` : `Quanto resgatar de "${goal.name}"?`);
    if (amount === null || amount.trim() === '') return;
    const value = parseMoney(amount);
    if (!Number.isFinite(value) || value <= 0) return alert('Informe um valor válido.');
    if (direction === 'withdraw' && value > number(goal.currentAmount ?? goal.current ?? 0)) return alert('Saldo insuficiente neste cofrinho.');
    transport(goal.id, direction, value);
  }

  const deposit = (id, amount, note) => transport(id, 'deposit', amount, note);
  const withdraw = (id, amount, note) => transport(id, 'withdraw', amount, note);

  async function refresh() {
    if (!token()) { render(); return; }
    try {
      const response = await fetch(`${api()}/goals`, { headers: headers() });
      const result = await response.json();
      if (response.ok && Array.isArray(result.data)) { if (result.data.length) write(result.data); else localStorage.setItem(GOAL_KEY, '[]'); }
    } catch (_error) { /* offline */ }
    render();
  }

  // Abrir a tela sincroniza com o servidor; refresh() já renderiza nos dois caminhos.
  function open(target) { setHost(target); refresh(); }

  window.addEventListener('pagueon:data-change', () => render());
  window.pagueOnGoalsActions = { open, close: closeForm, refresh, render, move, deposit, withdraw };
  if (document.querySelector('#goalsView.show')) render();
})();
