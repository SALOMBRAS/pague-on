const bcrypt = require('bcrypt');
const prisma = require('../config/database');
const HttpError = require('../utils/httpError');

const DEFAULT_PERMISSIONS = Object.freeze({ recordPayments: true, registerContacts: true, viewContactHistory: true });
const round = (value) => Number(Number(value || 0).toFixed(2));
const dayStart = (value = new Date()) => { const date = new Date(value); date.setHours(0, 0, 0, 0); return date; };
const dayEnd = (value = new Date()) => { const date = dayStart(value); date.setDate(date.getDate() + 1); return date; };
const workspaceWhere = (userId) => ({ OR: [{ id: userId }, { workspaceOwnerId: userId }] });
const publicCollector = (record) => ({
  id: record.user.id, name: record.user.name, email: record.user.email, phone: record.user.phone,
  documentNumber: record.documentNumber, whatsapp: record.whatsapp, isActive: record.isActive,
  commissionType: record.commissionType, commissionRate: Number(record.commissionRate), commissionBase: record.commissionBase,
  permissions: { ...DEFAULT_PERMISSIONS, ...(record.permissions || {}) }, notes: record.notes,
  customerCount: record.user._count?.assignedCustomers || 0,
});

async function profileFor(workspaceOwnerId, collectorId, { activeOnly = false } = {}) {
  const profile = await prisma.collectorProfile.findFirst({
    where: { userId: collectorId, ...(activeOnly ? { isActive: true } : {}), user: { ...workspaceWhere(workspaceOwnerId), role: 'COLLECTOR' } },
    include: { user: { include: { _count: { select: { assignedCustomers: true } } } } },
  });
  if (!profile) throw new HttpError(404, 'COLLECTOR_NOT_FOUND', 'Cobrador não encontrado neste espaço.');
  return profile;
}

function hasPermission(profile, permission) { return profile.isActive && ({ ...DEFAULT_PERMISSIONS, ...(profile.permissions || {}) })[permission] === true; }
async function requireCollectorPermission(workspaceOwnerId, collectorId, permission) {
  const profile = await profileFor(workspaceOwnerId, collectorId, { activeOnly: true });
  if (!hasPermission(profile, permission)) throw new HttpError(403, 'COLLECTOR_PERMISSION_DENIED', 'Este cobrador não possui permissão para esta operação.');
  return profile;
}

async function listCollectors(workspaceOwnerId) {
  const records = await prisma.collectorProfile.findMany({ where: { user: workspaceWhere(workspaceOwnerId) }, include: { user: { include: { _count: { select: { assignedCustomers: true } } } } }, orderBy: { user: { name: 'asc' } } });
  return records.map(publicCollector);
}

async function createCollector(workspaceOwnerId, input) {
  const user = await prisma.user.create({ data: { name: input.name, email: input.email, phone: input.phone || null, password: await bcrypt.hash(input.password, 12), role: 'COLLECTOR', workspaceOwnerId } });
  const profile = await prisma.collectorProfile.create({ data: { userId: user.id, documentNumber: input.documentNumber || null, whatsapp: input.whatsapp || null, isActive: input.isActive, commissionType: input.commissionType, commissionRate: input.commissionRate, commissionBase: input.commissionBase, permissions: input.permissions || DEFAULT_PERMISSIONS, notes: input.notes || null }, include: { user: { include: { _count: { select: { assignedCustomers: true } } } } } });
  return publicCollector(profile);
}

async function updateCollector(workspaceOwnerId, collectorId, input) {
  await profileFor(workspaceOwnerId, collectorId);
  await prisma.$transaction(async (tx) => {
    const userData = Object.fromEntries(Object.entries({ name: input.name, email: input.email, phone: input.phone }).filter(([, value]) => value !== undefined));
    if (Object.keys(userData).length) await tx.user.update({ where: { id: collectorId }, data: userData });
    const profileData = Object.fromEntries(Object.entries({ documentNumber: input.documentNumber, whatsapp: input.whatsapp, isActive: input.isActive, commissionType: input.commissionType, commissionRate: input.commissionRate, commissionBase: input.commissionBase, permissions: input.permissions, notes: input.notes }).filter(([, value]) => value !== undefined));
    if (Object.keys(profileData).length) await tx.collectorProfile.update({ where: { userId: collectorId }, data: profileData });
  });
  return publicCollector(await profileFor(workspaceOwnerId, collectorId));
}

async function assignCustomers(workspaceOwnerId, collectorId, customerIds) {
  await profileFor(workspaceOwnerId, collectorId);
  const count = await prisma.customer.count({ where: { id: { in: customerIds }, userId: workspaceOwnerId } });
  if (count !== customerIds.length) throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Um ou mais clientes não pertencem a este espaço.');
  await prisma.$transaction([
    prisma.customer.updateMany({ where: { userId: workspaceOwnerId, collectorId }, data: { collectorId: null } }),
    ...(customerIds.length ? [prisma.customer.updateMany({ where: { id: { in: customerIds }, userId: workspaceOwnerId }, data: { collectorId } })] : []),
  ]);
  return { collectorId, assignedCustomerCount: customerIds.length };
}

