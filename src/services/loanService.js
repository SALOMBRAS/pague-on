const crypto = require('crypto');
const prisma = require('../config/database');
const HttpError = require('../utils/httpError');
const { addDays, addMonths, startOfUtcDay } = require('../utils/dateHelpers');
const { recordMovement } = require('./financialAccountService');
const audit = require('./auditService');
const financialSettings = require('./financialSettingsService');

const DAY_INTERVALS = { DAILY: 1, WEEKLY: 7, BIWEEKLY: 14 };
const MONTH_INTERVALS = { MONTHLY: 1, BIMONTHLY: 2, QUARTERLY: 3, SEMIANNUAL: 6, ANNUAL: 12 };
const round = (value) => Number(Number(value).toFixed(2));
const dateKey = (value) => new Date(value).toISOString().slice(0, 10);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

function isNonBusinessDay(dueDate, skipSundays, holidays) { return (skipSundays && dueDate.getUTCDay() === 0) || holidays.has(dateKey(dueDate)); }

function installmentDate(firstDueDate, frequency, index, skipSundays, holidays, dueDateRule = 'NEXT_BUSINESS_DAY') {
  let dueDate = DAY_INTERVALS[frequency]
    ? addDays(firstDueDate, DAY_INTERVALS[frequency] * index)
    : addMonths(firstDueDate, (MONTH_INTERVALS[frequency] || 1) * index);
  if (dueDateRule === 'KEEP') return startOfUtcDay(dueDate);
  const direction = dueDateRule === 'PREVIOUS_BUSINESS_DAY' ? -1 : 1;
  while (isNonBusinessDay(dueDate, skipSundays, holidays)) dueDate = addDays(dueDate, direction);
  return startOfUtcDay(dueDate);
}

function splitCents(totalCents, count) {
  const base = Math.floor(totalCents / count);
  return Array.from({ length: count }, (_item, index) => (index === count - 1 ? totalCents - (base * index) : base));
}

function calculateSchedule(input, configuration) {
  const principalCents = Math.round(Number(input.principalAmount) * 100);
  const rate = Number(input.interestRate || 0) / 100;
  const holidays = new Set((configuration.holidayDates || []).map(dateKey));
  const dueAt = (index) => installmentDate(input.firstDueDate, input.frequency, index, configuration.skipSundays, holidays, configuration.dueDateRule);
  let schedule;

  if (input.modality === 'PRICE') {
    const payment = rate === 0 ? principalCents / input.totalInstallments : principalCents * ((rate * ((1 + rate) ** input.totalInstallments)) / (((1 + rate) ** input.totalInstallments) - 1));
    let remaining = principalCents;
    schedule = Array.from({ length: input.totalInstallments }, (_item, index) => {
      const interest = Math.round(remaining * rate);
      const total = index === input.totalInstallments - 1 ? remaining + interest : Math.round(payment);
      const principal = total - interest;
      remaining -= principal;
      return { number: index + 1, principal: round(principal / 100), interest: round(interest / 100), total: round(total / 100), dueDate: dueAt(index) };
    });
  } else {
    const interestCents = input.modality === 'INSTALLMENT' ? 0 : Math.round(principalCents * rate * input.totalInstallments);
    const principalParts = splitCents(principalCents, input.totalInstallments);
    const interestParts = splitCents(interestCents, input.totalInstallments);
    schedule = principalParts.map((principal, index) => ({ number: index + 1, principal: round(principal / 100), interest: round(interestParts[index] / 100), total: round((principal + interestParts[index]) / 100), dueDate: dueAt(index) }));
  }
  const totalPrincipal = round(schedule.reduce((sum, item) => sum + item.principal, 0));
  const totalInterest = round(schedule.reduce((sum, item) => sum + item.interest, 0));
  return { schedule, totalPrincipal, totalInterest, totalCost: round(totalPrincipal + totalInterest) };
}

