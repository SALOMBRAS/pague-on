const prisma = require('../config/database');
const HttpError = require('../utils/httpError');
const { createNotification } = require('./notificationService');

function period(month, year) {
  const start = new Date(Date.UTC(year, month - 1, 1)); const end = new Date(Date.UTC(year, month, 1)); return { start, end };
}
function previousPeriod(month, year) { return month === 1 ? { month: 12, year: year - 1 } : { month: month - 1, year }; }
function budgetSpend(debt) {
  if (debt.paymentType === 'INSTALLMENT') return Number(debt.installmentAmount || 0);
  return Number(debt.totalAmount || 0);
}
function effectiveLimit(budget, previous) {
  const carryover = previous?.rollover ? Math.max(0, Number(previous.limitAmount) - Number(previous.spentAmount)) : 0;
  return Number((Number(budget.limitAmount) + carryover).toFixed(2));
}
function statusFor(percent, alertAt) { return percent >= 100 ? 'EXCEEDED' : percent >= alertAt ? 'ALERT' : 'OK'; }

async function refreshBudget(userId, category, month, year, db = prisma) {
  const budget = await db.budget.findUnique({ where: { userId_category_month_year: { userId, category, month, year } } });
  if (!budget) return null;
  const { start, end } = period(month, year);
  const debts = await db.debt.findMany({ where: { userId, type: 'PAYABLE', category, status: { not: 'CANCELLED' }, dueDate: { gte: start, lt: end } }, select: { paymentType: true, totalAmount: true, installmentAmount: true } });
  const spentAmount = Number(debts.reduce((sum, debt) => sum + budgetSpend(debt), 0).toFixed(2));
  const previousInfo = previousPeriod(month, year);
  const previous = await db.budget.findUnique({ where: { userId_category_month_year: { userId, category, ...previousInfo } } });
  const limit = effectiveLimit(budget, previous); const wasPercent = Number(budget.limitAmount) ? Number(budget.spentAmount) / limit * 100 : 0; const percent = limit ? spentAmount / limit * 100 : 0;
  const updated = await db.budget.update({ where: { id: budget.id }, data: { spentAmount } });
  const crossedAlert = wasPercent < budget.alertAt && percent >= budget.alertAt && percent < 100;
  const crossedLimit = wasPercent < 100 && percent >= 100;
  if (crossedAlert || crossedLimit) await createNotification(db, userId, { title: crossedLimit ? 'Orçamento ultrapassado' : 'Orçamento perto do limite', body: crossedLimit ? `${category}: você ultrapassou o limite mensal.` : `${category}: você atingiu ${Math.round(percent)}% do orçamento.`, type: crossedLimit ? 'BUDGET_EXCEEDED' : 'BUDGET_ALERT', data: { budgetId: budget.id, category, month, year, percent: Number(percent.toFixed(2)) } });
  return { ...updated, effectiveLimit: limit, carryover: Number((limit - Number(budget.limitAmount)).toFixed(2)), percent: Number(percent.toFixed(2)), status: statusFor(percent, budget.alertAt) };
}

async function syncBudgetForDebt(userId, debt, db = prisma) {
  if (!debt || debt.type !== 'PAYABLE' || debt.status === 'CANCELLED') return null;
  const dueDate = new Date(debt.dueDate); return refreshBudget(userId, debt.category, dueDate.getUTCMonth() + 1, dueDate.getUTCFullYear(), db);
}

async function listBudgets(userId, query) {
  const month = query.month; const year = query.year;
  const budgets = await prisma.budget.findMany({ where: { userId, month, year }, orderBy: { category: 'asc' } });
  const refreshed = await Promise.all(budgets.map((budget) => refreshBudget(userId, budget.category, month, year)));
  const items = refreshed.filter(Boolean);
  const totalLimit = items.reduce((sum, item) => sum + item.effectiveLimit, 0); const totalSpent = items.reduce((sum, item) => sum + Number(item.spentAmount), 0);
  return { month, year, totalLimit: Number(totalLimit.toFixed(2)), totalSpent: Number(totalSpent.toFixed(2)), available: Number((totalLimit - totalSpent).toFixed(2)), items };
}

async function upsertBudget(userId, input) {
  const budget = await prisma.budget.upsert({ where: { userId_category_month_year: { userId, category: input.category, month: input.month, year: input.year } }, create: { userId, ...input, spentAmount: 0 }, update: { limitAmount: input.limitAmount, rollover: input.rollover, alertAt: input.alertAt } });
  return refreshBudget(userId, budget.category, budget.month, budget.year);
}
async function updateBudget(userId, id, patch) {
  const current = await prisma.budget.findFirst({ where: { id, userId } }); if (!current) throw new HttpError(404, 'BUDGET_NOT_FOUND', 'Orçamento não encontrado.');
  const updated = await prisma.budget.update({ where: { id }, data: patch }); return refreshBudget(userId, updated.category, updated.month, updated.year);
}
async function removeBudget(userId, id) { const found = await prisma.budget.findFirst({ where: { id, userId } }); if (!found) throw new HttpError(404, 'BUDGET_NOT_FOUND', 'Orçamento não encontrado.'); await prisma.budget.delete({ where: { id } }); return { id }; }

module.exports = { effectiveLimit, refreshBudget, syncBudgetForDebt, listBudgets, upsertBudget, updateBudget, removeBudget };