async function essentialCustomers(workspaceOwnerId, collectorId) {
  await requireCollectorPermission(workspaceOwnerId, collectorId, 'viewContactHistory');
  return prisma.customer.findMany({ where: { userId: workspaceOwnerId, collectorId, isActive: true }, select: { id: true, name: true, nickname: true, phone: true, whatsapp: true, status: true, category: true, _count: { select: { debts: true } } }, orderBy: { name: 'asc' } });
}

async function assignedDebts(workspaceOwnerId, collectorId) {
  await requireCollectorPermission(workspaceOwnerId, collectorId, 'viewContactHistory');
  return prisma.debt.findMany({
    where: { userId: workspaceOwnerId, type: 'RECEIVABLE', customer: { collectorId } },
    select: { id: true, description: true, category: true, totalAmount: true, paidAmount: true, dueDate: true, status: true, paymentType: true, customer: { select: { id: true, name: true, nickname: true, phone: true, whatsapp: true } }, installments: { select: { id: true, number: true, amount: true, totalAmount: true, paidAmount: true, dueDate: true, status: true }, orderBy: { dueDate: 'asc' } } },
    orderBy: { dueDate: 'asc' },
  });
}

async function agenda(workspaceOwnerId, collectorId) {
  await requireCollectorPermission(workspaceOwnerId, collectorId, 'viewContactHistory');
  const start = dayStart(); const tomorrow = dayEnd(); const upcomingEnd = new Date(tomorrow); upcomingEnd.setDate(upcomingEnd.getDate() + 7);
  const scope = { debt: { userId: workspaceOwnerId, customer: { collectorId } } };
  const include = { debt: { include: { customer: { select: { id: true, name: true, nickname: true, phone: true, whatsapp: true } } } } };
  const [today, overdue, upcoming, partialPayments, promises, contacts] = await Promise.all([
    prisma.installment.findMany({ where: { ...scope, dueDate: { gte: start, lt: tomorrow }, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } }, include, orderBy: { dueDate: 'asc' } }),
    prisma.installment.findMany({ where: { ...scope, dueDate: { lt: start }, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } }, include, orderBy: { dueDate: 'asc' } }),
    prisma.installment.findMany({ where: { ...scope, dueDate: { gte: tomorrow, lt: upcomingEnd }, status: { in: ['PENDING', 'PARTIAL'] } }, include, orderBy: { dueDate: 'asc' } }),
    prisma.installment.findMany({ where: { ...scope, status: 'PARTIAL' }, include, orderBy: { paidAt: 'desc' } }),
    prisma.collectorContact.findMany({ where: { userId: workspaceOwnerId, collectorId, type: 'PAYMENT_PROMISE', completedAt: null, promisedDate: { gte: start } }, include: { customer: { select: { id: true, name: true, nickname: true } }, debt: { select: { id: true, description: true } }, installment: { select: { id: true, number: true, dueDate: true } } }, orderBy: { promisedDate: 'asc' } }),
    prisma.collectorContact.findMany({ where: { userId: workspaceOwnerId, collectorId }, include: { customer: { select: { id: true, name: true, nickname: true } } }, orderBy: { createdAt: 'desc' }, take: 30 }),
  ]);
  return { today, overdue, upcoming, partialPayments, promises, contacts };
}

async function ensureAssignedCustomer(workspaceOwnerId, collectorId, customerId) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, userId: workspaceOwnerId, collectorId } });
  if (!customer) throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Cliente não está vinculado a este cobrador.');
  return customer;
}

async function addContact(workspaceOwnerId, collectorId, input) {
  await requireCollectorPermission(workspaceOwnerId, collectorId, 'registerContacts');
  await ensureAssignedCustomer(workspaceOwnerId, collectorId, input.customerId);
  if (input.debtId) {
    const debt = await prisma.debt.findFirst({ where: { id: input.debtId, userId: workspaceOwnerId, customerId: input.customerId } });
    if (!debt) throw new HttpError(404, 'DEBT_NOT_FOUND', 'Empréstimo não pertence ao cliente informado.');
  }
  if (input.installmentId) {
    const installment = await prisma.installment.findFirst({ where: { id: input.installmentId, debt: { userId: workspaceOwnerId, customerId: input.customerId, ...(input.debtId ? { id: input.debtId } : {}) } } });
    if (!installment) throw new HttpError(404, 'INSTALLMENT_NOT_FOUND', 'Parcela não pertence ao cliente informado.');
  }
  return prisma.collectorContact.create({ data: { userId: workspaceOwnerId, collectorId, customerId: input.customerId, debtId: input.debtId || null, installmentId: input.installmentId || null, type: input.type, note: input.note || null, promisedDate: input.promisedDate || null, promisedAmount: input.promisedAmount || null } });
}