function defaultFormulaPolicy(modality) {
  return {
    INSTALLMENT: 'Principal distribuído sem juros remuneratórios.',
    SIMPLE_INTEREST: 'Juros simples: principal × taxa por período × quantidade de parcelas.',
    PRICE: 'Tabela Price: prestação = PV × [i(1+i)^n]/[(1+i)^n−1].',
    RENEWAL: 'Renovação somente com consentimento expresso, contrato e registro do saldo remanescente.',
  }[modality];
}

async function listConfigurations(userId) {
  return prisma.loanModalityConfiguration.findMany({ where: { userId }, orderBy: { modality: 'asc' } });
}

async function saveConfiguration(userId, input) {
  return prisma.loanModalityConfiguration.upsert({
    where: { userId_modality: { userId, modality: input.modality } },
    create: { ...input, userId, formulaPolicy: input.formulaPolicy || defaultFormulaPolicy(input.modality) },
    update: { ...input, formulaPolicy: input.formulaPolicy || defaultFormulaPolicy(input.modality) },
  });
}

async function findCustomer(userId, query) {
  const term = String(query || '').trim();
  if (!term) return [];
  const customers = await prisma.customer.findMany({ where: { userId, isActive: true, OR: [{ name: { contains: term, mode: 'insensitive' } }, { nickname: { contains: term, mode: 'insensitive' } }, { cpfCnpj: { contains: term, mode: 'insensitive' } }] }, take: 30, orderBy: { name: 'asc' }, select: { id: true, name: true, nickname: true, cpfCnpj: true, phone: true, creditLimit: true, approvedInterestRate: true, status: true } });
  return customers.filter((customer) => term.length > 2 || customer.name.split(/\s+/).map((part) => part[0]).join('').toLowerCase().startsWith(term.toLowerCase()));
}

async function customerLimit(db, userId, customerId) {
  const customer = await db.customer.findFirst({ where: { id: customerId, userId, isActive: true }, select: { id: true, name: true, phone: true, status: true, creditLimit: true, approvedInterestRate: true } });
  if (!customer) throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Cliente não encontrado neste espaço.');
  if (customer.status !== 'APPROVED') throw new HttpError(409, 'CUSTOMER_PENDING_REVIEW', 'Apenas clientes aprovados podem receber empréstimos.');
  const loans = await db.debt.findMany({ where: { userId, customerId, category: 'LOAN', isActive: true, status: { not: 'CANCELLED' } }, select: { principalAmount: true, totalAmount: true, paidAmount: true } });
  const inUse = round(loans.reduce((sum, loan) => sum + Math.max(0, Number(loan.principalAmount || loan.totalAmount) - Math.min(Number(loan.paidAmount || 0), Number(loan.principalAmount || loan.totalAmount))), 0));
  const approved = Number(customer.creditLimit || 0);
  return { customer, inUse, available: round(Math.max(0, approved - inUse)) };
}

