const prisma = require('../config/database');
const HttpError = require('../utils/httpError');
const { addDays, addMonths, nextDueDate, recurringPeriod, startOfUtcDay } = require('../utils/dateHelpers');
const { createNotification } = require('./notificationService');
const ruleService = require('./ruleService');
const budgetService = require('./budgetService');
const currencyService = require('./currencyService');
const goalService = require('./goalService');
const { recordMovement } = require('./financialAccountService');

const debtInclude = {
  installments: { orderBy: { number: 'asc' } },
  recurringPayments: { orderBy: { dueDate: 'desc' } },
  product: true,
  customer: true,
  sale: { include: { items: true } },
};

function amountInCents(value) {
  return Math.round(Number(value) * 100);
}

function amountFromCents(value) {
  return Number((value / 100).toFixed(2));
}

function buildInstallments(input) {
  const totalCents = amountInCents(input.totalAmount);
  const count = input.totalInstallments;
  let baseCents = input.installmentAmount ? amountInCents(input.installmentAmount) : Math.floor(totalCents / count);
  if (baseCents <= 0) throw new HttpError(400, 'INVALID_INSTALLMENT', 'O valor da parcela deve ser maior que zero.');
  if (input.installmentAmount && Math.abs((baseCents * count) - totalCents) > 1) {
    throw new HttpError(400, 'INVALID_INSTALLMENT', 'O valor das parcelas deve somar o valor total.');
  }
  const values = [];
  let remaining = totalCents;
  const dayIntervals = { WEEKLY: 7, BIWEEKLY: 14 };
  const monthIntervals = { MONTHLY: 1, BIMONTHLY: 2, QUARTERLY: 3, SEMIANNUAL: 6, ANNUAL: 12 };
  const frequency = input.frequency || 'MONTHLY';
  for (let index = 0; index < count; index += 1) {
    const cents = index === count - 1 ? remaining : baseCents;
    const dueDate = dayIntervals[frequency]
      ? addDays(input.startDate, dayIntervals[frequency] * index)
      : addMonths(input.startDate, (monthIntervals[frequency] || 1) * index);
    values.push({ number: index + 1, amount: amountFromCents(cents), dueDate: new Date(dueDate) });
    remaining -= cents;
  }
  return values;
}

async function assertOwnedProduct(db, userId, productId) {
  if (!productId) return;
  const product = await db.product.findFirst({ where: { id: productId, userId, isActive: true } });
  if (!product) throw new HttpError(400, 'INVALID_PRODUCT', 'O produto vinculado não existe ou está inativo.');
}

async function resolveCounterparty(db, userId, input) {
  if (!input.customerId) return { counterparty: input.counterparty, counterpartyPhone: input.counterpartyPhone || null };
  const customer = await db.customer.findFirst({ where: { id: input.customerId, userId, isActive: true } });
  if (!customer) throw new HttpError(400, 'INVALID_CUSTOMER', 'O cliente selecionado não existe ou está inativo.');
  return {
    counterparty: input.counterparty || customer.name,
    counterpartyPhone: input.counterpartyPhone === undefined ? customer.phone : input.counterpartyPhone,
  };
}

function normalizeDebtInput(input) {
  const output = { ...input };
  if (output.paymentType !== 'INSTALLMENT') {
    output.installmentAmount = null;
    output.totalInstallments = null;
  }
  if (output.paymentType !== 'RECURRING') {
    output.frequency = null;
    output.endDate = null;
    output.repeatCount = null;
  }
  return output;
}

