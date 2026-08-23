const prisma = require('../config/database');
const HttpError = require('../utils/httpError');

const ruleInclude = { triggers: true, actions: true };
const numericTriggers = new Set(['AMOUNT_EXACTLY', 'AMOUNT_GREATER_THAN', 'AMOUNT_LESS_THAN']);

function normalized(value) { return String(value ?? '').trim().toLocaleLowerCase('pt-BR'); }

function fieldValue(triggerType, debt) {
  const map = {
    DESCRIPTION_CONTAINS: debt.description,
    DESCRIPTION_STARTS_WITH: debt.description,
    DESCRIPTION_IS: debt.description,
    AMOUNT_EXACTLY: debt.totalAmount,
    AMOUNT_GREATER_THAN: debt.totalAmount,
    AMOUNT_LESS_THAN: debt.totalAmount,
    COUNTERPARTY_IS: debt.counterparty,
    COUNTERPARTY_CONTAINS: debt.counterparty,
    CATEGORY_IS: debt.category,
    TYPE_IS: debt.type,
  };
  return map[triggerType];
}

function matchesTrigger(trigger, debt) {
  const actual = fieldValue(trigger.type, debt);
  if (numericTriggers.has(trigger.type)) {
    const left = Number(actual); const right = Number(trigger.value);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    if (trigger.operator === 'GREATER_THAN') return left > right;
    if (trigger.operator === 'LESS_THAN') return left < right;
    return left === right;
  }
  const left = normalized(actual); const right = normalized(trigger.value);
  if (trigger.operator === 'CONTAINS') return left.includes(right);
  if (trigger.operator === 'STARTS_WITH') return left.startsWith(right);
  return left === right;
}

function matchesRule(rule, debt) {
  const results = rule.triggers.map((trigger) => ({ trigger, matched: matchesTrigger(trigger, debt) }));
  return { matched: rule.triggerLogic === 'ANY' ? results.some((item) => item.matched) : results.every((item) => item.matched), results };
}

function applyAction(input, action) {
  const next = { ...input, tags: [...new Set(input.tags || [])] };
  switch (action.type) {
    case 'SET_CATEGORY': next.category = action.value; break;
    case 'SET_TYPE': next.type = action.value; break;
    case 'SET_COUNTERPARTY': next.counterparty = action.value; break;
    case 'ADD_TAG': if (!next.tags.includes(action.value)) next.tags.push(action.value); break;
    case 'SET_PAYMENT_TYPE':
      next.paymentType = action.value;
      if (action.value === 'RECURRING') {
        next.frequency = next.frequency || 'MONTHLY';
        next.installmentAmount = null;
        next.totalInstallments = null;
      }
      if (action.value === 'SINGLE') {
        next.frequency = null;
        next.installmentAmount = null;
        next.totalInstallments = null;
      }
      break;
    default: break;
  }
  return next;
}

async function activeRules(userId) {
  return prisma.rule.findMany({ where: { userId, isActive: true }, include: ruleInclude, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] });
}

async function applyToDebtInput(userId, input, selectedRules) {
  const rules = selectedRules || await activeRules(userId);
  let value = { ...input, tags: [...new Set(input.tags || [])] };
  const applications = [];
  for (const rule of rules) {
    const evaluation = matchesRule(rule, value);
    if (!evaluation.matched) continue;
    const appliedActions = [];
    for (const action of rule.actions) {
      value = applyAction(value, action);
      appliedActions.push({ type: action.type, value: action.value });
    }
    applications.push({ ruleId: rule.id, name: rule.name, actions: appliedActions, matchedTriggers: evaluation.results.filter((item) => item.matched).map((item) => item.trigger.type) });
  }
  return { input: value, applications };
}

