const prisma = require('../config/database');
const HttpError = require('../utils/httpError');

async function findOwnedCustomer(userId, id, options = {}) {
  const customer = await prisma.customer.findFirst({ where: { id, userId }, ...options });
  if (!customer) throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Cliente não encontrado.');
  return customer;
}

async function listCustomers(userId, query) {
  const where = { userId, isActive: query.includeInactive === 'true' ? undefined : true };
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  return prisma.customer.findMany({
    where,
    include: { _count: { select: { sales: true, debts: true } } },
    orderBy: { name: 'asc' },
  });
}

async function customerDetail(userId, id) {
  return findOwnedCustomer(userId, id, {
    include: {
      sales: { orderBy: { soldAt: 'desc' }, take: 20, include: { debt: true } },
      debts: { orderBy: { dueDate: 'asc' }, take: 20 },
    },
  });
}

async function createCustomer(userId, input) {
  return prisma.customer.create({ data: { userId, ...input } });
}

async function updateCustomer(userId, id, input) {
  await findOwnedCustomer(userId, id);
  return prisma.customer.update({ where: { id }, data: input });
}

module.exports = { findOwnedCustomer, listCustomers, customerDetail, createCustomer, updateCustomer };
