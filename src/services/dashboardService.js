const prisma = require('../config/database');
const { refreshOverdues } = require('./debtService');
const { addDays, startOfUtcDay, endOfUtcDay, greetingFor, weekdayLabel } = require('../utils/dateHelpers');

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

module.exports = { getDashboard, remainingAmount };
