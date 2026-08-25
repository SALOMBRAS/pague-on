const prisma = require('../config/database');
const HttpError = require('../utils/httpError');
const { calculateProfitMargin } = require('../utils/calculateProfit');

async function findOwnedProduct(userId, id, options = {}) {
  const product = await prisma.product.findFirst({ where: { id, userId }, ...options });
  if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Produto não encontrado.');
  return product;
}

function withMargin(input) {
  const costPrice = input.costPrice;
  const sellingPrice = input.sellingPrice;
  if (costPrice === undefined || sellingPrice === undefined) return { ...input, profitMargin: 0 };
  return { ...input, profitMargin: calculateProfitMargin(costPrice, sellingPrice) };
}

async function createProduct(userId, input) {
  return prisma.product.create({ data: { ...withMargin(input), userId } });
}

async function updateProduct(userId, id, input) {
  const current = await findOwnedProduct(userId, id);
  const data = withMargin({
    ...input,
    costPrice: input.costPrice ?? Number(current.costPrice),
    sellingPrice: input.sellingPrice ?? Number(current.sellingPrice),
  });
  return prisma.product.update({ where: { id }, data });
}

async function listProducts(userId, query) {
  const where = { userId, isActive: true };
  if (query.search) where.OR = [
    { name: { contains: query.search, mode: 'insensitive' } },
    { category: { contains: query.search, mode: 'insensitive' } },
  ];
  const orderBy = {
    profitMargin: { profitMargin: 'desc' },
    name: { name: 'asc' },
    stock: { stockQuantity: 'asc' },
  }[query.sort] || { createdAt: 'desc' };

  const products = await prisma.product.findMany({ where, orderBy });
  return query.lowStock === 'true'
    ? products.filter((product) => product.minStockAlert !== null && product.stockQuantity <= product.minStockAlert)
    : products;
}

async function productDetail(userId, id) {
  return findOwnedProduct(userId, id, {
    include: {
      purchases: { orderBy: { date: 'desc' } },
      debts: { orderBy: { dueDate: 'asc' } },
    },
  });
}

module.exports = { findOwnedProduct, createProduct, updateProduct, listProducts, productDetail };
