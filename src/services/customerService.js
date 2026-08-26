const prisma = require('../config/database');
const HttpError = require('../utils/httpError');

async function findOwnedCustomer(userId, id, options = {}) {
  const customer = await prisma.customer.findFirst({ where: { id, userId }, ...options });
  if (!customer) throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Cliente não encontrado.');
  return customer;
}

async function listCustomers(userId, query) {
  const where = { userId, ...(query.includeInactive === 'true' ? {} : { isActive: true }), ...(query.category ? { category: query.category } : {}), ...(query.collectorId ? { collectorId: query.collectorId } : {}), ...(query.status ? { status: query.status } : {}), ...(query.classificationId ? { classificationId: query.classificationId } : {}) };
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { nickname: { contains: query.search, mode: 'insensitive' } },
      { cpfCnpj: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  return prisma.customer.findMany({
    where,
    include: { classification: true, collector: { select: { id: true, name: true } }, _count: { select: { sales: true, debts: true } } },
    orderBy: { name: 'asc' },
  });
}

async function customerDetail(userId, id) {
  return findOwnedCustomer(userId, id, {
    include: {
      sales: { orderBy: { soldAt: 'desc' }, take: 20, include: { debt: true } },
      debts: { orderBy: { dueDate: 'asc' }, take: 20 },
      documents: { orderBy: { uploadedAt: 'desc' } }, consents: { orderBy: { grantedAt: 'desc' } }, classification: true, collector: { select: { id: true, name: true } }, approvedBy: { select: { id: true, name: true } },
    },
  });
}

async function createCustomer(userId, input) {
  return prisma.customer.create({ data: { userId, ...input, status: 'PENDING_REVIEW', isActive: true } });
}

async function updateCustomer(userId, id, input) {
  await findOwnedCustomer(userId, id);
  return prisma.customer.update({ where: { id }, data: input });
}
async function approveCustomer(userId, id, approvedById) {
  await findOwnedCustomer(userId, id);
  return prisma.customer.update({ where: { id }, data: { status: 'APPROVED', isActive: true, approvedAt: new Date(), approvedById } });
}

module.exports = { findOwnedCustomer, listCustomers, customerDetail, createCustomer, updateCustomer, approveCustomer };
