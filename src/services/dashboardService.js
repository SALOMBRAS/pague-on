const prisma = require('../config/database');
const { refreshOverdues } = require('./debtService');
const { addDays, startOfUtcDay, endOfUtcDay, greetingFor, weekdayLabel } = require('../utils/dateHelpers');
const financialAccounts = require('./financialAccountService');

function remainingAmount(debt) {
  if (debt.paymentType === 'SINGLE') return Math.max(0, Number(debt.totalAmount) - Number(debt.paidAmount || 0));
  if (debt.paymentType === 'RECURRING') return Number(debt.totalAmount);
  const paid = debt.installments
    .filter((installment) => installment.status === 'PAID')
    .reduce((total, installment) => total + Number(installment.paidAmount || installment.amount), 0);
  return Math.max(0, Number(debt.totalAmount) - paid);
}

function debtSummary(debt) {
  return {
    id: debt.id,
    type: debt.type,
    paymentType: debt.paymentType,
    counterparty: debt.counterparty,
    description: debt.description,
    amount: remainingAmount(debt),
    dueDate: debt.dueDate,
    status: debt.status,
    badge: debt.status === 'OVERDUE' ? 'Atrasado' : 'Próximo vencimento',
  };
}

async function getDashboard(user) {
  await refreshOverdues(user.id);
  const now = new Date();
  const today = startOfUtcDay(now);
  const inThreeDays = endOfUtcDay(addDays(today, 3));
  const firstMonthDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const sevenDaysAgo = addDays(today, -6);

  const [debts, products, flows, unreadCount, todayReceivables] = await Promise.all([
    prisma.debt.findMany({
      where: { userId: user.id },
      include: { installments: true },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.product.findMany({ where: { userId: user.id, isActive: true }, orderBy: { profitMargin: 'desc' }, take: 3 }),
    prisma.cashFlow.findMany({ where: { userId: user.id, date: { gte: sevenDaysAgo, lte: today } }, orderBy: { date: 'asc' } }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
    prisma.debt.count({
      where: { userId: user.id, type: 'RECEIVABLE', isActive: true, dueDate: { gte: today, lte: endOfUtcDay(today) } },
    }),
  ]);

  const openDebts = debts.filter((debt) => ['PENDING', 'PARTIAL'].includes(debt.status));
  const toReceive = openDebts.filter((debt) => debt.type === 'RECEIVABLE').reduce((sum, debt) => sum + remainingAmount(debt), 0);
  const toPay = openDebts.filter((debt) => debt.type === 'PAYABLE').reduce((sum, debt) => sum + remainingAmount(debt), 0);
  const monthFlows = await prisma.cashFlow.aggregate({
    where: { userId: user.id, date: { gte: firstMonthDay } },
    _sum: { totalIn: true, totalOut: true },
  });
  const profitMonth = Number(monthFlows._sum.totalIn || 0) - Number(monthFlows._sum.totalOut || 0);
  const overdueTotal = debts
    .filter((debt) => debt.status === 'OVERDUE')
    .reduce((sum, debt) => sum + remainingAmount(debt), 0);
  const urgentDebts = debts
    .filter((debt) => debt.status === 'OVERDUE' || (debt.isActive && debt.dueDate >= today && debt.dueDate <= inThreeDays))
    .sort((left, right) => {
      if (left.status === 'OVERDUE' && right.status !== 'OVERDUE') return -1;
      if (left.status !== 'OVERDUE' && right.status === 'OVERDUE') return 1;
      return left.dueDate - right.dueDate;
    })
    .slice(0, 3)
    .map(debtSummary);

  const flowByDate = new Map(flows.map((flow) => [flow.date.toISOString().slice(0, 10), flow]));
  const dates = Array.from({ length: 7 }, (_value, index) => addDays(sevenDaysAgo, index));
  const data = dates.map((date) => Number(flowByDate.get(date.toISOString().slice(0, 10))?.balance || 0));

  return {
    user: { name: user.name, greeting: greetingFor(now), avatar: user.avatar },
    balance: { liquid: Number((toReceive - toPay).toFixed(2)), toReceive, toPay },
    summaryCards: [
      { label: 'Lucro do Mês', value: profitMonth, type: profitMonth >= 0 ? 'positive' : 'danger', icon: 'trending-up' },
      { label: 'Dívidas Atrasadas', value: overdueTotal, type: 'danger', icon: 'alert-triangle' },
      { label: 'Cobranças Hoje', value: todayReceivables, type: 'warning', icon: 'bell' },
    ],
    urgentDebts,
    highlightedProducts: products.map((product) => ({
      id: product.id,
      name: product.name,
      image: product.image,
      profitMargin: Number(product.profitMargin),
      stockQuantity: product.stockQuantity,
      lowStock: product.minStockAlert !== null && product.stockQuantity <= product.minStockAlert,
    })),
    cashFlow: {
      labels: dates.map(weekdayLabel),
      data,
      totalIn: Number(monthFlows._sum.totalIn || 0),
      totalOut: Number(monthFlows._sum.totalOut || 0),
    },
    todayReminders: {
      count: todayReceivables,
      message: todayReceivables === 1 ? 'Você tem 1 cobrança agendada para hoje' : `Você tem ${todayReceivables} cobranças agendadas para hoje`,
    },
    notifications: { unreadCount },
  };
}

function rangeFor(query = {}) { const now = new Date(); const today = startOfUtcDay(now); const period = query.period || 'MONTH'; if (period === 'TODAY') return { start: today, end: endOfUtcDay(today) }; if (period === 'WEEK') return { start: addDays(today, -6), end: endOfUtcDay(today) }; if (period === 'CUSTOM') return { start: startOfUtcDay(new Date(query.startDate)), end: endOfUtcDay(new Date(query.endDate)) }; return { start: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), end: endOfUtcDay(today) }; }
function principalRemaining(debt) { if (debt.paymentType !== 'INSTALLMENT') return Math.max(0, Number(debt.totalAmount) - Number(debt.paidAmount || 0)); return debt.installments.reduce((sum, item) => sum + Math.max(0, Number(item.amount) - Math.min(Number(item.amount), Number(item.paidAmount || 0))), 0); }
function dueInRange(debts, start, end) { return debts.reduce((sum, debt) => { if (debt.paymentType === 'INSTALLMENT') return sum + debt.installments.filter((item) => item.status !== 'PAID' && item.dueDate >= start && item.dueDate <= end).reduce((n, item) => n + Number(item.totalAmount || item.amount), 0); return sum + (debt.isActive && debt.dueDate >= start && debt.dueDate <= end ? remainingAmount(debt) : 0); }, 0); }
async function getFinancialDashboard(userId, query = {}) {
  await refreshOverdues(userId); const { start, end } = rangeFor(query); const today = startOfUtcDay(); const week = { start: addDays(today, -6), end: endOfUtcDay(today) }; const month = { start: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), end: endOfUtcDay(today) };
  const where = { userId, ...(query.collectorId ? { customer: { collectorId: query.collectorId } } : {}), ...(query.status ? { status: query.status } : {}) };
  const [debts, customers, accounts, flows] = await Promise.all([prisma.debt.findMany({ where, include: { installments: true }, orderBy: { dueDate: 'asc' } }), prisma.customer.count({ where: { userId, isActive: true, ...(query.collectorId ? { collectorId: query.collectorId } : {}) } }), financialAccounts.listWithBalances(userId), prisma.cashFlow.findMany({ where: { userId, date: { gte: month.start, lte: month.end } }, orderBy: { date: 'asc' } })]);
  const accountSet = query.cashAccountId ? new Set([query.cashAccountId]) : null; const available = accounts.filter((account) => account.isActive && account.includeInAvailability && (!accountSet || accountSet.has(account.id))).reduce((sum, account) => sum + Number(account.balance), 0); const loans = debts.filter((debt) => debt.type === 'RECEIVABLE' && debt.category === 'LOAN' && debt.isActive); const receivables = debts.filter((debt) => debt.type === 'RECEIVABLE' && debt.isActive); const overdue = receivables.filter((debt) => debt.status === 'OVERDUE').reduce((sum, debt) => sum + remainingAmount(debt), 0); const received = (period) => flows.filter((flow) => flow.date >= period.start && flow.date <= period.end).reduce((sum, flow) => sum + Number(flow.totalIn), 0);
  const expected = dueInRange(receivables, start, end); const principal = loans.reduce((sum, debt) => sum + principalRemaining(debt), 0); const interest = loans.reduce((sum, debt) => sum + debt.installments.reduce((n, item) => n + Math.max(0, Number(item.totalAmount || item.amount) - Number(item.amount)), 0), 0);
  return { filters: { period: query.period || 'MONTH', startDate: start, endDate: end }, accounts, metrics: { availableCash: available, capitalInCirculation: principal, totalReceivable: receivables.reduce((sum, debt) => sum + remainingAmount(debt), 0), receivedToday: received({ start: today, end: endOfUtcDay(today) }), dueToday: dueInRange(receivables, today, endOfUtcDay(today)), receivedWeek: received(week), dueWeek: dueInRange(receivables, week.start, week.end), receivedMonth: received(month), dueMonth: dueInRange(receivables, month.start, month.end), overdueTotal: overdue, activeCustomers: customers, activeLoans: loans.length }, charts: { receipts: flows.map((flow) => ({ date: flow.date, value: Number(flow.totalIn) })), lent: loans.filter((loan) => loan.createdAt >= start && loan.createdAt <= end).map((loan) => ({ date: loan.createdAt, value: Number(loan.totalAmount) })), overdue: receivables.filter((debt) => debt.status === 'OVERDUE').map((debt) => ({ date: debt.dueDate, value: remainingAmount(debt) })), composition: { principal, interest, penalties: 0 }, forecastVsReceived: { expected, received: received({ start, end }) } } };
}

module.exports = { getDashboard, getFinancialDashboard, remainingAmount, rangeFor };
