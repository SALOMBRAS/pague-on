const prisma = require('../config/database');
const { startOfUtcDay } = require('../utils/dateHelpers');

const signedAmount = (movement) => ['LOAN_DISBURSEMENT', 'EXPENSE_PAID'].includes(movement.type) ? -Number(movement.amount) : Number(movement.amount);

async function ensureDefaultAccount(userId) {
  const existing = await prisma.financialAccount.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: 'asc' } });
  if (existing) return existing;
  const latestFlow = await prisma.cashFlow.findFirst({ where: { userId }, orderBy: { date: 'desc' }, select: { balance: true } });
  return prisma.financialAccount.create({ data: { userId, name: 'Caixa principal', type: 'CASH', openingBalance: Number(latestFlow?.balance || 0), includeInAvailability: true } });
}

async function listWithBalances(userId) {
  await ensureDefaultAccount(userId);
  const accounts = await prisma.financialAccount.findMany({ where: { userId }, include: { movements: { select: { type: true, amount: true } } }, orderBy: { createdAt: 'asc' } });
  return accounts.map(({ movements, ...account }) => ({ ...account, balance: Number(account.openingBalance) + movements.reduce((sum, movement) => sum + signedAmount(movement), 0) }));
}

async function recordMovement({ userId, accountId, type, amount, occurredAt = new Date(), referenceId, description, principal = 0, interest = 0, penalty = 0 }) {
  const account = accountId ? await prisma.financialAccount.findFirst({ where: { id: accountId, userId, isActive: true } }) : await ensureDefaultAccount(userId);
  if (!account) throw new Error('Conta financeira não encontrada ou inativa.');
  return prisma.financialMovement.upsert({ where: { userId_referenceId: { userId, referenceId: referenceId || `manual:${Date.now()}` } }, create: { userId, accountId: account.id, type, amount, occurredAt: startOfUtcDay(occurredAt), referenceId: referenceId || null, description, principal, interest, penalty }, update: {} });
}

module.exports = { ensureDefaultAccount, listWithBalances, recordMovement, signedAmount };
