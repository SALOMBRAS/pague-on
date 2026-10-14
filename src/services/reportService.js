const prisma = require('../config/database');
const { startOfUtcDay, endOfUtcDay, addDays } = require('../utils/dateHelpers');
const { totals: installmentTotals } = require('./loanReceiptService');

const round = (value) => Number(Number(value || 0).toFixed(2));
const number = (value) => Number(value || 0);
const debitTypes = new Set(['LOAN_DISBURSEMENT', 'EXPENSE_PAID', 'TRANSFER_OUT']);
const reportDefinitions = {
  'loans-active': { title: 'Empréstimos ativos', description: 'Empréstimos ainda em cobrança.' },
  'loans-paid': { title: 'Empréstimos quitados', description: 'Empréstimos totalmente recebidos.' },
  'loans-overdue': { title: 'Empréstimos atrasados', description: 'Empréstimos com parcela ou situação vencida.' },
  'loans-by-period': { title: 'Empréstimos por período', description: 'Liberações feitas no intervalo selecionado.' },
  'loaned-values': { title: 'Valores emprestados', description: 'Capital liberado por empréstimos.' },
  'received-values': { title: 'Valores recebidos', description: 'Recebimentos efetivados em caixa.' },
  'installments-receivable': { title: 'Parcelas a receber', description: 'Parcelas abertas no período.' },
  'installments-overdue': { title: 'Parcelas vencidas', description: 'Parcelas em atraso.' },
  'receipts-by-period': { title: 'Recebimentos por período', description: 'Recibos confirmados no período.' },
  'receipts-projection': { title: 'Projeção de recebimentos', description: 'Parcelas previstas — ainda não são dinheiro no caixa.' },
  'result-projection': { title: 'Projeção de resultado', description: 'Juros e multas projetados, sem tratar principal como lucro.' },
  'principal-in-circulation': { title: 'Principal em circulação', description: 'Capital de empréstimos ainda não devolvido.' },
  'interest-forecast-received': { title: 'Juros previstos e recebidos', description: 'Comparação entre juros contratados e efetivamente recebidos.' },
  'penalties-applied-received': { title: 'Multas aplicadas e recebidas', description: 'Multas apropriadas nos recibos confirmados.' },
  'discounts-granted': { title: 'Descontos concedidos', description: 'Descontos registrados em recebimentos.' },
  'collector-commissions': { title: 'Comissões dos cobradores', description: 'Comissões calculadas por recebimentos confirmados.' },
  'cash-statement': { title: 'Extrato por caixa', description: 'Movimentações confirmadas e saldo após cada lançamento.' },
  'income-expenses': { title: 'Receitas e despesas', description: 'Entradas e saídas financeiras confirmadas.' },
  'default-rate': { title: 'Inadimplência', description: 'Saldo vencido em relação à carteira aberta.' },
  'average-delay': { title: 'Média de atraso', description: 'Dias de atraso das parcelas pendentes.' },
  'customer-history': { title: 'Histórico por cliente', description: 'Operações, parcelas e pagamentos do cliente.' },
};

function parseRange(query = {}) {
  const now = new Date();
  const startDate = query.startDate ? startOfUtcDay(new Date(query.startDate)) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endDate = query.endDate ? endOfUtcDay(new Date(query.endDate)) : endOfUtcDay(now);
  return { startDate, endDate };
}

function reportRange(filters = {}) {
  const now = new Date();
  const today = startOfUtcDay(now);
  const period = filters.period || 'MONTH';
  if (period === 'ALL') return { startDate: null, endDate: null, label: 'Todo o período' };
  if (period === 'CUSTOM') return { startDate: startOfUtcDay(`${filters.startDate}T00:00:00.000Z`), endDate: endOfUtcDay(`${filters.endDate}T00:00:00.000Z`), label: 'Período personalizado' };
  if (period === 'TODAY') return { startDate: today, endDate: endOfUtcDay(today), label: 'Hoje' };
  if (period === 'WEEK') return { startDate: today, endDate: endOfUtcDay(addDays(today, 6)), label: 'Esta semana' };
  if (period === 'MONTH') return { startDate: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), endDate: endOfUtcDay(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))), label: 'Este mês' };
  const days = Number(period.replace('NEXT_', ''));
  // O dia atual conta como o primeiro dia da janela: "próximos 7 dias" cobre hoje e os seis dias seguintes.
  return { startDate: today, endDate: endOfUtcDay(addDays(today, days - 1)), label: `Próximos ${days} dias` };
}