async function simulation(userId, input, options = {}) {
  const db = options.db || prisma;
  const [limit, savedConfiguration, settingVersion, holidayDates] = await Promise.all([
    customerLimit(db, userId, input.customerId),
    db.loanModalityConfiguration.findFirst({ where: { id: input.configurationId, userId, modality: input.modality, isActive: true } }),
    financialSettings.current(userId, db),
    financialSettings.activeHolidayDates(userId, db),
  ]);
  if (!savedConfiguration) throw new HttpError(409, 'LOAN_CONFIGURATION_REQUIRED', 'Selecione uma modalidade ativa e revisada juridicamente.');
  const configuration = { ...savedConfiguration, skipSundays: settingVersion.settings.skipSundays, dueDateRule: settingVersion.settings.dueDateRule, holidayDates: [...(savedConfiguration.holidayDates || []), ...holidayDates] };
  if (Number(input.principalAmount) > limit.available && input.modality !== 'RENEWAL') throw new HttpError(409, 'CREDIT_LIMIT_EXCEEDED', 'O principal solicitado ultrapassa o limite disponível do cliente.', { available: limit.available });
  const approvedRate = limit.customer.approvedInterestRate === null ? null : Number(limit.customer.approvedInterestRate);
  if (input.modality === 'SIMPLE_INTEREST' && !settingVersion.settings.simpleInterestEnabled) throw new HttpError(409, 'SIMPLE_INTEREST_DISABLED', 'Juros simples estão desativados nas configurações financeiras.');
  if (input.modality === 'PRICE' && settingVersion.version > 0 && !settingVersion.settings.compoundInterestAllowed) throw new HttpError(409, 'COMPOUND_INTEREST_NOT_ALLOWED', 'A modalidade Price exige autorização explícita para juros compostos nas configurações.');
  if (approvedRate !== null && input.interestRate !== undefined && Number(input.interestRate) !== approvedRate && !options.canOverrideRate) throw new HttpError(403, 'INTEREST_RATE_OVERRIDE_FORBIDDEN', 'Sua permissão não permite alterar a taxa aprovada.');
  if (approvedRate !== null && input.interestRate !== undefined && Number(input.interestRate) !== approvedRate && !input.rateOverrideReason) throw new HttpError(400, 'RATE_OVERRIDE_REASON_REQUIRED', 'Informe a justificativa para alterar a taxa aprovada.');
  const effectiveInput = { ...input, interestRate: input.interestRate === undefined ? (approvedRate || 0) : input.interestRate };
  const calculation = calculateSchedule(effectiveInput, configuration);
  return { customer: { id: limit.customer.id, name: limit.customer.name, approvedInterestRate: approvedRate, creditLimit: Number(limit.customer.creditLimit || 0), availableLimit: limit.available }, configuration: { id: configuration.id, displayName: configuration.displayName, formulaVersion: configuration.formulaVersion, formulaPolicy: configuration.formulaPolicy, legalReviewReference: configuration.legalReviewReference, settingsVersion: settingVersion.version, settingsSnapshot: settingVersion.settings, holidayDates: configuration.holidayDates }, input: effectiveInput, ...calculation, contractPreview: buildContractPreview(limit.customer, configuration, effectiveInput, calculation) };
}

function buildContractPreview(customer, configuration, input, calculation) {
  return `<h1>Resumo contratual de empréstimo</h1><p>Cliente: ${escapeHtml(customer.name)}</p><p>Modalidade: ${escapeHtml(configuration.displayName)} (${escapeHtml(configuration.formulaVersion)})</p><p>Principal: R$ ${calculation.totalPrincipal.toFixed(2)}. Juros: R$ ${calculation.totalInterest.toFixed(2)}. Total: R$ ${calculation.totalCost.toFixed(2)}.</p><p>Taxa por período: ${Number(input.interestRate || 0).toFixed(4)}%.</p><p>Fórmula: ${escapeHtml(configuration.formulaPolicy)}</p><p>O cliente consentiu expressamente; não há renovação ou capitalização automática.</p>`;
}

