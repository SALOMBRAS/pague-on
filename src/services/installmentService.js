const prisma = require('../config/database');
const HttpError = require('../utils/httpError');
const { createNotification } = require('./notificationService');
const { recalculateSaleInterest } = require('./interestCalculator');
const { saleInclude } = require('./saleService');
const { updateDailyCashFlow } = require('./debtService');
const { recordMovement } = require('./financialAccountService');

function round(value) { return Number(Number(value || 0).toFixed(2)); }
const installmentInclude = { debt: { include: { sale: true, customer: true, installments: { orderBy: { number: 'asc' } } } } };

function scopedDebt(userId, scope = {}) {
  const customer = scope.role === 'COLLECTOR' ? { collectorId: scope.actorId } : scope.role === 'CLIENT' ? { id: scope.customerId || '__forbidden__' } : undefined;
  return { userId, ...(customer ? { customer } : {}) };
}

async function ownedInstallment(userId, id, scope = {}) {
  const installment = await prisma.installment.findFirst({ where: { id, debt: scopedDebt(userId, scope) }, include: installmentInclude });
  if (!installment) throw new HttpError(404, 'INSTALLMENT_NOT_FOUND', 'Parcela não encontrada.');
  if (!installment.debt.sale) throw new HttpError(409, 'SALE_NOT_FOUND', 'Esta parcela não pertence a uma venda.');
  return installment;
}

async function syncSaleAndDebt(tx, debtId) {
  const debt = await tx.debt.findUnique({ where: { id: debtId }, include: { installments: { orderBy: { dueDate: 'asc' } }, sale: true } });
  const paidAmount = round(debt.installments.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0));
  const totalDue = round(debt.installments.reduce((sum, item) => sum + Number(item.totalAmount || item.amount), 0));
  const unpaid = debt.installments.filter((item) => item.status !== 'PAID');
  const paidCount = debt.installments.filter((item) => item.status === 'PAID').length;
  const status = unpaid.length === 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'PENDING';
  await tx.debt.update({ where: { id: debt.id }, data: { paidAmount, paidInstallments: paidCount, dueDate: unpaid[0]?.dueDate || debt.dueDate, status, isActive: status !== 'PAID', paidAt: status === 'PAID' ? new Date() : null } });
  if (debt.sale) await tx.sale.update({ where: { id: debt.sale.id }, data: { paidAmount, remainingAmount: Math.max(0, round(totalDue - paidAmount)), status } });
  return { status, paidAmount, remainingAmount: Math.max(0, round(totalDue - paidAmount)), paidInstallments: paidCount, pendingInstallments: unpaid.length };
}

async function payInstallment(userId, id, input) {
  let current = await ownedInstallment(userId, id);
  await recalculateSaleInterest(current.debt.sale.id);
  current = await ownedInstallment(userId, id);
  if (current.status === 'PAID') throw new HttpError(409, 'INSTALLMENT_PAID', 'Esta parcela já foi paga.');
  const totalDue = Number(current.totalAmount || current.amount); const alreadyPaid = Number(current.paidAmount || 0);
  const value = round(input.paidAmount ?? totalDue - alreadyPaid);
  if (value <= 0 || value > totalDue - alreadyPaid + 0.01) throw new HttpError(400, 'INVALID_PAYMENT', 'Informe um valor de pagamento válido.');
  return prisma.$transaction(async (tx) => {
    const paidAmount = round(alreadyPaid + value); const isPaid = paidAmount >= totalDue - 0.01;
    const paidAt = input.paymentDate || new Date();
    await tx.installment.update({ where: { id }, data: { paidAmount, paidAt, paymentMethod: input.paymentMethod || null, note: input.note || null, status: isPaid ? 'PAID' : 'PARTIAL' } });
    const summary = await syncSaleAndDebt(tx, current.debtId);
    const principalBefore = Math.min(alreadyPaid, Number(current.amount));
    const principal = Math.min(value, Math.max(0, Number(current.amount) - principalBefore));
    await updateDailyCashFlow(tx, userId, 'RECEIVABLE', value, paidAt);
    await recordMovement({ db: tx, userId, type: 'PAYMENT_RECEIVED', amount: value, occurredAt: paidAt, referenceId: `sale-installment-payment:${id}:${paidAt.toISOString()}`, description: `Parcela ${current.number}: ${current.debt.description}`, principal, interest: Math.max(0, value - principal) });
    await createNotification(tx, userId, { title: 'Parcela registrada', body: `${current.number}ª parcela de ${current.debt.description} ${isPaid ? 'foi paga' : 'recebeu pagamento parcial'}.`, type: 'PAYMENT_RECEIVED', data: { debtId: current.debtId, installmentId: id } });
    const installment = await tx.installment.findUnique({ where: { id } });
    return { installment, sale: summary };
  });
}