function dateWhere(range, field) {
  if (!range.startDate && !range.endDate) return {};
  return { [field]: { ...(range.startDate ? { gte: range.startDate } : {}), ...(range.endDate ? { lte: range.endDate } : {}) } };
}

function debtFilters(userId, filters = {}, range = null, dateField = null) {
  return {
    userId,
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.collectorId ? { customer: { is: { collectorId: filters.collectorId } } } : {}),
    ...(filters.modality ? { loanModality: filters.modality } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(range && dateField ? dateWhere(range, dateField) : {}),
  };
}

function movementFilters(userId, filters = {}, range = null) {
  return {
    userId,
    ...(filters.accountId ? { accountId: filters.accountId } : {}),
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...(filters.collectorId ? { collectorId: filters.collectorId } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
    ...(range ? dateWhere(range, 'occurredAt') : {}),
  };
}

function paymentFilters(userId, filters = {}, range = null) {
  return {
    userId,
    isReversed: false,
    ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
    ...(range ? dateWhere(range, 'createdAt') : {}),
    installment: { debt: debtFilters(userId, { ...filters, category: 'LOAN' }) },
  };
}

function columns(...items) { return items.map(([key, label, type = 'text']) => ({ key, label, type })); }
function filterPayload(filters, range) { return { ...filters, startDate: range.startDate, endDate: range.endDate, periodLabel: range.label }; }
function reportModel(key, filters, range, kpis, columnsList, rows, totals, note = null) {
  const definition = reportDefinitions[key];
  return { report: { key, ...definition }, generatedAt: new Date(), filters: filterPayload(filters, range), kpis, columns: columnsList, rows, totals, ...(note ? { note } : {}) };
}
function moneyKpi(key, label, value) { return { key, label, value: round(value), type: 'currency' }; }
function numberKpi(key, label, value) { return { key, label, value: Number(value || 0), type: 'number' }; }
function percentageKpi(key, label, value) { return { key, label, value: round(value), type: 'percentage' }; }

function installmentSummary(installment) {
  const resolved = installmentTotals(installment);
  return {
    principal: resolved.principal,
    interest: resolved.interest,
    paidPrincipal: resolved.paidPrincipal,
    paidInterest: resolved.paidInterest,
    paidPenalty: resolved.paidPenalty,
    discounts: resolved.discounted,
    paid: resolved.paidCash,
    remaining: resolved.remaining,
    outstandingPrincipal: round(Math.max(0, resolved.principal - resolved.paidPrincipal)),
    outstandingInterest: round(Math.max(0, resolved.interest - resolved.paidInterest)),
  };
}

function loanRow(debt) {
  const installments = (debt.installments || []).map((item) => installmentSummary(item));
  const principal = number(debt.principalAmount || debt.totalAmount);
  const paid = round(installments.reduce((sum, item) => sum + item.paid, 0));
  const outstanding = round(Math.max(0, number(debt.totalAmount) - paid));
  return {
    date: debt.startDate,
    dueDate: debt.dueDate,
    client: debt.customer?.name || debt.counterparty,
    customerId: debt.customerId,
    loan: debt.description,
    modality: debt.loanModality || 'Não informada',
    status: debt.status,
    principal,
    total: number(debt.totalAmount),
    received: paid,
    outstanding,
    installments: debt.totalInstallments || installments.length,
    overdueInstallments: (debt.installments || []).filter((item) => item.status === 'OVERDUE').length,
  };
}

async function loanRows(userId, filters, range, dateField, extraWhere = {}) {
  const debts = await prisma.debt.findMany({
    where: { ...debtFilters(userId, { ...filters, category: 'LOAN' }, range, dateField), ...extraWhere },
    include: { customer: { select: { id: true, name: true, nickname: true, collectorId: true } }, installments: { include: { payments: true }, orderBy: { dueDate: 'asc' } } },
    orderBy: [{ [dateField || 'dueDate']: 'asc' }, { createdAt: 'asc' }],
  });
  return debts.map(loanRow);
}

async function loanInstallments(userId, filters, range, overdueOnly = false, futureOnly = false) {
  const today = startOfUtcDay(new Date());
  const conditions = [
    { debt: debtFilters(userId, { ...filters, category: 'LOAN' }) },
    ...(range?.startDate || range?.endDate ? [dateWhere(range, 'dueDate')] : []),
    ...(overdueOnly ? [{ OR: [{ status: 'OVERDUE' }, { dueDate: { lt: today }, status: { not: 'PAID' } }] }] : []),
    ...(futureOnly ? [{ dueDate: { gte: today }, status: { not: 'PAID' } }] : []),
  ];
  const where = { AND: conditions };
  const installments = await prisma.installment.findMany({ where, include: { payments: true, debt: { include: { customer: { select: { id: true, name: true, nickname: true } } } } }, orderBy: { dueDate: 'asc' } });
  return installments.map((item) => {
    const totals = installmentSummary(item);
    return { date: item.dueDate, dueDate: item.dueDate, client: item.debt.customer?.name || item.debt.counterparty, customerId: item.debt.customerId, loan: item.debt.description, installment: item.number, status: item.status, principal: totals.principal, interest: totals.interest, paid: totals.paid, remaining: totals.remaining, daysOverdue: item.daysOverdue || Math.max(0, Math.ceil((today - startOfUtcDay(item.dueDate)) / 86400000)), ...totals };
  }).filter((item) => overdueOnly || item.remaining > 0.009);
}

async function paymentRows(userId, filters, range) {
  const payments = await prisma.installmentPayment.findMany({ where: paymentFilters(userId, filters, range), include: { installment: { include: { debt: { include: { customer: { select: { id: true, name: true, nickname: true } } } } } } }, orderBy: { createdAt: 'desc' } });
  return payments.map((payment) => ({ date: payment.createdAt, receipt: payment.receiptNumber, client: payment.installment.debt.customer?.name || payment.installment.debt.counterparty, customerId: payment.installment.debt.customerId, loan: payment.installment.debt.description, installment: payment.installment.number, paymentMethod: payment.paymentMethod, principal: number(payment.principalAmount), interest: number(payment.interestAmount), penalty: number(payment.penaltyAmount), discount: number(payment.discountAmount), received: number(payment.amount) }));
}

async function movementRows(userId, filters, range, types = null) {
  const movements = await prisma.financialMovement.findMany({ where: { ...movementFilters(userId, filters, range), ...(types ? { type: { in: types } } : {}), isConfirmed: true }, include: { account: { select: { id: true, name: true } }, customer: { select: { id: true, name: true } }, debt: { select: { id: true, description: true, loanModality: true } }, collector: { select: { id: true, name: true } } }, orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }] });
  return movements.map((movement) => ({ date: movement.occurredAt, account: movement.account.name, accountId: movement.accountId, type: movement.type, description: movement.description || movement.origin || 'Movimentação financeira', category: movement.category || 'Sem categoria', paymentMethod: movement.paymentMethod || 'Não informado', client: movement.customer?.name || '', customerId: movement.customerId, collector: movement.collector?.name || '', loan: movement.debt?.description || '', modality: movement.debt?.loanModality || '', principal: number(movement.principal), interest: number(movement.interest), penalty: number(movement.penalty), amount: number(movement.amount), signedAmount: debitTypes.has(movement.type) ? -number(movement.amount) : number(movement.amount), origin: movement.origin || '' }));
}

