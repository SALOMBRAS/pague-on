const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const prisma = require('../config/database');
const HttpError = require('../utils/httpError');
const { startOfUtcDay } = require('../utils/dateHelpers');
const { recordMovement } = require('./financialAccountService');
const audit = require('./auditService');

const round = (value) => Number(Number(value || 0).toFixed(2));
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

const paymentInclude = { allocations: { include: { account: true } }, createdBy: { select: { id: true, name: true } } };
const loanInclude = {
  customer: true,
  installments: { orderBy: { number: 'asc' }, include: { payments: { include: paymentInclude, orderBy: { createdAt: 'desc' } } } },
  loanContract: true,
};

function activePayments(installment) { return (installment.payments || []).filter((item) => !item.isReversed); }
function totals(installment) {
  const payments = installment.payments || [];
  const active = activePayments(installment);
  const receiptCash = round(active.reduce((sum, item) => sum + Number(item.amount), 0));
  const allCash = round(payments.reduce((sum, item) => sum + Number(item.amount), 0));
  const receiptPrincipal = round(active.reduce((sum, item) => sum + Number(item.principalAmount), 0));
  const receiptInterest = round(active.reduce((sum, item) => sum + Number(item.interestAmount), 0));
  const paidPenalty = round(active.reduce((sum, item) => sum + Number(item.penaltyAmount), 0));
  const discounted = round(active.reduce((sum, item) => sum + Number(item.discountAmount), 0));
  const principal = Number(installment.amount);
  const interest = Number(installment.interestAmount || 0);
  const penalty = 0;
  // Legacy = pagamentos fora de recibo (gravados direto no paidAmount). Subtrai o total de
  // TODOS os recibos (inclusive estornados) para o valor estornado não vazar de volta.
  const legacyCash = round(Math.max(0, Number(installment.paidAmount || 0) - allCash));
  const paidPrincipal = round(receiptPrincipal + Math.min(legacyCash, Math.max(0, principal - receiptPrincipal)));
  const paidInterest = round(receiptInterest + Math.max(0, legacyCash - Math.min(legacyCash, Math.max(0, principal - receiptPrincipal))));
  const paidCash = round(receiptCash + legacyCash);
  const remaining = round(Math.max(0, principal + interest + penalty - paidCash - discounted));
  return { principal, interest, penalty, paidPrincipal, paidInterest, paidPenalty, discounted, paidCash, remaining };
}

function discountFor(input, current, canDiscount) {
  if (!input.discountValue) return 0;
  if (!canDiscount) throw new HttpError(403, 'DISCOUNT_FORBIDDEN', 'Apenas usuários autorizados podem conceder desconto.');
  const discount = input.discountType === 'PERCENTAGE' ? round(current.remaining * Number(input.discountValue) / 100) : round(input.discountValue);
  if (discount <= 0 || discount > current.remaining) throw new HttpError(400, 'INVALID_DISCOUNT', 'O desconto deve ser maior que zero e não pode superar o saldo pendente.');
  return discount;
}

function allocationPreview(installment, input, canDiscount) {
  const current = totals(installment);
  const discount = discountFor(input, current, canDiscount);
  const discountInterest = Math.min(discount, Math.max(0, current.interest - current.paidInterest));
  const discountPrincipal = round(discount - discountInterest);
  const afterDiscountInterest = round(Math.max(0, current.interest - current.paidInterest - discountInterest));
  const afterDiscountPrincipal = round(Math.max(0, current.principal - current.paidPrincipal - discountPrincipal));
  const afterDiscountPenalty = round(Math.max(0, current.penalty - current.paidPenalty));
  const amount = round(input.amount);
  const payableAfterDiscount = round(current.remaining - discount);
  if (amount > payableAfterDiscount + 0.01) throw new HttpError(400, 'PAYMENT_EXCEEDS_BALANCE', 'O recebimento não pode superar o saldo pendente após o desconto.');
  let remainingCash = amount;
  const penalty = Math.min(remainingCash, afterDiscountPenalty); remainingCash = round(remainingCash - penalty);
  const interest = Math.min(remainingCash, afterDiscountInterest); remainingCash = round(remainingCash - interest);
  const principal = Math.min(remainingCash, afterDiscountPrincipal); remainingCash = round(remainingCash - principal);
  const remaining = round(Math.max(0, payableAfterDiscount - amount));
  return { current, principal, interest, penalty, discount, discountPrincipal, discountInterest, remaining, settlesInstallment: remaining <= 0.01 };
}

