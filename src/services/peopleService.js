const prisma = require('../config/database');
const HttpError = require('../utils/httpError');

function summary(customer) {
  const sales = customer.sales || []; const debts = customer.debts || [];
  const totalSold = sales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
  const totalPaid = sales.reduce((sum, sale) => sum + Number(sale.paidAmount || 0), 0);
  const totalOverdue = debts.filter((debt) => debt.status === 'OVERDUE').reduce((sum, debt) => sum + Math.max(0, Number(debt.totalAmount) - Number(debt.paidAmount)), 0);
  return { totalSales: sales.length, totalSold: Number(totalSold.toFixed(2)), totalPaid: Number(totalPaid.toFixed(2)), totalPending: Number((totalSold - totalPaid).toFixed(2)), totalOverdue: Number(totalOverdue.toFixed(2)), activeSales: sales.filter((sale) => ['PENDING', 'PARTIAL'].includes(sale.status)).length };
}

async function findPerson(userId, id, details = false) {
  const person = await prisma.customer.findFirst({ where: { id, userId }, include: { sales: { orderBy: { soldAt: 'desc' }, include: { debt: { include: { installments: { orderBy: { number: 'asc' } } } } } }, debts: { orderBy: { dueDate: 'asc' } } } });
  if (!person) throw new HttpError(404, 'PERSON_NOT_FOUND', 'Pessoa não encontrada.');
  return details ? { ...person, summary: summary(person) } : person;
}

async function listPeople(userId, query = {}) {
  const where = { userId, ...(query.includeInactive === 'true' ? {} : { isActive: true }) };
  if (query.q || query.search) { const value = query.q || query.search; where.OR = [{ name: { contains: value, mode: 'insensitive' } }, { nickname: { contains: value, mode: 'insensitive' } }, { phone: { contains: value, mode: 'insensitive' } }]; }
  const people = await prisma.customer.findMany({ where, orderBy: { name: 'asc' }, include: { sales: true, debts: true } });
  return people.map((person) => ({ ...person, summary: summary(person) }));
}

async function personSales(userId, id) { await findPerson(userId, id); return prisma.sale.findMany({ where: { userId, customerId: id }, include: { debt: { include: { installments: { orderBy: { number: 'asc' } } } }, items: true }, orderBy: { soldAt: 'desc' } }); }

module.exports = { findPerson, listPeople, personSales };
