const prisma = require('../config/database');
const HttpError = require('../utils/httpError');
const { buildInstallments, payDebt, payInstallment, debtInclude, updateDailyCashFlow } = require('./debtService');
const { recordMovement } = require('./financialAccountService');

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function fromCents(value) {
  return Number((value / 100).toFixed(2));
}

function calculateSaleAmounts(subtotalValue, discountValue = 0, downPaymentValue = 0) {
  const subtotal = toCents(subtotalValue);
  const discount = toCents(discountValue);
  const downPayment = toCents(downPaymentValue);
  if (discount > subtotal) throw new HttpError(400, 'INVALID_DISCOUNT', 'O desconto não pode ser maior que o total da venda.');
  const total = subtotal - discount;
  if (total <= 0) throw new HttpError(400, 'INVALID_SALE_TOTAL', 'O total da venda deve ser maior que zero.');
  if (downPayment > total) throw new HttpError(400, 'INVALID_DOWN_PAYMENT', 'A entrada não pode ser maior que o total da venda.');
  return {
    subtotal: fromCents(subtotal),
    discount: fromCents(discount),
    totalAmount: fromCents(total),
    downPaymentAmount: fromCents(downPayment),
    remainingAmount: fromCents(total - downPayment),
  };
}

const saleInclude = {
  customer: true,
  items: { include: { product: true } },
  debt: { include: debtInclude },
};

async function createSale(userId, input, context = {}) {
  const startDate = input.firstDueDate || input.startDate || new Date();
  return prisma.$transaction(async (tx) => {
    const customerId = input.customerId || input.personId || null;
    const customer = customerId
      ? await tx.customer.findFirst({ where: { id: customerId, userId, isActive: true } })
      : null;
    if (customerId && !customer) throw new HttpError(400, 'INVALID_CUSTOMER', 'A pessoa selecionada não existe ou está inativa.');

    const requestedItems = input.items || [{ productId: input.productId, quantity: input.quantity, unitPrice: input.unitPrice, productName: input.productName }];
    const productIds = [...new Set(requestedItems.map((item) => item.productId).filter(Boolean))];
    const products = await tx.product.findMany({ where: { id: { in: productIds }, userId, isActive: true } });
    if (products.length !== productIds.length) throw new HttpError(400, 'INVALID_PRODUCT', 'Um ou mais produtos não existem ou estão inativos.');
    const productMap = new Map(products.map((product) => [product.id, product]));
    const quantities = new Map();
    requestedItems.forEach((item) => { if (item.productId) quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity); });
    for (const [productId, quantity] of quantities) {
      const product = productMap.get(productId);
      if (product.stockQuantity < quantity) {
        throw new HttpError(409, 'INSUFFICIENT_STOCK', `Estoque insuficiente para ${product.name}. Disponível: ${product.stockQuantity}.`);
      }
    }

    const items = requestedItems.map((item) => {
      const product = productMap.get(item.productId);
      const unitPrice = item.unitPrice ?? Number(product?.sellingPrice);
      const total = fromCents(toCents(unitPrice) * item.quantity);
      if (!product && (!(item.name || item.productName) || !Number.isFinite(Number(unitPrice)))) {
        throw new HttpError(400, 'INVALID_SALE_ITEM', 'Informe descrição e valor para o item sem estoque.');
      }
      return {
        productId: product?.id || null,
        name: product?.name || item.name || item.productName,
        quantity: item.quantity,
        unitPrice,
        unitCost: Number(product?.costPrice || 0),
        total,
      };
    });
    const subtotal = items.reduce((total, item) => total + item.total, 0);
    const amounts = calculateSaleAmounts(subtotal, input.discount, input.downPaymentAmount);
    const installments = amounts.remainingAmount > 0 && input.paymentType === 'INSTALLMENT'
      ? buildInstallments({ totalAmount: amounts.remainingAmount, totalInstallments: input.totalInstallments, installmentAmount: input.installmentAmount, startDate, frequency: input.frequency })
      : amounts.remainingAmount > 0 ? [{ number: 1, amount: amounts.remainingAmount, dueDate: startDate }] : [];
    const dueDate = installments[0]?.dueDate || startDate;

    const sale = await tx.sale.create({
      data: {
        userId,
        customerId,
        totalAmount: amounts.totalAmount,
        paidAmount: amounts.downPaymentAmount,
        downPaymentAmount: amounts.downPaymentAmount,
        discount: amounts.discount,
        interestRate: input.interestRate,
        interestType: input.interestType,
        paymentType: input.paymentType,
        totalInstallments: input.paymentType === 'INSTALLMENT' ? input.totalInstallments : 1,
        installmentAmount: installments[0]?.amount || null,
        frequency: input.paymentType === 'INSTALLMENT' ? input.frequency : null,
        firstDueDate: startDate,
        remainingAmount: amounts.remainingAmount,
        description: input.description || null,
        notes: input.notes || null,
        soldAt: startDate,
        status: amounts.remainingAmount === 0 ? 'PAID' : amounts.downPaymentAmount > 0 ? 'PARTIAL' : 'PENDING',
        items: { create: items },
      },
    });
    const debt = amounts.remainingAmount > 0 ? await tx.debt.create({
      data: {
        userId,
        saleId: sale.id,
        customerId,
        type: 'RECEIVABLE',
        paymentType: input.paymentType,
        description: input.description || `Venda #${sale.id.slice(0, 8)}`,
        category: 'PRODUCT',
        counterparty: customer?.name || 'Cliente avulso',
        counterpartyPhone: customer?.phone || null,
        totalAmount: amounts.remainingAmount,
        installmentAmount: installments[0]?.amount || null,
        totalInstallments: input.paymentType === 'INSTALLMENT' ? input.totalInstallments : null,
        startDate,
        dueDate,
        productId: items.length === 1 ? items[0].productId : null,
        quantity: items.length === 1 ? items[0].quantity : null,
        installments: { create: installments.map((installment) => ({ ...installment, totalAmount: installment.amount, interestRateAtCreation: input.interestRate })) },
      },
    }) : null;
    if (amounts.downPaymentAmount > 0) {
      await recordMovement({
        db: tx,
        userId,
        accountId: input.cashAccountId,
        type: 'PAYMENT_RECEIVED',
        amount: amounts.downPaymentAmount,
        occurredAt: new Date(),
        referenceId: `sale-down-payment:${sale.id}`,
        description: `Entrada: ${input.description || `Venda #${sale.id.slice(0, 8)}`}`,
        category: 'PRODUCT',
        origin: 'SALE_DOWN_PAYMENT',
        paymentMethod: input.paymentMethod || null,
        customerId,
        debtId: debt?.id || null,
        responsibleUserId: context.actor?.id || null,
        operationId: sale.id,
      });
      await updateDailyCashFlow(tx, userId, 'RECEIVABLE', amounts.downPaymentAmount);
      await tx.auditLog.create({
        data: {
          eventType: 'sale_down_payment_recorded', workspaceOwnerId: userId, actorId: context.actor?.id || null,
          actorEmailHash: context.actor?.email ? require('crypto').createHash('sha256').update(String(context.actor.email).trim().toLowerCase()).digest('hex') : null,
          targetId: sale.id, targetType: 'sale', payload: { debtId: debt?.id || null, amount: amounts.downPaymentAmount, accountId: input.cashAccountId },
        },
      });
    }
    for (const [productId, quantity] of quantities) {
      await tx.product.update({ where: { id: productId }, data: { stockQuantity: { decrement: quantity } } });
    }
    return tx.sale.findUnique({ where: { id: sale.id }, include: saleInclude });
  });
}