function receiptHtml(debt, installment, payment, preview) {
  return `<h1>Recibo de recebimento</h1><p>Número: ${escapeHtml(payment.receiptNumber)}</p><p>Empréstimo: ${escapeHtml(debt.description)} · parcela ${installment.number}</p><p>Cliente: ${escapeHtml(debt.customer?.name || debt.counterparty)}</p><p>Recebido: R$ ${Number(payment.amount).toFixed(2)} · principal: R$ ${preview.principal.toFixed(2)} · juros: R$ ${preview.interest.toFixed(2)} · multa: R$ ${preview.penalty.toFixed(2)} · desconto: R$ ${preview.discount.toFixed(2)}.</p><p>Forma de pagamento: ${escapeHtml(payment.paymentMethod)}. Emitido em ${new Date().toLocaleString('pt-BR')}.</p>`;
}

async function lockInstallment(tx, installmentId) {
  await tx.$queryRaw(Prisma.sql`select "id" from "Installment" where "id" = cast(${installmentId} as uuid) for update`);
}

async function lockAccounts(tx, accountIds) {
  const ordered = [...new Set(accountIds)].sort();
  if (ordered.length) await tx.$queryRaw(Prisma.sql`select "id" from "FinancialAccount" where "id"::text in (${Prisma.join(ordered)}) order by "id" for update`);
}

async function findInstallment(userId, installmentId, db = prisma) {
  const installment = await db.installment.findFirst({ where: { id: installmentId, debt: { userId, category: 'LOAN' } }, include: { payments: { include: paymentInclude, orderBy: { createdAt: 'desc' } }, debt: { include: loanInclude } } });
  if (!installment) throw new HttpError(404, 'LOAN_INSTALLMENT_NOT_FOUND', 'Parcela de empréstimo não encontrada.');
  return installment;
}

async function preview(userId, installmentId, input, canDiscount) {
  const installment = await findInstallment(userId, installmentId);
  const result = allocationPreview(installment, input, canDiscount);
  return { installment: { id: installment.id, number: installment.number, dueDate: installment.dueDate, status: installment.status }, ...result };
}

async function updateDailyCashFlow(tx, userId, amount, paidAt) {
  const date = startOfUtcDay(paidAt);
  return tx.cashFlow.upsert({ where: { userId_date: { userId, date } }, create: { userId, date, totalIn: amount, totalOut: 0, balance: amount }, update: { totalIn: { increment: amount }, balance: { increment: amount } } });
}

async function syncLoanDebt(tx, debtId) {
  const debt = await tx.debt.findUnique({ where: { id: debtId }, include: { installments: { include: { payments: true }, orderBy: { dueDate: 'asc' } } } });
  const resolved = debt.installments.map((item) => ({ item, total: totals(item) }));
  const cashPaid = round(resolved.reduce((sum, entry) => sum + entry.total.paidCash, 0));
  const paidInstallments = resolved.filter((entry) => entry.total.remaining <= 0.01).length;
  const pending = resolved.filter((entry) => entry.total.remaining > 0.01);
  const status = pending.length === 0 ? 'PAID' : cashPaid > 0 ? 'PARTIAL' : 'PENDING';
  return tx.debt.update({ where: { id: debtId }, data: { paidAmount: cashPaid, paidInstallments, dueDate: pending[0]?.item.dueDate || debt.dueDate, status, isActive: status !== 'PAID', paidAt: status === 'PAID' ? new Date() : null } });
}