async function confirm(userId, actor, input, req = null) {
  return prisma.$transaction(async (tx) => {
    const preview = await simulation(userId, input, { db: tx, canOverrideRate: ['ADMIN', 'MANAGER'].includes(actor.role) });
    const operationId = crypto.randomUUID();
    let renewal = null;
    if (input.modality === 'RENEWAL') {
      renewal = await tx.debt.findFirst({ where: { id: input.renewalOfDebtId, userId, customerId: input.customerId, category: 'LOAN', isActive: true } });
      if (!renewal) throw new HttpError(404, 'RENEWAL_LOAN_NOT_FOUND', 'O empréstimo a renovar não está disponível para este cliente.');
    }
    const contractNumber = `EMP-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const debt = await tx.debt.create({ data: {
      userId, type: 'RECEIVABLE', paymentType: 'INSTALLMENT', category: 'LOAN', description: `Empréstimo ${preview.configuration.displayName} — ${preview.customer.name}`, counterparty: preview.customer.name, counterpartyPhone: preview.customer.phone || null, customerId: input.customerId,
      totalAmount: preview.totalCost, principalAmount: preview.totalPrincipal, appliedInterestRate: Number(preview.input.interestRate), loanModality: input.modality, loanTerms: { configurationId: preview.configuration.id, formulaVersion: preview.configuration.formulaVersion, financialSettingsVersion: preview.configuration.settingsVersion, financialSettingsSnapshot: preview.configuration.settingsSnapshot, holidayDatesSnapshot: preview.configuration.holidayDates.map(dateKey), rateOverrideReason: input.rateOverrideReason || null, notes: input.notes || null, operationId }, installmentAmount: preview.schedule[0].total, totalInstallments: input.totalInstallments, frequency: input.frequency, startDate: input.releaseDate, dueDate: preview.schedule[0].dueDate,
      installments: { create: preview.schedule.map((item) => ({ number: item.number, amount: item.principal, interestAmount: item.interest, totalAmount: item.total, dueDate: item.dueDate, interestRateAtCreation: Number(preview.input.interestRate) })) },
    }, include: { installments: { orderBy: { number: 'asc' } } } });
    await Promise.all(input.cashAllocations.map((allocation) => recordMovement({ db: tx, userId, accountId: allocation.accountId, type: 'LOAN_DISBURSEMENT', amount: allocation.amount, occurredAt: input.releaseDate, referenceId: `loan-disbursement:${debt.id}:${allocation.accountId}`, description: `Liberação ${contractNumber}`, category: 'LOAN', origin: 'LOAN_ORIGINATION', debtId: debt.id, customerId: debt.customerId, responsibleUserId: actor.id, principal: allocation.amount, operationId })));
    if (renewal && Number(input.renewalPaymentAmount || 0) > 0) {
      await recordMovement({ db: tx, userId, accountId: input.renewalPaymentCashAccountId, type: 'PAYMENT_RECEIVED', amount: input.renewalPaymentAmount, occurredAt: input.releaseDate, referenceId: `loan-renewal-payment:${debt.id}`, description: `Pagamento na renovação ${contractNumber}`, category: 'LOAN', origin: 'LOAN_RENEWAL_PAYMENT', debtId: renewal.id, customerId: debt.customerId, responsibleUserId: actor.id, principal: Math.min(Number(input.renewalPaymentAmount), Number(renewal.principalAmount || renewal.totalAmount)), operationId });
      await tx.debt.update({ where: { id: renewal.id }, data: { paidAmount: { increment: input.renewalPaymentAmount } } });
    }
    if (renewal) await tx.debt.update({ where: { id: renewal.id }, data: { status: 'CANCELLED', isActive: false } });
    const contract = await tx.loanContract.create({ data: { userId, debtId: debt.id, customerId: input.customerId, configurationId: preview.configuration.id, contractNumber, modality: input.modality, termsSnapshot: { input: preview.input, totalPrincipal: preview.totalPrincipal, totalInterest: preview.totalInterest, totalCost: preview.totalCost, schedule: preview.schedule, legalReviewReference: preview.configuration.legalReviewReference, financialSettingsVersion: preview.configuration.settingsVersion, financialSettingsSnapshot: preview.configuration.settingsSnapshot, holidayDatesSnapshot: preview.configuration.holidayDates.map(dateKey), cashAllocations: input.cashAllocations }, documentHtml: preview.contractPreview, consentedAt: new Date(), renewalOfDebtId: renewal?.id || null } });
    await tx.auditLog.create({ data: { eventType: 'loan_originated', workspaceOwnerId: userId, actorId: actor.id, actorEmailHash: audit.hash(actor.email), targetId: debt.id, targetType: 'loan', payload: audit.sanitize({ contractId: contract.id, modality: input.modality, principalAmount: preview.totalPrincipal, totalAmount: preview.totalCost, customerId: input.customerId, operationId }), ipAddress: String(req?.ip || req?.socket?.remoteAddress || '').slice(0, 64) || null, userAgent: String(req?.get?.('user-agent') || '').slice(0, 512) || null } });
    return { debt, contract, preview };
  });
}

module.exports = { calculateSchedule, listConfigurations, saveConfiguration, findCustomer, customerLimit, simulation, confirm };