async function listSales(userId, query) {
  const where = { userId };
  if (query.customerId) where.customerId = query.customerId;
  if (query.status) where.status = query.status;
  if (query.startDate || query.endDate) {
    where.soldAt = {};
    if (query.startDate) where.soldAt.gte = new Date(query.startDate);
    if (query.endDate) where.soldAt.lte = new Date(query.endDate);
  }
  return prisma.sale.findMany({ where, include: saleInclude, orderBy: { soldAt: 'desc' } });
}

async function findOwnedSale(userId, id, options = {}) {
  const sale = await prisma.sale.findFirst({ where: { id, userId }, ...options });
  if (!sale) throw new HttpError(404, 'SALE_NOT_FOUND', 'Venda não encontrada.');
  return sale;
}

async function saleDetail(userId, id) {
  return findOwnedSale(userId, id, { include: saleInclude });
}

async function updateSale(userId, id, input) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id, userId },
      include: { items: true, customer: true, debt: { include: { installments: { orderBy: { number: 'asc' } } } } },
    });
    if (!sale) throw new HttpError(404, 'SALE_NOT_FOUND', 'Venda não encontrada.');
    if (sale.status === 'CANCELLED') throw new HttpError(409, 'SALE_CANCELLED', 'Esta venda está cancelada.');
    const hasPaid = Number(sale.paidAmount) > 0 || (sale.debt?.installments || []).some((item) => item.paidAt || item.status === 'PAID');
    if (hasPaid) throw new HttpError(409, 'INVALID_STATE', 'Não é possível editar: já há parcelas pagas.');

    const financialChanged = input.paymentType !== undefined || input.totalAmount !== undefined || input.totalInstallments !== undefined || input.installmentAmount !== undefined || input.frequency !== undefined || input.firstDueDate !== undefined || input.interestRate !== undefined || input.interestType !== undefined || input.discount !== undefined;

    let customerId = input.customerId !== undefined ? input.customerId : (input.personId !== undefined ? input.personId : sale.customerId);
    let customer = null;
    if (customerId) {
      customer = await tx.customer.findFirst({ where: { id: customerId, userId, isActive: true } });
      if (!customer) throw new HttpError(400, 'INVALID_CUSTOMER', 'A pessoa selecionada não existe ou está inativa.');
    }
    const description = input.description ?? sale.description;
    const notes = input.notes !== undefined ? input.notes : sale.notes;

    if (!financialChanged) {
      const saleData = {
        description,
        notes,
        customerId,
        ...(input.interestType !== undefined ? { interestType: input.interestType } : {}),
        ...(input.interestRate !== undefined ? { interestRate: Number(input.interestRate) } : {}),
      };
      await tx.sale.update({ where: { id }, data: saleData });
      if (sale.debt) {
        await tx.debt.update({ where: { id: sale.debt.id }, data: {
          customerId,
          description,
          counterparty: customer?.name || sale.debt.counterparty,
          counterpartyPhone: customer?.phone !== undefined ? customer?.phone : sale.debt.counterpartyPhone,
        } });
      }
      return tx.sale.findUnique({ where: { id }, include: saleInclude });
    }

    const paymentType = input.paymentType ?? sale.paymentType;
    const single = paymentType !== 'INSTALLMENT';
    const discount = input.discount !== undefined ? Number(input.discount) : Number(sale.discount);
    const totalAmount = Number((Number(input.totalAmount !== undefined ? input.totalAmount : sale.totalAmount)).toFixed(2));
    const totalInstallments = single ? 1 : (input.totalInstallments ?? sale.totalInstallments ?? 1);
    const installmentAmount = single ? null : (input.installmentAmount !== undefined ? Number(input.installmentAmount) : sale.installmentAmount);
    const frequency = single ? null : (input.frequency ?? sale.frequency ?? 'MONTHLY');
    const startDate = input.firstDueDate !== undefined ? new Date(input.firstDueDate) : (sale.firstDueDate || sale.debt?.dueDate || sale.soldAt);
    const interestRate = input.interestRate !== undefined ? Number(input.interestRate) : Number(sale.interestRate);
    const interestType = input.interestType ?? sale.interestType;

    const installments = buildInstallments({ totalAmount, totalInstallments, installmentAmount, startDate, frequency });
    const dueDate = installments[0]?.dueDate || startDate;

    await tx.sale.update({ where: { id }, data: {
      description,
      notes,
      customerId,
      totalAmount,
      discount,
      paymentType,
      totalInstallments: single ? null : totalInstallments,
      installmentAmount: installmentAmount ?? installments[0]?.amount,
      frequency,
      firstDueDate: startDate,
      interestType,
      interestRate,
      remainingAmount: totalAmount,
      status: 'PENDING',
    } });
    if (sale.debt) {
      await tx.installment.deleteMany({ where: { debtId: sale.debt.id } });
      await tx.debt.update({ where: { id: sale.debt.id }, data: {
        customerId,
        description,
        counterparty: customer?.name || sale.debt.counterparty,
        counterpartyPhone: customer?.phone !== undefined ? customer?.phone : sale.debt.counterpartyPhone,
        paymentType,
        totalAmount,
        installmentAmount: installmentAmount ?? installments[0]?.amount,
        totalInstallments: single ? null : totalInstallments,
        frequency: single ? null : frequency,
        startDate,
        dueDate,
        status: 'PENDING',
        isActive: true,
        installments: { create: installments.map((item) => ({ ...item, totalAmount: item.amount, interestRateAtCreation: interestRate })) },
      } });
    }
    return tx.sale.findUnique({ where: { id }, include: saleInclude });
  });
}

