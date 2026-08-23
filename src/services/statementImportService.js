const prisma = require('../config/database');
const { fingerprint } = require('./reconciliationService');
const { updateDailyCashFlow } = require('./debtService');
const { syncBudgetForDebt } = require('./budgetService');

async function importTransactions(userId, input) {
  const items = input.transactions.map((item) => ({ ...item, date: new Date(item.date), amount: Number(item.amount), description: item.description.trim() }));
  const unique = new Map(items.map((item) => [fingerprint(item), item])); const existing = await prisma.bankTransaction.findMany({ where: { userId, fingerprint: { in: [...unique.keys()] } }, select: { fingerprint: true } }); const known = new Set(existing.map((item) => item.fingerprint)); const fresh = [...unique.entries()].filter(([key]) => !known.has(key));
  const result = await prisma.$transaction(async (tx) => {
    const statement = await tx.bankStatement.create({ data: { userId, fileName: input.fileName, accountName: input.accountName || null } }); const debts = [];
    for (const [key, item] of fresh) {
      const type = item.amount >= 0 ? 'RECEIVABLE' : 'PAYABLE'; const amount = Math.abs(item.amount);
      const debt = await tx.debt.create({ data: { userId, type, paymentType: 'SINGLE', description: item.description, counterparty: item.description, category: 'OTHER', totalAmount: amount, originalAmount: amount, currency: 'BRL', exchangeRate: 1, paidAmount: amount, startDate: item.date, dueDate: item.date, status: 'PAID', isActive: false, paidAt: item.date } });
      await updateDailyCashFlow(tx, userId, type, amount, item.date); await syncBudgetForDebt(userId, debt, tx); await tx.bankTransaction.create({ data: { userId, statementId: statement.id, externalId: item.externalId || null, fingerprint: key, date: item.date, description: item.description, amount: item.amount, status: 'CREATED', matchedDebtId: debt.id, matchConfidence: 100, confirmedAt: new Date() } }); debts.push(debt);
    }
    return { statementId: statement.id, created: debts.length };
  });
  return { ...result, skipped: items.length - fresh.length };
}

module.exports = { importTransactions };