async function buildReport(userId, key, filters = {}) {
  if (!reportDefinitions[key]) throw new Error('REPORT_NOT_FOUND');
  const range = reportRange(filters);
  const loanColumns = columns(['client', 'Cliente'], ['loan', 'Empréstimo'], ['modality', 'Modalidade'], ['principal', 'Principal', 'currency'], ['received', 'Recebido', 'currency'], ['outstanding', 'Saldo a receber', 'currency'], ['status', 'Situação']);
  if (['loans-active', 'loans-paid', 'loans-overdue', 'loans-by-period'].includes(key)) {
    const state = { 'loans-active': { status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] }, isActive: true }, 'loans-paid': { status: 'PAID' }, 'loans-overdue': { status: 'OVERDUE' }, 'loans-by-period': {} }[key];
    const dateField = key === 'loans-paid' ? 'paidAt' : key === 'loans-by-period' ? 'startDate' : 'dueDate';
    const rows = await loanRows(userId, filters, range, dateField, state);
    const totals = { principal: round(rows.reduce((sum, row) => sum + row.principal, 0)), received: round(rows.reduce((sum, row) => sum + row.received, 0)), outstanding: round(rows.reduce((sum, row) => sum + row.outstanding, 0)), count: rows.length };
    return reportModel(key, filters, range, [moneyKpi('principal', 'Principal', totals.principal), moneyKpi('received', 'Recebido', totals.received), moneyKpi('outstanding', 'Saldo a receber', totals.outstanding), numberKpi('count', 'Operações', totals.count)], loanColumns, rows, totals);
  }
  if (key === 'loaned-values') {
    const rows = await movementRows(userId, { ...filters, category: filters.category || 'LOAN' }, range, ['LOAN_DISBURSEMENT']);
    const total = round(rows.reduce((sum, row) => sum + row.amount, 0));
    return reportModel(key, filters, range, [moneyKpi('loaned', 'Total emprestado', total), numberKpi('count', 'Liberações', rows.length)], columns(['date', 'Data', 'date'], ['client', 'Cliente'], ['loan', 'Empréstimo'], ['account', 'Caixa'], ['principal', 'Principal', 'currency']), rows, { loaned: total, count: rows.length });
  }
  if (key === 'received-values') {
    const rows = await movementRows(userId, filters, range, ['PAYMENT_RECEIVED']);
    const totals = { received: round(rows.reduce((sum, row) => sum + row.amount, 0)), principal: round(rows.reduce((sum, row) => sum + row.principal, 0)), interest: round(rows.reduce((sum, row) => sum + row.interest, 0)), penalty: round(rows.reduce((sum, row) => sum + row.penalty, 0)) };
    return reportModel(key, filters, range, [moneyKpi('received', 'Recebido', totals.received), moneyKpi('principal', 'Principal devolvido', totals.principal), moneyKpi('interest', 'Juros recebidos', totals.interest), moneyKpi('penalty', 'Multas recebidas', totals.penalty)], columns(['date', 'Data', 'date'], ['client', 'Cliente'], ['loan', 'Operação'], ['account', 'Caixa'], ['principal', 'Principal', 'currency'], ['interest', 'Juros', 'currency'], ['penalty', 'Multa', 'currency'], ['amount', 'Recebido', 'currency']), rows, totals);
  }
  if (['installments-receivable', 'installments-overdue', 'receipts-projection'].includes(key)) {
    const rows = await loanInstallments(userId, filters, range, key === 'installments-overdue', key === 'receipts-projection');
    const totals = { remaining: round(rows.reduce((sum, row) => sum + row.remaining, 0)), principal: round(rows.reduce((sum, row) => sum + row.outstandingPrincipal, 0)), interest: round(rows.reduce((sum, row) => sum + row.outstandingInterest, 0)), count: rows.length };
    return reportModel(key, filters, range, [moneyKpi('remaining', key === 'receipts-projection' ? 'Previsto a receber' : 'Saldo a receber', totals.remaining), moneyKpi('principal', 'Principal', totals.principal), moneyKpi('interest', 'Juros previstos', totals.interest), numberKpi('count', 'Parcelas', totals.count)], columns(['dueDate', 'Vencimento', 'date'], ['client', 'Cliente'], ['loan', 'Empréstimo'], ['installment', 'Parcela', 'number'], ['principal', 'Principal', 'currency'], ['interest', 'Juros', 'currency'], ['remaining', 'Saldo', 'currency'], ['status', 'Situação']), rows, totals, key === 'receipts-projection' ? 'Projeção é previsão de recebimento; não representa dinheiro disponível em caixa.' : null);
  }
  if (key === 'receipts-by-period') {
    const rows = await paymentRows(userId, filters, range);
    const totals = ['received', 'principal', 'interest', 'penalty', 'discount'].reduce((result, field) => ({ ...result, [field]: round(rows.reduce((sum, row) => sum + row[field], 0)) }), {});
    return reportModel(key, filters, range, [moneyKpi('received', 'Recebido', totals.received), moneyKpi('principal', 'Principal', totals.principal), moneyKpi('interest', 'Juros', totals.interest), moneyKpi('penalty', 'Multas', totals.penalty)], columns(['date', 'Data', 'date'], ['client', 'Cliente'], ['loan', 'Empréstimo'], ['receipt', 'Recibo'], ['principal', 'Principal', 'currency'], ['interest', 'Juros', 'currency'], ['penalty', 'Multa', 'currency'], ['discount', 'Desconto', 'currency'], ['received', 'Recebido', 'currency']), rows, totals);
  }
  if (['result-projection', 'principal-in-circulation', 'interest-forecast-received', 'penalties-applied-received', 'discounts-granted'].includes(key)) {
    const [installments, payments] = await Promise.all([loanInstallments(userId, filters, range), paymentRows(userId, filters, range)]);
    const totals = { principalInCirculation: round(installments.reduce((sum, row) => sum + row.outstandingPrincipal, 0)), projectedInterest: round(installments.reduce((sum, row) => sum + row.outstandingInterest, 0)), receivedInterest: round(payments.reduce((sum, row) => sum + row.interest, 0)), penaltiesReceived: round(payments.reduce((sum, row) => sum + row.penalty, 0)), discounts: round(payments.reduce((sum, row) => sum + row.discount, 0)) };
    if (key === 'result-projection') {
      const projectedRevenue = round(Math.max(0, totals.projectedInterest - totals.discounts));
      return reportModel(key, filters, range, [moneyKpi('principalInCirculation', 'Principal em circulação', totals.principalInCirculation), moneyKpi('receivedInterest', 'Receita realizada (juros e multas)', totals.receivedInterest + totals.penaltiesReceived), moneyKpi('projectedRevenue', 'Receita projetada', projectedRevenue), moneyKpi('discounts', 'Descontos', totals.discounts)], columns(['dueDate', 'Vencimento', 'date'], ['client', 'Cliente'], ['loan', 'Empréstimo'], ['outstandingPrincipal', 'Principal pendente', 'currency'], ['outstandingInterest', 'Juros previstos', 'currency'], ['remaining', 'Total projetado', 'currency']), installments, { ...totals, projectedRevenue, realizedRevenue: round(totals.receivedInterest + totals.penaltiesReceived), projectedPenalties: 0 }, 'Principal é devolução de capital: não entra como lucro ou receita. As multas só entram quando efetivamente aplicadas e recebidas.');
    }
    if (key === 'principal-in-circulation') return reportModel(key, filters, range, [moneyKpi('principalInCirculation', 'Capital em circulação', totals.principalInCirculation), numberKpi('count', 'Parcelas abertas', installments.length)], columns(['client', 'Cliente'], ['loan', 'Empréstimo'], ['dueDate', 'Vencimento', 'date'], ['outstandingPrincipal', 'Principal pendente', 'currency'], ['remaining', 'Saldo total', 'currency']), installments, totals);
    if (key === 'interest-forecast-received') return reportModel(key, filters, range, [moneyKpi('projectedInterest', 'Juros previstos', totals.projectedInterest), moneyKpi('receivedInterest', 'Juros recebidos', totals.receivedInterest), moneyKpi('remainingInterest', 'Juros a receber', totals.projectedInterest)], columns(['date', 'Data', 'date'], ['client', 'Cliente'], ['loan', 'Empréstimo'], ['interest', 'Juros recebidos', 'currency'], ['received', 'Valor recebido', 'currency']), payments, { ...totals, remainingInterest: totals.projectedInterest });
    if (key === 'penalties-applied-received') return reportModel(key, filters, range, [moneyKpi('penaltiesReceived', 'Multas recebidas', totals.penaltiesReceived), moneyKpi('pendingPenalties', 'Multas pendentes', 0)], columns(['date', 'Data', 'date'], ['client', 'Cliente'], ['loan', 'Empréstimo'], ['penalty', 'Multa recebida', 'currency'], ['received', 'Recebimento', 'currency']), payments.filter((row) => row.penalty > 0), { penaltiesApplied: totals.penaltiesReceived, penaltiesReceived: totals.penaltiesReceived, pendingPenalties: 0 }, 'O sistema registra multas na apropriação do recibo. Não há multa projetada sem lançamento contratual correspondente.');
    return reportModel(key, filters, range, [moneyKpi('discounts', 'Descontos concedidos', totals.discounts), numberKpi('count', 'Recibos com desconto', payments.filter((row) => row.discount > 0).length)], columns(['date', 'Data', 'date'], ['client', 'Cliente'], ['loan', 'Empréstimo'], ['discount', 'Desconto', 'currency'], ['received', 'Recebido', 'currency']), payments.filter((row) => row.discount > 0), totals);
  }
  if (key === 'collector-commissions') {
    const where = { userId, ...(filters.collectorId ? { collectorId: filters.collectorId } : {}), ...(filters.customerId ? { customerId: filters.customerId } : {}), ...(range ? dateWhere(range, 'createdAt') : {}) };
    const entries = await prisma.collectorCommission.findMany({ where, include: { collector: { select: { id: true, name: true } }, customer: { select: { id: true, name: true } }, debt: { select: { id: true, description: true } } }, orderBy: { createdAt: 'desc' } });
    const rows = entries.map((entry) => ({ date: entry.createdAt, collector: entry.collector.name, client: entry.customer.name, loan: entry.debt.description, base: entry.commissionBase, payment: number(entry.paymentAmount), commission: number(entry.commissionAmount), status: entry.status }));
    const active = rows.filter((row) => row.status === 'ACTIVE'); const totals = { payment: round(active.reduce((sum, row) => sum + row.payment, 0)), commission: round(active.reduce((sum, row) => sum + row.commission, 0)), reversed: round(rows.filter((row) => row.status === 'REVERSED').reduce((sum, row) => sum + row.commission, 0)) };
    return reportModel(key, filters, range, [moneyKpi('commission', 'Comissão ativa', totals.commission), moneyKpi('payment', 'Base recebida', totals.payment), moneyKpi('reversed', 'Comissão estornada', totals.reversed)], columns(['date', 'Data', 'date'], ['collector', 'Cobrador'], ['client', 'Cliente'], ['loan', 'Empréstimo'], ['base', 'Base'], ['payment', 'Recebido', 'currency'], ['commission', 'Comissão', 'currency'], ['status', 'Situação']), rows, totals);
  }
  if (['cash-statement', 'income-expenses'].includes(key)) {
    const rows = await movementRows(userId, filters, range);
    if (key === 'cash-statement') {
      let balance = 0; const statementRows = rows.map((row) => ({ ...row, balance: balance = round(balance + row.signedAmount) }));
      const totals = { credits: round(rows.filter((row) => row.signedAmount > 0).reduce((sum, row) => sum + row.signedAmount, 0)), debits: round(rows.filter((row) => row.signedAmount < 0).reduce((sum, row) => sum + Math.abs(row.signedAmount), 0)), balance: round(balance) };
      return reportModel(key, filters, range, [moneyKpi('credits', 'Créditos', totals.credits), moneyKpi('debits', 'Débitos', totals.debits), moneyKpi('balance', 'Variação no período', totals.balance)], columns(['date', 'Data', 'date'], ['account', 'Caixa'], ['type', 'Tipo'], ['category', 'Categoria'], ['client', 'Cliente'], ['loan', 'Operação'], ['paymentMethod', 'Pagamento'], ['amount', 'Valor', 'currency'], ['balance', 'Saldo após lançamento', 'currency']), statementRows, totals);
    }
    const income = round(rows.filter((row) => row.signedAmount > 0 && !['TRANSFER_IN', 'OPENING_BALANCE'].includes(row.type)).reduce((sum, row) => sum + row.signedAmount, 0));
    const expenses = round(rows.filter((row) => row.signedAmount < 0 && !['TRANSFER_OUT'].includes(row.type)).reduce((sum, row) => sum + Math.abs(row.signedAmount), 0));
    return reportModel(key, filters, range, [moneyKpi('income', 'Entradas', income), moneyKpi('expenses', 'Saídas', expenses), moneyKpi('net', 'Resultado de caixa', income - expenses)], columns(['date', 'Data', 'date'], ['account', 'Caixa'], ['type', 'Tipo'], ['category', 'Categoria'], ['description', 'Descrição'], ['amount', 'Valor', 'currency'], ['signedAmount', 'Impacto no caixa', 'currency']), rows.filter((row) => !['TRANSFER_IN', 'TRANSFER_OUT', 'OPENING_BALANCE'].includes(row.type)), { income, expenses, net: round(income - expenses) });
  }
  if (key === 'default-rate' || key === 'average-delay') {
    const rows = await loanInstallments(userId, filters, range, true);
    const allOpen = await loanInstallments(userId, filters, null);
    const overdue = round(rows.reduce((sum, row) => sum + row.remaining, 0)); const open = round(allOpen.reduce((sum, row) => sum + row.remaining, 0));
    if (key === 'default-rate') return reportModel(key, filters, range, [moneyKpi('overdue', 'Saldo vencido', overdue), moneyKpi('open', 'Carteira aberta', open), percentageKpi('rate', 'Inadimplência', open ? overdue / open * 100 : 0)], columns(['dueDate', 'Vencimento', 'date'], ['client', 'Cliente'], ['loan', 'Empréstimo'], ['remaining', 'Saldo vencido', 'currency'], ['daysOverdue', 'Dias em atraso', 'number']), rows, { overdue, open, rate: round(open ? overdue / open * 100 : 0) });
    const average = rows.length ? round(rows.reduce((sum, row) => sum + row.daysOverdue, 0) / rows.length) : 0;
    return reportModel(key, filters, range, [numberKpi('averageDays', 'Média de atraso (dias)', average), numberKpi('count', 'Parcelas vencidas', rows.length), moneyKpi('overdue', 'Saldo vencido', overdue)], columns(['dueDate', 'Vencimento', 'date'], ['client', 'Cliente'], ['loan', 'Empréstimo'], ['daysOverdue', 'Dias em atraso', 'number'], ['remaining', 'Saldo vencido', 'currency']), rows, { averageDays: average, count: rows.length, overdue });
  }
  const debts = await prisma.debt.findMany({ where: debtFilters(userId, filters, range, 'createdAt'), include: { customer: { select: { id: true, name: true, nickname: true } }, installments: { include: { payments: { where: { isReversed: false } } } } }, orderBy: { createdAt: 'desc' } });
  const rows = debts.map((debt) => { const installments = debt.installments.map((item) => installmentSummary(item)); const received = round(installments.reduce((sum, item) => sum + item.paid, 0) || number(debt.paidAmount)); return { date: debt.createdAt, client: debt.customer?.name || debt.counterparty, customerId: debt.customerId, operation: debt.description, category: debt.category, status: debt.status, total: number(debt.totalAmount), received, outstanding: round(Math.max(0, number(debt.totalAmount) - received)), installments: installments.length, payments: installments.reduce((sum, item) => sum + (item.paid > 0 ? 1 : 0), 0) }; });
  const totals = { total: round(rows.reduce((sum, row) => sum + row.total, 0)), received: round(rows.reduce((sum, row) => sum + row.received, 0)), outstanding: round(rows.reduce((sum, row) => sum + row.outstanding, 0)), customers: new Set(rows.map((row) => row.customerId).filter(Boolean)).size };
  return reportModel(key, filters, range, [moneyKpi('total', 'Total contratado', totals.total), moneyKpi('received', 'Recebido', totals.received), moneyKpi('outstanding', 'Saldo a receber', totals.outstanding), numberKpi('customers', 'Clientes', totals.customers)], columns(['date', 'Data', 'date'], ['client', 'Cliente'], ['operation', 'Operação'], ['category', 'Categoria'], ['total', 'Total', 'currency'], ['received', 'Recebido', 'currency'], ['outstanding', 'Saldo', 'currency'], ['status', 'Situação']), rows, totals);
}

