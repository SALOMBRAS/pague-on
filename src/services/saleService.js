const prisma = require('../config/database');
const HttpError = require('../utils/httpError');
const { buildInstallments, payDebt, payInstallment, debtInclude } = require('./debtService');

const saleInclude = {
  customer: true,
  items: { include: { product: true } },
  debt: { include: debtInclude },
};

async function createSale(userId, input) {
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
      const total = Number((unitPrice * item.quantity).toFixed(2));
      return { productId: product.id, name: product.name, quantity: item.quantity, unitPrice, unitCost: Number(product.costPrice), total };
    });
    const subtotal = items.reduce((total, item) => total + item.total, 0);
    if (input.discount > subtotal) throw new HttpError(400, 'INVALID_DISCOUNT', 'O desconto não pode ser maior que o total da venda.');
    const totalAmount = Number((subtotal - input.discount).toFixed(2));
    if (totalAmount <= 0) throw new HttpError(400, 'INVALID_SALE_TOTAL', 'O total da venda deve ser maior que zero.');
    const installments = input.paymentType === 'INSTALLMENT'
      ? buildInstallments({ totalAmount, totalInstallments: input.totalInstallments, installmentAmount: input.installmentAmount, startDate, frequency: input.frequency })
      : [{ number: 1, amount: totalAmount, dueDate: startDate }];
    const dueDate = installments[0]?.dueDate || startDate;

    const sale = await tx.sale.create({
      data: {
        userId,
        customerId,
        totalAmount,
        discount: input.discount,
        interestRate: input.interestRate,
        interestType: input.interestType,
        paymentType: input.paymentType,
        totalInstallments: input.paymentType === 'INSTALLMENT' ? input.totalInstallments : 1,
        installmentAmount: installments[0].amount,
        frequency: input.paymentType === 'INSTALLMENT' ? input.frequency : null,
        firstDueDate: startDate,
        remainingAmount: totalAmount,
        description: input.description || null,
        notes: input.notes || null,
        soldAt: startDate,
        items: { create: items },
      },
    });
    const debt = await tx.debt.create({
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
        totalAmount,
        installmentAmount: installments[0]?.amount || null,
        totalInstallments: input.paymentType === 'INSTALLMENT' ? input.totalInstallments : null,
        startDate,
        dueDate,
        productId: items.length === 1 ? items[0].productId : null,
        quantity: items.length === 1 ? items[0].quantity : null,
        installments: { create: installments.map((installment) => ({ ...installment, totalAmount: installment.amount, interestRateAtCreation: input.interestRate })) },
      },
    });
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

async function cancelSale(userId, id) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({ where: { id, userId }, include: { items: true, debt: true } });
    if (!sale) throw new HttpError(404, 'SALE_NOT_FOUND', 'Venda não encontrada.');
    if (sale.status === 'CANCELLED') throw new HttpError(409, 'SALE_CANCELLED', 'Esta venda já está cancelada.');
    if (Number(sale.paidAmount) > 0 || sale.debt?.status === 'PAID') {
      throw new HttpError(409, 'SALE_HAS_PAYMENTS', 'Não é possível cancelar uma venda com pagamentos registrados.');
    }
    for (const item of sale.items) {
      await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { increment: item.quantity } } });
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

module.exports = { saleInclude, createSale, listSales, saleDetail, findOwnedSale, cancelSale, paySale };