async function cancelSale(userId, id) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({ where: { id, userId }, include: { items: true, debt: true } });
    if (!sale) throw new HttpError(404, 'SALE_NOT_FOUND', 'Venda não encontrada.');
    if (sale.status === 'CANCELLED') throw new HttpError(409, 'SALE_CANCELLED', 'Esta venda já está cancelada.');
    if (Number(sale.paidAmount) > 0 || sale.debt?.status === 'PAID') {
      throw new HttpError(409, 'SALE_HAS_PAYMENTS', 'Não é possível cancelar uma venda com pagamentos registrados.');
    }
    for (const item of sale.items) {
      if (item.productId) await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { increment: item.quantity } } });
    }
    if (sale.debt) await tx.debt.update({ where: { id: sale.debt.id }, data: { isActive: false, status: 'CANCELLED' } });
    return tx.sale.update({ where: { id }, data: { status: 'CANCELLED' }, include: saleInclude });
  });
}

async function paySale(userId, id, payment) {
  const sale = await findOwnedSale(userId, id, { include: { debt: true } });
  if (!sale.debt) throw new HttpError(409, 'SALE_WITHOUT_DEBT', 'Esta venda não possui uma cobrança vinculada.');
  if (payment.installmentId) return payInstallment(userId, sale.debt.id, payment.installmentId, payment.paidAmount);
  return payDebt(userId, sale.debt.id, payment.paidAmount);
}

module.exports = { saleInclude, calculateSaleAmounts, createSale, listSales, saleDetail, updateSale, findOwnedSale, cancelSale, paySale };