async function recordApplications(userId, debt, applications, includeSideEffects = true) {
  for (const application of applications) {
    const existing = await prisma.ruleExecution.findFirst({ where: { userId, debtId: debt.id, ruleId: application.ruleId } });
    if (existing) continue;
    await prisma.ruleExecution.create({ data: { userId, debtId: debt.id, ruleId: application.ruleId, actionsApplied: application.actions } });
    if (!includeSideEffects) continue;
    for (const action of application.actions) {
      if (action.type === 'SET_REMINDER') {
        const scheduledAt = new Date(debt.dueDate);
        scheduledAt.setDate(scheduledAt.getDate() - Number(action.value));
        await prisma.reminder.create({ data: { userId, debtId: debt.id, scheduledAt, message: `Regra automática: ${debt.description} vence em ${action.value} dia(s).` } });
      }
      if (action.type === 'SEND_NOTIFICATION') {
        await prisma.notification.create({ data: { userId, title: 'Regra automática aplicada', body: action.value, type: 'RULE_APPLIED', data: { debtId: debt.id, ruleId: application.ruleId } } });
      }
    }
  }
}

async function listRules(userId) { return prisma.rule.findMany({ where: { userId }, include: ruleInclude, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }); }
async function findRule(userId, id) { const rule = await prisma.rule.findFirst({ where: { id, userId }, include: ruleInclude }); if (!rule) throw new HttpError(404, 'RULE_NOT_FOUND', 'Regra não encontrada.'); return rule; }
async function createRule(userId, input) { return prisma.rule.create({ data: { name: input.name, order: input.order, isActive: input.isActive, triggerLogic: input.triggerLogic, userId, triggers: { create: input.triggers }, actions: { create: input.actions } }, include: ruleInclude }); }
async function updateRule(userId, id, input) {
  await findRule(userId, id);
  return prisma.$transaction(async (tx) => {
    if (input.triggers) await tx.ruleTrigger.deleteMany({ where: { ruleId: id } });
    if (input.actions) await tx.ruleAction.deleteMany({ where: { ruleId: id } });
    return tx.rule.update({ where: { id }, data: { name: input.name, order: input.order, isActive: input.isActive, triggerLogic: input.triggerLogic, triggers: input.triggers ? { create: input.triggers } : undefined, actions: input.actions ? { create: input.actions } : undefined }, include: ruleInclude });
  });
}
async function deleteRule(userId, id) { await findRule(userId, id); await prisma.rule.delete({ where: { id } }); return { id }; }
async function previewRule(userId, id, debtId) {
  const [rule, debt] = await Promise.all([findRule(userId, id), prisma.debt.findFirst({ where: { id: debtId, userId } })]);
  if (!debt) throw new HttpError(404, 'DEBT_NOT_FOUND', 'Dívida não encontrada.');
  const evaluation = matchesRule(rule, debt);
  const preview = evaluation.matched ? (await applyToDebtInput(userId, debt, [rule])).input : debt;
  return { wouldApply: evaluation.matched, matchedTriggers: evaluation.results.filter((item) => item.matched).map((item) => item.trigger.type), wouldExecuteActions: rule.actions, preview: { current: debt, after: preview } };
}
async function runAll(userId) {
  const [rules, debts] = await Promise.all([activeRules(userId), prisma.debt.findMany({ where: { userId, isActive: true } })]);
  let changed = 0;
  for (const debt of debts) {
    const result = await applyToDebtInput(userId, debt, rules);
    const safe = { category: result.input.category, type: result.input.type, counterparty: result.input.counterparty, tags: result.input.tags };
    if (safe.category !== debt.category || safe.type !== debt.type || safe.counterparty !== debt.counterparty || JSON.stringify(safe.tags) !== JSON.stringify(debt.tags)) { await prisma.debt.update({ where: { id: debt.id }, data: safe }); changed += 1; }
    await recordApplications(userId, debt, result.applications, false);
  }
  return { processed: debts.length, changed };
}

module.exports = { applyToDebtInput, recordApplications, listRules, findRule, createRule, updateRule, deleteRule, previewRule, runAll };