async function createDebt(userId, input) {
  const { allowDuplicate: _allowDuplicate, ...debtInput } = input;
  const convertedInput = await currencyService.convertDebtInput(debtInput);
  const ruleResult = await ruleService.applyToDebtInput(userId, convertedInput);
  const data = normalizeDebtInput(ruleResult.input);
  await assertOwnedProduct(prisma, userId, data.productId);
  const installments = data.paymentType === 'INSTALLMENT' ? buildInstallments(data) : [];
  const dueDate = installments[0]?.dueDate || data.startDate;

  const debt = await prisma.$transaction(async (tx) => {
    const counterparty = await resolveCounterparty(tx, userId, data);
    const debt = await tx.debt.create({
      data: {
        ...data,
        ...counterparty,
        userId,
        dueDate,
        installmentAmount: installments[0]?.amount ?? data.installmentAmount,
        installments: installments.length ? { create: installments } : undefined,
        recurringPayments: data.paymentType === 'RECURRING'
          ? { create: { period: recurringPeriod(dueDate, data.frequency), dueDate, amount: data.totalAmount } }
          : undefined,
      },
      include: debtInclude,
    });
    if (debt.type === 'RECEIVABLE' && debt.category === 'LOAN') {
      await recordMovement({ db: tx, userId, type: 'LOAN_DISBURSEMENT', amount: debt.totalAmount, occurredAt: debt.startDate, referenceId: `loan-disbursement:${debt.id}`, description: `Liberação: ${debt.description}`, principal: debt.totalAmount });
    }
    return debt;
  });
  await ruleService.recordApplications(userId, debt, ruleResult.applications);
  await budgetService.syncBudgetForDebt(userId, debt);
  return { ...debt, appliedRules: ruleResult.applications.map((application) => application.name) };
}

async function refreshOverdues(userId) {
  const today = startOfUtcDay();
  await prisma.$transaction([
    prisma.installment.updateMany({
      where: { debt: { userId }, status: 'PENDING', dueDate: { lt: today } },
      data: { status: 'OVERDUE' },
    }),
    prisma.recurringPayment.updateMany({
      where: { debt: { userId }, status: 'PENDING', dueDate: { lt: today } },
      data: { status: 'OVERDUE' },
    }),
    prisma.debt.updateMany({
      where: { userId, isActive: true, status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: today } },
      data: { status: 'OVERDUE' },
    }),
  ]);
}

async function findDebt(userId, id, include = debtInclude) {
  const query = { where: { id, userId } };
  if (include) query.include = include;
  const debt = await prisma.debt.findFirst(query);
  if (!debt) throw new HttpError(404, 'DEBT_NOT_FOUND', 'Dívida não encontrada.');
  return debt;
}

async function listDebts(userId, query) {
  await refreshOverdues(userId);
  const where = { userId };
  if (query.type) where.type = query.type;
  if (query.status) where.status = query.status;
  if (query.paymentType) where.paymentType = query.paymentType;
  if (query.search) where.OR = [
    { counterparty: { contains: query.search, mode: 'insensitive' } },
    { description: { contains: query.search, mode: 'insensitive' } },
  ];
  return prisma.debt.findMany({ where, include: debtInclude, orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }] });
}

async function updateDebt(userId, id, patch) {
  const current = await findDebt(userId, id);
  if (current.installments.some((item) => item.paidAt) || current.recurringPayments.some((item) => item.paidAt)) {
    throw new HttpError(409, 'DEBT_HAS_PAYMENTS', 'Não é possível editar uma dívida com pagamentos registrados.');
  }
  if (current.paidAt) throw new HttpError(409, 'DEBT_HAS_PAYMENTS', 'Não é possível editar uma dívida já paga.');
  const baseData = {
    ...current,
    ...patch,
    totalAmount: patch.totalAmount ?? Number(current.totalAmount),
    startDate: patch.startDate ?? current.startDate,
    productId: patch.productId === undefined ? current.productId : patch.productId,
  };
  const ruleResult = await ruleService.applyToDebtInput(userId, baseData);
  const data = normalizeDebtInput(ruleResult.input);
  await assertOwnedProduct(prisma, userId, data.productId);
  const installments = data.paymentType === 'INSTALLMENT' ? buildInstallments(data) : [];
  const dueDate = installments[0]?.dueDate || data.startDate;

  const debt = await prisma.$transaction(async (tx) => {
    const counterparty = await resolveCounterparty(tx, userId, data);
    await tx.installment.deleteMany({ where: { debtId: id } });
    await tx.recurringPayment.deleteMany({ where: { debtId: id } });
    return tx.debt.update({
      where: { id },
      data: {
        type: data.type,
        paymentType: data.paymentType,
        description: data.description,
        category: data.category,
        ...counterparty,
        totalAmount: data.totalAmount,
        installmentAmount: installments[0]?.amount ?? data.installmentAmount,
        totalInstallments: data.totalInstallments,
        frequency: data.frequency,
        startDate: data.startDate,
        dueDate,
        endDate: data.endDate,
        repeatCount: data.repeatCount,
        productId: data.productId,
        quantity: data.quantity,
        tags: data.tags || [],
        status: 'PENDING',
        isActive: true,
        installments: installments.length ? { create: installments } : undefined,
        recurringPayments: data.paymentType === 'RECURRING'
          ? { create: { period: recurringPeriod(dueDate, data.frequency), dueDate, amount: data.totalAmount } }
          : undefined,
      },
      include: debtInclude,
    });
  });
  await ruleService.recordApplications(userId, debt, ruleResult.applications);
  await budgetService.syncBudgetForDebt(userId, current);
  await budgetService.syncBudgetForDebt(userId, debt);
  return { ...debt, appliedRules: ruleResult.applications.map((application) => application.name) };
}