async function record(userId, actor, installmentId, input, req = null) {
  const existing = await prisma.installmentPayment.findFirst({ where: { userId, idempotencyKey: input.idempotencyKey }, include: { allocations: true } });
  if (existing) return { payment: existing, idempotent: true };
  try {
    return await prisma.$transaction(async (tx) => {
      await lockInstallment(tx, installmentId);
      await lockAccounts(tx, input.cashAllocations.map((item) => item.accountId));
      const current = await findInstallment(userId, installmentId, tx);
      const canDiscount = ['ADMIN', 'MANAGER'].includes(actor.role);
      const result = allocationPreview(current, input, canDiscount);
      const now = new Date();
      const receiptNumber = `REC-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const payment = await tx.installmentPayment.create({ data: { userId, installmentId, receiptNumber, idempotencyKey: input.idempotencyKey, amount: input.amount, principalAmount: result.principal, interestAmount: result.interest, penaltyAmount: result.penalty, discountAmount: result.discount, paymentMethod: input.paymentMethod, proofUrl: input.proofUrl || null, promiseDate: input.promiseDate || null, notes: input.notes || null, discountReason: input.discountReason || null, renewalReason: input.renewalReason || null, receiptHtml: '', createdById: actor.id } });
      const movements = [];
      let remainingPrincipal = result.principal; let remainingInterest = result.interest; let remainingPenalty = result.penalty;
      for (let index = 0; index < input.cashAllocations.length; index += 1) {
        const allocation = input.cashAllocations[index]; const amount = Number(allocation.amount);
        const principal = index === input.cashAllocations.length - 1 ? remainingPrincipal : Math.min(remainingPrincipal, amount); remainingPrincipal = round(remainingPrincipal - principal);
        const afterPrincipal = amount - principal; const interest = index === input.cashAllocations.length - 1 ? remainingInterest : Math.min(remainingInterest, afterPrincipal); remainingInterest = round(remainingInterest - interest);
        const penalty = index === input.cashAllocations.length - 1 ? remainingPenalty : Math.min(remainingPenalty, afterPrincipal - interest); remainingPenalty = round(remainingPenalty - penalty);
        const movement = await recordMovement({ db: tx, userId, accountId: allocation.accountId, type: 'PAYMENT_RECEIVED', amount, occurredAt: now, referenceId: `loan-receipt:${payment.id}:${allocation.accountId}`, description: `Recebimento ${receiptNumber} · parcela ${current.number}`, category: 'LOAN', origin: 'LOAN_INSTALLMENT_RECEIPT', debtId: current.debtId, customerId: current.debt.customerId, paymentMethod: input.paymentMethod, responsibleUserId: actor.id, principal, interest, penalty, operationId: payment.id });
        movements.push({ accountId: allocation.accountId, amount, movementId: movement.id });
      }
      await tx.installmentPaymentAllocation.createMany({ data: movements.map((item) => ({ paymentId: payment.id, ...item })) });
      const paidCash = round(result.current.paidCash + Number(input.amount));
      await tx.installment.update({ where: { id: installmentId }, data: { paidAmount: paidCash, paidAt: now, paymentMethod: input.paymentMethod, note: input.notes || null, status: result.settlesInstallment ? 'PAID' : 'PARTIAL' } });
      if (input.renewalConfirmed) {
        const nextNumber = Math.max(...current.debt.installments.map((item) => item.number)) + 1;
        await tx.installment.create({ data: { debtId: current.debtId, number: nextNumber, amount: input.renewalAmount, interestAmount: 0, totalAmount: input.renewalAmount, dueDate: input.renewalDueDate, status: 'PENDING', interestRateAtCreation: 0, note: `Renovação confirmada: ${input.renewalReason}` } });
      }
      await updateDailyCashFlow(tx, userId, Number(input.amount), now);
      const debt = await syncLoanDebt(tx, current.debtId);
      const fullPayment = await tx.installmentPayment.update({ where: { id: payment.id }, data: { receiptHtml: receiptHtml(current.debt, current, payment, result) }, include: { allocations: { include: { account: true } } } });
      await tx.auditLog.create({ data: { eventType: 'loan_installment_received', workspaceOwnerId: userId, actorId: actor.id, actorEmailHash: audit.hash(actor.email), targetId: payment.id, targetType: 'installment_payment', payload: audit.sanitize({ debtId: current.debtId, installmentId, receiptNumber, amount: input.amount, principal: result.principal, interest: result.interest, penalty: result.penalty, discount: result.discount, promiseDate: input.promiseDate || null, renewalConfirmed: Boolean(input.renewalConfirmed) }), ipAddress: String(req?.ip || req?.socket?.remoteAddress || '').slice(0, 64) || null, userAgent: String(req?.get?.('user-agent') || '').slice(0, 512) || null } });
      return { payment: fullPayment, debt, preview: result, idempotent: false };
    });
  } catch (error) {
    if (error.code === 'P2002') { const payment = await prisma.installmentPayment.findFirst({ where: { userId, idempotencyKey: input.idempotencyKey }, include: { allocations: true } }); if (payment) return { payment, idempotent: true }; }
    throw error;
  }
}

async function reverse(userId, actor, paymentId, reason, req = null) {
  if (!['ADMIN', 'MANAGER'].includes(actor.role)) throw new HttpError(403, 'REVERSAL_FORBIDDEN', 'Apenas administradores ou gerentes podem estornar recebimentos.');
  return prisma.$transaction(async (tx) => {
    const payment = await tx.installmentPayment.findFirst({ where: { id: paymentId, userId }, include: { allocations: true, installment: { include: { debt: { include: loanInclude } } } } });
    if (!payment) throw new HttpError(404, 'RECEIPT_NOT_FOUND', 'Recibo não encontrado.');
    await lockInstallment(tx, payment.installmentId); await lockAccounts(tx, payment.allocations.map((item) => item.accountId));
    if (payment.isReversed) throw new HttpError(409, 'RECEIPT_REVERSED', 'Este recebimento já foi estornado.');
    let reversePrincipal = Number(payment.principalAmount); let reverseInterest = Number(payment.interestAmount); let reversePenalty = Number(payment.penaltyAmount);
    for (let index = 0; index < payment.allocations.length; index += 1) { const allocation = payment.allocations[index]; const amount = Number(allocation.amount); const principal = index === payment.allocations.length - 1 ? reversePrincipal : Math.min(reversePrincipal, amount); reversePrincipal = round(reversePrincipal - principal); const interest = index === payment.allocations.length - 1 ? reverseInterest : Math.min(reverseInterest, amount - principal); reverseInterest = round(reverseInterest - interest); const penalty = index === payment.allocations.length - 1 ? reversePenalty : Math.min(reversePenalty, amount - principal - interest); reversePenalty = round(reversePenalty - penalty); await recordMovement({ db: tx, userId, accountId: allocation.accountId, type: 'REVERSAL', amount: -amount, occurredAt: new Date(), referenceId: `loan-receipt-reversal:${payment.id}:${allocation.accountId}`, description: `Estorno ${payment.receiptNumber}: ${reason}`, category: 'LOAN', origin: 'LOAN_INSTALLMENT_RECEIPT_REVERSAL', debtId: payment.installment.debtId, customerId: payment.installment.debt.customerId, responsibleUserId: actor.id, principal: -principal, interest: -interest, penalty: -penalty, operationId: payment.id }); }
    await tx.installmentPayment.update({ where: { id: payment.id }, data: { isReversed: true, reversedAt: new Date(), reversalReason: reason } });
    const current = await findInstallment(userId, payment.installmentId, tx); const currentTotals = totals(current);
    await tx.installment.update({ where: { id: current.id }, data: { paidAmount: currentTotals.paidCash, paidAt: currentTotals.paidCash > 0 ? current.paidAt : null, status: currentTotals.remaining <= 0.01 ? 'PAID' : currentTotals.paidCash > 0 ? 'PARTIAL' : (new Date(current.dueDate) < new Date() ? 'OVERDUE' : 'PENDING') } });
    await updateDailyCashFlow(tx, userId, -Number(payment.amount), new Date()); const debt = await syncLoanDebt(tx, payment.installment.debtId);
    await tx.auditLog.create({ data: { eventType: 'loan_installment_receipt_reversed', workspaceOwnerId: userId, actorId: actor.id, actorEmailHash: audit.hash(actor.email), targetId: payment.id, targetType: 'installment_payment', payload: { receiptNumber: payment.receiptNumber, reason }, ipAddress: String(req?.ip || req?.socket?.remoteAddress || '').slice(0, 64) || null, userAgent: String(req?.get?.('user-agent') || '').slice(0, 512) || null } });
    return { payment: await tx.installmentPayment.findUnique({ where: { id: payment.id }, include: { allocations: true } }), debt };
  });
}

async function details(userId, debtId) {
  const debt = await prisma.debt.findFirst({ where: { id: debtId, userId, category: 'LOAN' }, include: loanInclude });
  if (!debt) throw new HttpError(404, 'LOAN_NOT_FOUND', 'Empréstimo não encontrado.');
  const movements = await prisma.financialMovement.findMany({ where: { userId, debtId }, include: { account: { select: { id: true, name: true } }, responsibleUser: { select: { id: true, name: true } } }, orderBy: { occurredAt: 'desc' } });
  return { debt, installments: debt.installments.map((item) => ({ ...item, totals: totals(item) })), movements };
}

module.exports = { details, preview, record, reverse, allocationPreview, totals };
