const prisma = require('../config/database');
const HttpError = require('../utils/httpError');
const { findOwnedProduct } = require('./productService');
const { calculateProfitMargin } = require('../utils/calculateProfit');

async function createPurchase(userId, input) {
  await findOwnedProduct(userId, input.productId);
  const totalCost = Number((input.quantity * input.unitCost).toFixed(2));
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.create({ data: { ...input, userId, totalCost } });
    const product = await tx.product.update({
      where: { id: input.productId },
      data: { stockQuantity: { increment: input.quantity } },
    });

    return { purchase, product };
  });
}

async function listPurchases(userId, query) {
  const where = { userId };
  if (query.productId) where.productId = query.productId;
  if (query.startDate || query.endDate) {
    where.date = {};
    if (query.startDate) where.date.gte = new Date(query.startDate);
    if (query.endDate) where.date.lte = new Date(query.endDate);
  }
  return prisma.purchase.findMany({ where, include: { product: true }, orderBy: { date: 'desc' } });
}

async function deletePurchase(userId, id) {
  return prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findFirst({ where: { id, userId } });
    if (!purchase) throw new HttpError(404, 'PURCHASE_NOT_FOUND', 'Compra não encontrada.');
    const product = await tx.product.findFirst({ where: { id: purchase.productId, userId } });
    if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.');
    if (product.stockQuantity < purchase.quantity) {
      throw new HttpError(409, 'STOCK_INCONSISTENT', 'Não é possível excluir: o estoque atual é menor que esta compra.');
    }
    await tx.product.update({ where: { id: product.id }, data: { stockQuantity: { decrement: purchase.quantity } } });
    await tx.purchase.delete({ where: { id } });
    return { id };
  });
}

module.exports = { createPurchase, listPurchases, deletePurchase };