async function unpayInstallment(userId, id) {
  const current = await ownedInstallment(userId, id);
  if (current.status !== 'PAID' && current.status !== 'PARTIAL') throw new HttpError(409, 'INSTALLMENT_UNPAID', 'Esta parcela ainda não possui pagamento.');
  return prisma.$transaction(async (tx) => {
    const paidAt = current.paidAt || new Date();
    await tx.installment.update({ where: { id }, data: { paidAmount: null, paidAt: null, paymentMethod: null, note: null, status: new Date(current.dueDate) < new Date() ? 'OVERDUE' : 'PENDING' } });
    await updateDailyCashFlow(tx, userId, 'RECEIVABLE', -Number(current.paidAmount || 0), paidAt);
    await recordMovement({ db: tx, userId, type: 'ADJUSTMENT', amount: -Number(current.paidAmount || 0), occurredAt: paidAt, referenceId: `sale-installment-reversal:${id}:${paidAt.toISOString()}`, description: `Estorno da parcela ${current.number}: ${current.debt.description}` });
    return { installment: await tx.installment.findUnique({ where: { id } }), sale: await syncSaleAndDebt(tx, current.debtId) };
  });
}

async function remindInstallment(userId, id) {
  const installment = await ownedInstallment(userId, id);
  const customer = installment.debt.customer;
  const name = customer?.nickname || customer?.name || installment.debt.counterparty;
  const total = Number(installment.totalAmount || installment.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const message = `Olá ${name}, tudo bem? A ${installment.number}ª parcela de ${installment.debt.description}, no valor de ${total}, está pendente. Pode me confirmar o pagamento?`;
  const phone = (customer?.phone || installment.debt.counterpartyPhone || '').replace(/\D/g, '');
  await prisma.$transaction([
    prisma.installment.update({ where: { id }, data: { lastReminderSent: new Date(), reminderCount: { increment: 1 } } }),
    prisma.reminder.create({ data: { userId, debtId: installment.debtId, type: 'WHATSAPP', scheduledAt: new Date(), sentAt: new Date(), status: 'SENT', message } }),
  ]);
  return { message, whatsappLink: phone ? `https://wa.me/55${phone}?text=${encodeURIComponent(message)}` : null, smsLink: phone ? `sms:${phone}?body=${encodeURIComponent(message)}` : null };
}

async function addExtraInstallment(userId, id, amount, dueDate) {
  const sale = await prisma.sale.findFirst({ where: { id, userId }, include: { debt: { include: { installments: { orderBy: { number: 'asc' } } } } } });
  if (!sale) throw new HttpError(404, 'SALE_NOT_FOUND', 'Venda não encontrada.');
  if (!sale.debt) throw new HttpError(409, 'SALE_WITHOUT_DEBT', 'Esta venda não possui cobrança vinculada.');
  const value = round(amount);
  if (value <= 0) throw new HttpError(400, 'INVALID_AMOUNT', 'Informe um valor de parcela positivo.');
  const number = (sale.debt.installments.reduce((max, item) => Math.max(max, Number(item.number)), 0)) + 1;
  const baseDate = dueDate ? new Date(dueDate) : sale.debt.dueDate || new Date();
  const newTotal = round(Number(sale.debt.totalAmount) + value);
  const totalInstallments = Number(sale.debt.totalInstallments || 1) + 1;
  const average = round(newTotal / totalInstallments);
  const paidAmount = Number(sale.debt.paidAmount || 0);
  const remaining = round(newTotal - paidAmount);
  return prisma.$transaction(async (tx) => {
    await tx.installment.create({ data: { debtId: sale.debt.id, number, amount: value, totalAmount: value, status: 'PENDING', dueDate: baseDate, interestRateAtCreation: Number(sale.interestRate || 0) } });
    const status = remaining <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'PENDING';
    await tx.debt.update({ where: { id: sale.debt.id }, data: { totalAmount: newTotal, installmentAmount: average, totalInstallments, ...(baseDate >= new Date(sale.debt.dueDate) ? { dueDate: baseDate } : {}) } });
    await tx.sale.update({ where: { id }, data: { totalAmount: newTotal, remainingAmount: remaining, installmentAmount: average, totalInstallments, status } });
    return tx.sale.findUnique({ where: { id }, include: saleInclude });
  });
}

async function overdueInstallments(userId, scope = {}) {
  const sales = await prisma.sale.findMany({ where: { userId, status: { in: ['PENDING', 'PARTIAL'] }, ...(scope.role === 'COLLECTOR' ? { customer: { collectorId: scope.actorId } } : {}) }, select: { id: true } });
  await Promise.all(sales.map((sale) => recalculateSaleInterest(sale.id)));
  return prisma.installment.findMany({ where: { debt: { ...scopedDebt(userId, scope), saleId: { not: null } }, status: { in: ['OVERDUE', 'PARTIAL'] }, dueDate: { lt: new Date() } }, include: installmentInclude, orderBy: { dueDate: 'asc' } });
}

async function listScopedInstallments(userId, scope = {}) { return prisma.installment.findMany({ where: { debt: scopedDebt(userId, scope) }, include: installmentInclude, orderBy: { dueDate: 'asc' } }); }

module.exports = { payInstallment, unpayInstallment, remindInstallment, addExtraInstallment, overdueInstallments, listScopedInstallments };
