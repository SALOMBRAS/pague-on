const prisma = require('../config/database');
const HttpError = require('../utils/httpError');

const FREE_GOAL_LIMIT = 3;

const number = (value) => Number(value || 0);

async function findOwnedGoal(userId, id) {
  const goal = await prisma.goal.findFirst({ where: { id, userId } });
  if (!goal) throw new HttpError(404, 'NOT_FOUND', 'Cofrinho não encontrado.');
  return goal;
}

function withProgress(goal) {
  const current = number(goal.currentAmount);
  const target = number(goal.targetAmount);
  const remaining = Math.max(0, target - current);
  let monthlyNeeded = null;
  if (goal.targetDate) {
    const now = new Date();
    const targetDate = new Date(goal.targetDate);
    const monthsLeft = (targetDate.getUTCFullYear() - now.getUTCFullYear()) * 12 + (targetDate.getUTCMonth() - now.getUTCMonth());
    monthlyNeeded = remaining > 0 ? Math.round((remaining / Math.max(1, monthsLeft)) * 100) / 100 : 0;
  }
  return { ...goal, currentAmount: current, targetAmount: target, progress: target > 0 ? Math.round((current / target) * 100) : 0, remaining, monthlyNeeded };
}

async function listGoals(userId) {
  const goals = await prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  return goals.map(withProgress);
}

async function createGoal(userId, input) {
  if (typeof input.name !== 'string' || !input.name.trim()) throw new HttpError(400, 'INVALID_INPUT', 'Informe um nome para o cofrinho.');
  const targetAmount = number(input.targetAmount);
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) throw new HttpError(400, 'INVALID_INPUT', 'O valor alvo deve ser maior que zero.');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, _count: { select: { goals: true } } } });
  if (user?.plan === 'FREE' && user._count.goals >= FREE_GOAL_LIMIT) throw new HttpError(403, 'FREE_GOAL_LIMIT', 'No plano gratuito você pode criar até 3 cofrinhos.');
  const goal = await prisma.goal.create({
    data: {
      userId,
      name: input.name.trim(),
      icon: input.icon || null,
      color: input.color || null,
      targetAmount,
      targetDate: input.targetDate ? new Date(input.targetDate) : null,
    },
  });
  return withProgress(goal);
}

async function updateGoal(userId, id, input) {
  await findOwnedGoal(userId, id);
  const data = {};
  if (input.name !== undefined) {
    if (typeof input.name !== 'string' || !input.name.trim()) throw new HttpError(400, 'INVALID_INPUT', 'Informe um nome válido.');
    data.name = input.name.trim();
  }
  if (input.targetAmount !== undefined) {
    const targetAmount = number(input.targetAmount);
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) throw new HttpError(400, 'INVALID_INPUT', 'O valor alvo deve ser maior que zero.');
    data.targetAmount = targetAmount;
  }
  if (input.icon !== undefined) data.icon = input.icon || null;
  if (input.color !== undefined) data.color = input.color || null;
  if (input.targetDate !== undefined) data.targetDate = input.targetDate ? new Date(input.targetDate) : null;
  const goal = await prisma.goal.update({ where: { id }, data });
  return withProgress(goal);
}

async function removeGoal(userId, id) {
  await findOwnedGoal(userId, id);
  return prisma.goal.delete({ where: { id } });
}

async function deposit(userId, goalId, amount, note) {
  const value = number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new HttpError(400, 'INVALID_INPUT', 'Informe um valor de depósito válido.');
  return prisma.$transaction(async (tx) => {
    const goal = await tx.goal.findFirst({ where: { id: goalId, userId } });
    if (!goal) throw new HttpError(404, 'NOT_FOUND', 'Cofrinho não encontrado.');
    const updated = await tx.goal.update({ where: { id: goalId }, data: { currentAmount: { increment: value } } });
    await tx.goalTransaction.create({ data: { userId, goalId, type: 'DEPOSIT', amount: value, note: note || null } });
    if (number(updated.currentAmount) >= number(updated.targetAmount)) {
      const existing = await tx.notification.findFirst({ where: { userId, type: 'GOAL_REACHED', data: { path: ['goalId'], equals: goalId } } });
      if (!existing) {
        await tx.notification.create({ data: { userId, type: 'GOAL_REACHED', title: 'Meta alcançada 🎯', body: `Você atingiu a meta "${updated.name}".`, data: { goalId } } });
      }
    }
    return updated;
  }).then(withProgress);
}

async function withdraw(userId, goalId, amount, note) {
  const value = number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new HttpError(400, 'INVALID_INPUT', 'Informe um valor de resgate válido.');
  return prisma.$transaction(async (tx) => {
    const goal = await tx.goal.findFirst({ where: { id: goalId, userId } });
    if (!goal) throw new HttpError(404, 'NOT_FOUND', 'Cofrinho não encontrado.');
    if (value > number(goal.currentAmount)) throw new HttpError(400, 'INSUFFICIENT_BALANCE', 'Saldo insuficiente neste cofrinho.');
    const updated = await tx.goal.update({ where: { id: goalId }, data: { currentAmount: { decrement: value } } });
    await tx.goalTransaction.create({ data: { userId, goalId, type: 'WITHDRAW', amount: value, note: note || null } });
    return updated;
  }).then(withProgress);
}

module.exports = { findOwnedGoal, listGoals, createGoal, updateGoal, removeGoal, deposit, withdraw };
