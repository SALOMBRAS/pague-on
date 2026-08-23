const prisma = require('../config/database');
const { startOfUtcDay, endOfUtcDay } = require('../utils/dateHelpers');

function parseRange(query) {
  const now = new Date();
  const startDate = query.startDate ? startOfUtcDay(new Date(query.startDate)) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endDate = query.endDate ? endOfUtcDay(new Date(query.endDate)) : endOfUtcDay(now);
  return { startDate, endDate };
}

async function cashflowReport(userId, query) {
  const { startDate, endDate } = parseRange(query);
  const entries = await prisma.cashFlow.findMany({ where: { userId, date: { gte: startDate, lte: endDate } }, orderBy: { date: 'asc' } });
  const totalIn = entries.reduce((total, entry) => total + Number(entry.totalIn), 0);
  const totalOut = entries.reduce((total, entry) => total + Number(entry.totalOut), 0);
  return { startDate, endDate, entries, totals: { totalIn, totalOut, balance: totalIn - totalOut } };
}

async function profitReport(userId, query) {
  const { startDate, endDate } = parseRange(query);
  const [cashflow, installments, recurring, singleDebts] = await Promise.all([
    cashflowReport(userId, { startDate, endDate }),
    prisma.installment.findMany({
      where: { paidAt: { gte: startDate, lte: endDate }, debt: { userId } },
      include: { debt: { include: { product: true } } },
    }),
    prisma.recurringPayment.findMany({
      where: { paidAt: { gte: startDate, lte: endDate }, debt: { userId } },
      include: { debt: { include: { product: true } } },
    }),
    prisma.debt.findMany({
      where: { userId, paymentType: 'SINGLE', status: 'PAID', paidAt: { gte: startDate, lte: endDate } },
      include: { product: true },
    }),
  ]);
  const payments = [
    ...installments.map((payment) => ({ amount: Number(payment.paidAmount || payment.amount), debt: payment.debt })),
    ...recurring.map((payment) => ({ amount: Number(payment.amount || payment.debt.totalAmount), debt: payment.debt })),
    ...singleDebts.map((debt) => ({ amount: Number(debt.totalAmount), debt })),
  ];
  const productMap = new Map();
  for (const payment of payments.filter((entry) => entry.debt.productId && entry.debt.type === 'RECEIVABLE')) {
    const product = payment.debt.product;
    const current = productMap.get(product.id) || { productId: product.id, productName: product.name, received: 0, estimatedProfit: 0 };
    current.received += payment.amount;
    current.estimatedProfit += (Number(product.sellingPrice) - Number(product.costPrice)) * (payment.debt.quantity || 1);
    productMap.set(product.id, current);
  }
  return {
    startDate,
    endDate,
    income: cashflow.totals.totalIn,
    expenses: cashflow.totals.totalOut,
    profit: cashflow.totals.balance,
    byProduct: [...productMap.values()],
  };
}

async function debtsReport(userId, query) {
  const { startDate, endDate } = parseRange(query);
  const debts = await prisma.debt.findMany({
    where: { userId, dueDate: { gte: startDate, lte: endDate } },
    orderBy: { dueDate: 'asc' },
  });
  const summary = debts.reduce((result, debt) => {
    const key = debt.type === 'RECEIVABLE' ? 'receivable' : 'payable';
    result[key].total += Number(debt.totalAmount);
    result[key].count += 1;
    result[key].paid += Number(debt.paidAmount || 0);
    if (debt.status === 'OVERDUE') result[key].overdue += Number(debt.totalAmount);
    return result;
  }, {
    receivable: { total: 0, paid: 0, overdue: 0, count: 0 },
    payable: { total: 0, paid: 0, overdue: 0, count: 0 },
  });
  return { startDate, endDate, summary, debts };
}

module.exports = { parseRange, cashflowReport, profitReport, debtsReport };
