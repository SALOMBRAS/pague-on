const prisma = require('../config/database');
const { startOfUtcDay } = require('../utils/dateHelpers');

const signedAmount = (movement) => ['LOAN_DISBURSEMENT', 'EXPENSE_PAID'].includes(movement.type) ? -Number(movement.amount) : Number(movement.amount);

async function ensureDefaultAccount(userId, db = prisma) {
  const existing = await db.financialAccount.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: 'asc' } });
  if (existing) return existing;
  const latestFlow = await db.cashFlow.findFirst({ where: { userId }, orderBy: { date: 'desc' }, select: { balance: true } });
  return db.financialAccount.create({ data: { userId, name: 'Caixa principal', type: 'CASH', openingBalance: Number(latestFlow?.balance || 0), includeInAvailability: true } });
}

async function listWithBalances(userId) {
  await ensureDefaultAccount(userId);
  const accounts = await prisma.financialAccount.findMany({ where: { userId }, include: { movements: { select: { type: true, amount: true } } }, orderBy: { createdAt: 'asc' } });
  return accounts.map(({ movements, ...account }) => ({ ...account, balance: Number(account.openingBalance) + movements.reduce((sum, movement) => sum + signedAmount(movement), 0) }));
}

async function recordMovement({ db = prisma, userId, accountId, type, amount, occurredAt = new Date(), referenceId, description, principal = 0, interest = 0, penalty = 0 }) {
  const resolvedReference = referenceId || `manual:${crypto.randomUUID()}`;
  const account = accountId ? await db.financialAccount.findFirst({ where: { id: accountId, userId, isActive: true } }) : await ensureDefaultAccount(userId, db);
  if (!account) throw new Error('Conta financeira não encontrada ou inativa.');
  return db.financialMovement.upsert({ where: { userId_referenceId: { userId, referenceId: resolvedReference } }, create: { userId, accountId: account.id, type, amount, occurredAt: startOfUtcDay(occurredAt), referenceId: resolvedReference, description, principal, interest, penalty }, update: {} });
}

module.exports = { ensureDefaultAccount, listWithBalances, recordMovement, signedAmount };
