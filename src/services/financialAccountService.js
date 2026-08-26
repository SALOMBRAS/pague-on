const crypto = require('crypto');
const prisma = require('../config/database');
const HttpError = require('../utils/httpError');
const { startOfUtcDay, endOfUtcDay } = require('../utils/dateHelpers');

const debitTypes = new Set(['LOAN_DISBURSEMENT', 'EXPENSE_PAID']);
const signedAmount = (movement) => debitTypes.has(movement.type) ? -Number(movement.amount) : Number(movement.amount);
const balanceFor = (account, movements) => Number(account.openingBalance) + movements.reduce((sum, movement) => sum + signedAmount(movement), 0);

async function ensureDefaultAccount(userId, db = prisma) {
  const existing = await db.financialAccount.findFirst({ where: { userId, isActive: true }, orderBy: { createdAt: 'asc' } });
  if (existing) return existing;
  const latestFlow = await db.cashFlow.findFirst({ where: { userId }, orderBy: { date: 'desc' }, select: { balance: true } });
  return db.financialAccount.create({ data: { userId, name: 'Caixa principal', type: 'CASH', openingBalance: Number(latestFlow?.balance || 0), includeInAvailability: true } });
}

async function listWithBalances(userId) {
  await ensureDefaultAccount(userId);
  const accounts = await prisma.financialAccount.findMany({ where: { userId }, include: { movements: { select: { type: true, amount: true } } }, orderBy: { createdAt: 'asc' } });
  return accounts.map(({ movements, ...account }) => ({ ...account, balance: balanceFor(account, movements) }));
}

async function getAccount(userId, id, db = prisma) {
  const account = await db.financialAccount.findFirst({ where: { id, userId } });
  if (!account) throw new HttpError(404, 'FINANCIAL_ACCOUNT_NOT_FOUND', 'Caixa ou conta não encontrado.');
  return account;
}

async function createAccount(userId, input) {
  return prisma.financialAccount.create({ data: { ...input, userId } });
}

async function updateAccount(userId, id, input) {
  await getAccount(userId, id);
  if (input.openingBalance !== undefined) {
    const movementCount = await prisma.financialMovement.count({ where: { accountId: id, userId } });
    if (movementCount) throw new HttpError(409, 'OPENING_BALANCE_LOCKED', 'O saldo inicial não pode ser alterado após existirem lançamentos. Use um ajuste compensatório com justificativa.');
  }
  return prisma.financialAccount.update({ where: { id }, data: input });
}

async function recordMovement({ db = prisma, userId, accountId, type, amount, occurredAt = new Date(), referenceId, description, category = null, origin = null, paymentMethod = null, customerId = null, debtId = null, collectorId = null, responsibleUserId = null, operationId = null, reversalOfId = null, principal = 0, interest = 0, penalty = 0 }) {
  const resolvedReference = referenceId || `manual:${crypto.randomUUID()}`;
  const account = accountId ? await db.financialAccount.findFirst({ where: { id: accountId, userId, isActive: true } }) : await ensureDefaultAccount(userId, db);
  if (!account) throw new HttpError(400, 'FINANCIAL_ACCOUNT_UNAVAILABLE', 'Conta financeira não encontrada ou inativa.');
  return db.financialMovement.upsert({
    where: { userId_referenceId: { userId, referenceId: resolvedReference } },
    create: { userId, accountId: account.id, type, amount, occurredAt: startOfUtcDay(occurredAt), referenceId: resolvedReference, description, category, origin, paymentMethod, customerId, debtId, collectorId, responsibleUserId, operationId, reversalOfId, principal, interest, penalty },
    update: {},
  });
}

function movementWhere(userId, query = {}) {
  const occurredAt = {};
  if (query.startDate) occurredAt.gte = startOfUtcDay(`${query.startDate}T00:00:00.000Z`);
  if (query.endDate) occurredAt.lte = endOfUtcDay(`${query.endDate}T00:00:00.000Z`);
  return {
    userId,
    ...(query.accountId ? { accountId: query.accountId } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.origin ? { origin: query.origin } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.debtId ? { debtId: query.debtId } : {}),
    ...(query.collectorId ? { collectorId: query.collectorId } : {}),
    ...(query.responsibleUserId ? { responsibleUserId: query.responsibleUserId } : {}),
    ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
    ...(Object.keys(occurredAt).length ? { occurredAt } : {}),
  };
}

async function statement(userId, query = {}) {
  const accounts = await prisma.financialAccount.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  const movements = await prisma.financialMovement.findMany({
    where: movementWhere(userId, query),
    include: { account: { select: { id: true, name: true, type: true } }, customer: { select: { id: true, name: true } }, debt: { select: { id: true, description: true } }, collector: { select: { id: true, name: true } }, responsibleUser: { select: { id: true, name: true } } },
    orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
  });
  const selectedAccounts = query.accountId ? accounts.filter((account) => account.id === query.accountId) : accounts;
  const openingByAccount = new Map(selectedAccounts.map((account) => [account.id, Number(account.openingBalance)]));
  if (query.startDate) {
    const prior = await prisma.financialMovement.groupBy({ by: ['accountId', 'type'], where: { userId, accountId: { in: selectedAccounts.map((account) => account.id) }, occurredAt: { lt: startOfUtcDay(`${query.startDate}T00:00:00.000Z`) } }, _sum: { amount: true } });
    prior.forEach((item) => openingByAccount.set(item.accountId, Number(openingByAccount.get(item.accountId) || 0) + (debitTypes.has(item.type) ? -Number(item._sum.amount || 0) : Number(item._sum.amount || 0))));
  }
  const rows = movements.map((movement) => {
    const balanceAfter = Number(openingByAccount.get(movement.accountId) || 0) + signedAmount(movement);
    openingByAccount.set(movement.accountId, balanceAfter);
    return { ...movement, direction: signedAmount(movement) < 0 ? 'DEBIT' : 'CREDIT', balanceAfter };
  }).filter((movement) => !query.direction || movement.direction === query.direction);
  return { accounts: await listWithBalances(userId), rows };
}

module.exports = { ensureDefaultAccount, listWithBalances, getAccount, createAccount, updateAccount, recordMovement, statement, signedAmount, balanceFor };