async function deleteDebt(userId, id) {
  const debt = await findDebt(userId, id, false);
  await prisma.debt.delete({ where: { id } });
  if (debt.type === 'PAYABLE') { const due = new Date(debt.dueDate); await budgetService.refreshBudget(userId, debt.category, due.getUTCMonth() + 1, due.getUTCFullYear()); }
  return { id };
}

async function updateDailyCashFlow(tx, userId, type, amount, paidAt = new Date()) {
  const value = Number(amount);
  const date = startOfUtcDay(paidAt);
  const existing = await tx.cashFlow.findUnique({ where: { userId_date: { userId, date } } });
  const totalIn = Number(existing?.totalIn || 0) + (type === 'RECEIVABLE' ? value : 0);
  const totalOut = Number(existing?.totalOut || 0) + (type === 'PAYABLE' ? value : 0);
  return tx.cashFlow.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, totalIn, totalOut, balance: totalIn - totalOut },
    update: { totalIn, totalOut, balance: totalIn - totalOut },
  });
}

async function updateLinkedSalePayment(tx, debt, amount, debtStatus) {
  if (!debt.saleId) return;
  const sale = await tx.sale.update({
    where: { id: debt.saleId },
    data: { paidAmount: { increment: amount } },
  });
  const paidAmount = Number(sale.paidAmount);
  const totalAmount = Number(sale.totalAmount);
  const status = debtStatus === 'PAID' || paidAmount >= totalAmount ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'PENDING';
  await tx.sale.update({ where: { id: sale.id }, data: { status } });
}

async function paySingleDebt(userId, id, paidAmount, goalId) {
  return prisma.$transaction(async (tx) => {
    const debt = await tx.debt.findFirst({ where: { id, userId } });
    if (!debt) throw new HttpError(404, 'DEBT_NOT_FOUND', 'Dívida não encontrada.');
    if (debt.paymentType !== 'SINGLE') throw new HttpError(400, 'INVALID_PAYMENT_TYPE', 'Use a rota de parcela ou recorrência para esta dívida.');
    if (debt.status === 'PAID' || debt.status === 'CANCELLED') throw new HttpError(409, 'DEBT_UNAVAILABLE', 'Esta dívida não pode mais ser paga.');
    const now = new Date();
    const remaining = Number(debt.totalAmount) - Number(debt.paidAmount);
    const amount = paidAmount ?? remaining;
    if (amount > remaining) throw new HttpError(400, 'PAYMENT_EXCEEDS_BALANCE', 'O pagamento não pode ser maior que o saldo pendente.');
    const newPaidAmount = Number((Number(debt.paidAmount) + amount).toFixed(2));
    const isComplete = newPaidAmount >= Number(debt.totalAmount);
    const status = isComplete ? 'PAID' : 'PARTIAL';
    const updated = await tx.debt.update({
      where: { id },
      data: { status, isActive: !isComplete, paidAt: isComplete ? now : null, paidAmount: newPaidAmount },
    });
    await updateDailyCashFlow(tx, userId, debt.type, amount, now);
    await recordMovement({ db: tx, userId, type: debt.type === 'RECEIVABLE' ? 'PAYMENT_RECEIVED' : 'EXPENSE_PAID', amount, occurredAt: now, referenceId: `debt-payment:${debt.id}:${now.toISOString()}`, description: `Pagamento: ${debt.description}`, principal: debt.category === 'LOAN' ? amount : 0 });
    await updateLinkedSalePayment(tx, debt, amount, status);
    await createNotification(tx, userId, {
      title: 'Pagamento registrado',
      body: `${debt.description} foi marcado como pago.`,
      type: 'PAYMENT_RECEIVED',
      data: { debtId: debt.id },
    });
    return updated;
  }).then((debt) => {
    if (debt.type === 'RECEIVABLE' && debt.status === 'PAID' && goalId) {
      goalService.deposit(userId, goalId, amount).catch((error) => console.warn('Falha ao depositar na meta:', error.message));
    }
    return debt;
  });
}