async function filtersCatalog(userId) {
  const [customers, collectors, accounts, categories, paymentMethods] = await Promise.all([
    prisma.customer.findMany({ where: { userId, isActive: true }, select: { id: true, name: true, nickname: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: { workspaceOwnerId: userId, role: 'COLLECTOR' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.financialAccount.findMany({ where: { userId, isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.financialMovement.findMany({ where: { userId, category: { not: null } }, select: { category: true }, distinct: ['category'], orderBy: { category: 'asc' } }),
    prisma.financialMovement.findMany({ where: { userId, paymentMethod: { not: null } }, select: { paymentMethod: true }, distinct: ['paymentMethod'], orderBy: { paymentMethod: 'asc' } }),
  ]);
  return { reports: Object.entries(reportDefinitions).map(([key, definition]) => ({ key, ...definition })), customers, collectors, accounts, categories: categories.map((row) => row.category), paymentMethods: paymentMethods.map((row) => row.paymentMethod), modalities: ['INSTALLMENT', 'SIMPLE_INTEREST', 'PRICE', 'RENEWAL'], statuses: ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'] };
}

// Endpoints legados preservados para integrações já existentes.
async function cashflowReport(userId, query) {
  const { startDate, endDate } = parseRange(query);
  const entries = await prisma.cashFlow.findMany({ where: { userId, date: { gte: startDate, lte: endDate } }, orderBy: { date: 'asc' } });
  const totalIn = entries.reduce((total, entry) => total + number(entry.totalIn), 0); const totalOut = entries.reduce((total, entry) => total + number(entry.totalOut), 0);
  return { startDate, endDate, entries, totals: { totalIn, totalOut, balance: totalIn - totalOut } };
}
async function profitReport(userId, query) {
  const { startDate, endDate } = parseRange(query);
  const [cashflow, installments, recurring, singleDebts] = await Promise.all([
    cashflowReport(userId, { startDate, endDate }),
    prisma.installment.findMany({ where: { paidAt: { gte: startDate, lte: endDate }, debt: { userId } }, include: { debt: { include: { product: true } } } }),
    prisma.recurringPayment.findMany({ where: { paidAt: { gte: startDate, lte: endDate }, debt: { userId } }, include: { debt: { include: { product: true } } } }),
    prisma.debt.findMany({ where: { userId, paymentType: 'SINGLE', status: 'PAID', paidAt: { gte: startDate, lte: endDate } }, include: { product: true } }),
  ]);
  const payments = [
    ...installments.map((item) => ({ amount: number(item.paidAmount || item.amount), debt: item.debt })),
    ...recurring.map((item) => ({ amount: number(item.amount || item.debt.totalAmount), debt: item.debt })),
    ...singleDebts.map((debt) => ({ amount: number(debt.totalAmount), debt })),
  ];
  const byDebt = new Map();
  for (const entry of payments.filter((entry) => entry.debt.productId && entry.debt.type === 'RECEIVABLE')) {
    const current = byDebt.get(entry.debt.id) || { received: 0, debt: entry.debt };
    current.received += entry.amount; byDebt.set(entry.debt.id, current);
  }
  const productMap = new Map();
  for (const { received, debt } of byDebt.values()) {
    const product = debt.product; const current = productMap.get(product.id) || { productId: product.id, productName: product.name, received: 0, estimatedProfit: 0 };
    current.received += received; current.estimatedProfit += (number(product.sellingPrice) - number(product.costPrice)) * (number(debt.quantity) || 1); productMap.set(product.id, current);
  }
  return { startDate, endDate, income: cashflow.totals.totalIn, expenses: cashflow.totals.totalOut, profit: cashflow.totals.balance, byProduct: [...productMap.values()] };
}
async function debtsReport(userId, query) {
  const { startDate, endDate } = parseRange(query); const debts = await prisma.debt.findMany({ where: { userId, dueDate: { gte: startDate, lte: endDate } }, orderBy: { dueDate: 'asc' } });
  const summary = debts.reduce((result, debt) => { const key = debt.type === 'RECEIVABLE' ? 'receivable' : 'payable'; result[key].total += number(debt.totalAmount); result[key].count += 1; result[key].paid += number(debt.paidAmount); if (debt.status === 'OVERDUE') result[key].overdue += number(debt.totalAmount); return result; }, { receivable: { total: 0, paid: 0, overdue: 0, count: 0 }, payable: { total: 0, paid: 0, overdue: 0, count: 0 } });
  return { startDate, endDate, summary, debts };
}

module.exports = { reportDefinitions, parseRange, reportRange, buildReport, filtersCatalog, cashflowReport, profitReport, debtsReport };