async function listContacts(workspaceOwnerId, collectorId, customerId) {
  await requireCollectorPermission(workspaceOwnerId, collectorId, 'viewContactHistory');
  if (customerId) await ensureAssignedCustomer(workspaceOwnerId, collectorId, customerId);
  return prisma.collectorContact.findMany({ where: { userId: workspaceOwnerId, collectorId, ...(customerId ? { customerId } : {}) }, include: { customer: { select: { id: true, name: true, nickname: true } }, debt: { select: { id: true, description: true } }, installment: { select: { id: true, number: true } } }, orderBy: { createdAt: 'desc' } });
}

function commissionBaseAmount(base, amounts) { return base === 'PRINCIPAL' ? amounts.principal : base === 'INTEREST' ? amounts.interest : base === 'PENALTY' ? amounts.penalty : amounts.total; }
function calculateCommission({ commissionType, commissionRate, commissionBase, paymentAmount, principal = 0, interest = 0, penalty = 0 }) {
  const baseAmount = round(commissionBaseAmount(commissionBase, { principal: round(principal), interest: round(interest), penalty: round(penalty), total: round(paymentAmount) }));
  return { baseAmount, commissionAmount: commissionType === 'FIXED' ? round(commissionRate) : round(baseAmount * Number(commissionRate) / 100) };
}
async function recordCommission(tx, { workspaceOwnerId, collectorId, customerId, debtId, installmentId = null, paymentAmount, principal = 0, interest = 0, penalty = 0 }) {
  if (!collectorId || !customerId) return null;
  const profile = await tx.collectorProfile.findFirst({ where: { userId: collectorId, isActive: true, user: { ...workspaceWhere(workspaceOwnerId), role: 'COLLECTOR' } } });
  if (!profile) return null;
  const { baseAmount, commissionAmount } = calculateCommission({ commissionType: profile.commissionType, commissionRate: profile.commissionRate, commissionBase: profile.commissionBase, paymentAmount, principal, interest, penalty });
  if (commissionAmount <= 0) return null;
  return tx.collectorCommission.create({ data: { userId: workspaceOwnerId, collectorId, customerId, debtId, installmentId, paymentAmount: round(paymentAmount), baseAmount, commissionAmount, commissionType: profile.commissionType, commissionRate: profile.commissionRate, commissionBase: profile.commissionBase } });
}

async function reverseCommissionsForInstallment(tx, installmentId, reason) { return tx.collectorCommission.updateMany({ where: { installmentId, status: 'ACTIVE' }, data: { status: 'REVERSED', reversedAt: new Date(), reversalReason: String(reason).slice(0, 500) } }); }

async function commissionReport(workspaceOwnerId, collectorId, query = {}) {
  await profileFor(workspaceOwnerId, collectorId);
  const where = { userId: workspaceOwnerId, collectorId, ...(query.customerId ? { customerId: query.customerId } : {}), ...(query.debtId ? { debtId: query.debtId } : {}), ...(query.status ? { status: query.status } : {}), ...(query.paymentStatus ? { installment: { is: { status: query.paymentStatus } } } : {}), ...(query.startDate || query.endDate ? { createdAt: { ...(query.startDate ? { gte: dayStart(query.startDate) } : {}), ...(query.endDate ? { lt: dayEnd(query.endDate) } : {}) } } : {}) };
  const entries = await prisma.collectorCommission.findMany({ where, include: { customer: { select: { id: true, name: true, nickname: true } }, debt: { select: { id: true, description: true } }, installment: { select: { id: true, number: true, dueDate: true, status: true } } }, orderBy: { createdAt: 'desc' } });
  const active = entries.filter((entry) => entry.status === 'ACTIVE');
  return { definition: 'A comissão é calculada no recebimento confirmado conforme a base configurada: principal, juros, multas ou valor total. Estornos marcam os lançamentos de comissão como revertidos.', entries, totals: { paymentAmount: round(active.reduce((sum, entry) => sum + Number(entry.paymentAmount), 0)), baseAmount: round(active.reduce((sum, entry) => sum + Number(entry.baseAmount), 0)), commissionAmount: round(active.reduce((sum, entry) => sum + Number(entry.commissionAmount), 0)), reversedAmount: round(entries.filter((entry) => entry.status === 'REVERSED').reduce((sum, entry) => sum + Number(entry.commissionAmount), 0)) } };
}

module.exports = { DEFAULT_PERMISSIONS, calculateCommission, listCollectors, createCollector, updateCollector, assignCustomers, essentialCustomers, assignedDebts, agenda, addContact, listContacts, requireCollectorPermission, recordCommission, reverseCommissionsForInstallment, commissionReport };