async function payInstallment(userId, debtId, installmentId, paidAmount) {
  return prisma.$transaction(async (tx) => {
    const debt = await tx.debt.findFirst({ where: { id: debtId, userId }, include: { installments: true } });
    if (!debt) throw new HttpError(404, 'DEBT_NOT_FOUND', 'Dívida não encontrada.');
    if (debt.paymentType !== 'INSTALLMENT') throw new HttpError(400, 'INVALID_PAYMENT_TYPE', 'Esta dívida não é parcelada.');
    const installment = debt.installments.find((item) => item.id === installmentId);
    if (!installment) throw new HttpError(404, 'INSTALLMENT_NOT_FOUND', 'Parcela não encontrada.');
    if (installment.status === 'PAID') throw new HttpError(409, 'INSTALLMENT_PAID', 'Esta parcela já foi paga.');
    const now = new Date();
    const amount = paidAmount ?? Number(installment.amount);
    await tx.installment.update({ where: { id: installmentId }, data: { status: 'PAID', paidAt: now, paidAmount: amount } });
    const pending = debt.installments.filter((item) => item.id !== installmentId && item.status !== 'PAID').sort((a, b) => a.dueDate - b.dueDate);
    const paidCount = debt.paidInstallments + 1;
    const isComplete = pending.length === 0;
    const updated = await tx.debt.update({
      where: { id: debtId },
      data: {
        paidInstallments: paidCount,
        paidAmount: { increment: amount },
        dueDate: pending[0]?.dueDate ?? debt.dueDate,
        status: isComplete ? 'PAID' : 'PENDING',
        isActive: !isComplete,
        paidAt: isComplete ? now : null,
      },
      include: debtInclude,
    });
    await updateDailyCashFlow(tx, userId, debt.type, amount, now);
    const principal = Math.min(amount, Number(installment.amount));
    await recordMovement({ db: tx, userId, type: debt.type === 'RECEIVABLE' ? 'PAYMENT_RECEIVED' : 'EXPENSE_PAID', amount, occurredAt: now, referenceId: `installment-payment:${installment.id}:${now.toISOString()}`, description: `Parcela ${installment.number}: ${debt.description}`, principal: debt.category === 'LOAN' ? principal : 0, interest: debt.category === 'LOAN' ? Math.max(0, amount - principal) : 0 });
    await updateLinkedSalePayment(tx, debt, amount, isComplete ? 'PAID' : 'PENDING');
    await createNotification(tx, userId, {
      title: 'Parcela registrada',
      body: `${installment.number}ª parcela de ${debt.description} marcada como paga.`,
      type: 'PAYMENT_RECEIVED',
      data: { debtId, installmentId },
    });
    return updated;
  });
}

async function payRecurringDebt(userId, id, paidAmount) {
  return prisma.$transaction(async (tx) => {
    const debt = await tx.debt.findFirst({
      where: { id, userId },
      include: { recurringPayments: { orderBy: { dueDate: 'asc' } } },
    });
    if (!debt) throw new HttpError(404, 'DEBT_NOT_FOUND', 'Dívida não encontrada.');
    if (debt.paymentType !== 'RECURRING') throw new HttpError(400, 'INVALID_PAYMENT_TYPE', 'Esta dívida não é recorrente.');
    if (!debt.isActive) throw new HttpError(409, 'DEBT_UNAVAILABLE', 'Esta recorrência está cancelada ou concluída.');
    const current = debt.recurringPayments.find((payment) => payment.status !== 'PAID');
    if (!current) throw new HttpError(409, 'RECURRING_UNAVAILABLE', 'Não há um período pendente para pagar.');
    const now = new Date();
    const amount = paidAmount ?? Number(debt.totalAmount);
    await tx.recurringPayment.update({ where: { id: current.id }, data: { status: 'PAID', paidAt: now, amount } });
    const nextDate = nextDueDate(current.dueDate, debt.frequency);
    const remainingRepeats = debt.repeatCount === null ? null : debt.repeatCount - 1;
    const shouldEnd = remainingRepeats === 0 || (debt.endDate && nextDate > debt.endDate);
    const updated = await tx.debt.update({
      where: { id },
      data: {
        repeatCount: remainingRepeats,
        dueDate: shouldEnd ? current.dueDate : nextDate,
        status: shouldEnd ? 'PAID' : 'PENDING',
        isActive: !shouldEnd,
        paidAt: shouldEnd ? now : null,
        recurringPayments: !shouldEnd
          ? { create: { period: recurringPeriod(nextDate, debt.frequency), dueDate: nextDate, amount: debt.totalAmount } }
          : undefined,
      },
      include: debtInclude,
    });
    await updateDailyCashFlow(tx, userId, debt.type, amount, now);
    await recordMovement({ db: tx, userId, type: debt.type === 'RECEIVABLE' ? 'PAYMENT_RECEIVED' : 'EXPENSE_PAID', amount, occurredAt: now, referenceId: `recurring-payment:${current.id}:${now.toISOString()}`, description: `Pagamento recorrente: ${debt.description}` });
    await updateLinkedSalePayment(tx, debt, amount, shouldEnd ? 'PAID' : 'PENDING');
    await createNotification(tx, userId, {
      title: 'Pagamento recorrente registrado',
      body: `${debt.description} foi marcado como pago neste período.`,
      type: 'PAYMENT_RECEIVED',
      data: { debtId: id, recurringPaymentId: current.id },
    });
    return updated;
  });
}

async function payDebt(userId, id, paidAmount, goalId) {
  const debt = await findDebt(userId, id, false);
  if (debt.paymentType === 'INSTALLMENT') {
    const next = await prisma.installment.findFirst({ where: { debtId: id, status: { in: ['PENDING', 'OVERDUE'] } }, orderBy: { dueDate: 'asc' } });
    if (!next) throw new HttpError(409, 'INSTALLMENT_UNAVAILABLE', 'Não há parcela pendente para pagar.');
    return payInstallment(userId, id, next.id, paidAmount);
  }
  if (debt.paymentType === 'RECURRING') return payRecurringDebt(userId, id, paidAmount);
  return paySingleDebt(userId, id, paidAmount, goalId);
}

async function cancelRecurringDebt(userId, id) {
  const debt = await findDebt(userId, id, false);
  if (debt.paymentType !== 'RECURRING') throw new HttpError(400, 'NOT_RECURRING', 'Apenas dívidas recorrentes podem ser canceladas.');
  if (!debt.isActive) throw new HttpError(409, 'DEBT_UNAVAILABLE', 'Esta recorrência já está inativa.');
  return prisma.debt.update({ where: { id }, data: { isActive: false, status: 'CANCELLED' } });
}

async function createCollection(user, debt) {
  const amount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: user.currency || 'BRL' }).format(Number(debt.totalAmount));
  const dueDate = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(debt.dueDate);
  const defaultMessage = `Olá [counterparty], tudo bem?\n\nPassando pra lembrar que o pagamento de [description] no valor de [amount] vence em [dueDate].\n\nPode me confirmar o pagamento?\n\nAtt, [user.name]`;
  const replacements = {
    counterparty: debt.counterparty,
    description: debt.description,
    amount,
    dueDate,
    'user.name': user.name,
  };
  let message = user.defaultMessage || defaultMessage;
  Object.entries(replacements).forEach(([key, value]) => {
    message = message.replaceAll(`[${key}]`, value).replaceAll(`{{${key}}}`, value);
  });
  const phone = (debt.counterpartyPhone || '').replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  await prisma.reminder.create({
    data: { userId: user.id, debtId: debt.id, type: 'PUSH', status: 'SENT', sentAt: new Date(), scheduledAt: new Date(), message },
  });
  return {
    message,
    whatsappLink: phone ? `https://wa.me/55${phone}?text=${encodedMessage}` : null,
    smsLink: phone ? `sms:${phone}?body=${encodedMessage}` : null,
  };
}

module.exports = {
  debtInclude,
  refreshOverdues,
  findDebt,
  listDebts,
  createDebt,
  updateDebt,
  deleteDebt,
  payDebt,
  payInstallment,
  cancelRecurringDebt,
  createCollection,
  updateDailyCashFlow,
  buildInstallments,
};
