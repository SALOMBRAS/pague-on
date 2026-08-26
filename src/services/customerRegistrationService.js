const crypto = require('crypto');
const prisma = require('../config/database');
const HttpError = require('../utils/httpError');
const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

async function createInvite(userId, customerId, createdById) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, userId } });
  if (!customer) throw new HttpError(404, 'CUSTOMER_NOT_FOUND', 'Cliente não encontrado.');
  const token = crypto.randomBytes(32).toString('hex');
  const invite = await prisma.customerRegistrationInvite.create({ data: { userId, customerId, tokenHash: hash(token), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), createdById } });
  return { id: invite.id, expiresAt: invite.expiresAt, link: `/customer-registration.html?token=${token}` };
}
async function findToken(token) {
  const invite = await prisma.customerRegistrationInvite.findUnique({ where: { tokenHash: hash(token) }, include: { customer: true } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) throw new HttpError(410, 'REGISTRATION_LINK_INVALID', 'Este link não é mais válido.');
  return invite;
}
async function details(token) { const invite = await findToken(token); return { customer: { name: invite.customer.name, personType: invite.customer.personType }, expiresAt: invite.expiresAt }; }
async function submit(token, input) {
  return prisma.$transaction(async (tx) => {
    const invite = await tx.customerRegistrationInvite.findUnique({ where: { tokenHash: hash(token) } });
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) throw new HttpError(410, 'REGISTRATION_LINK_INVALID', 'Este link não é mais válido.');
    const customer = await tx.customer.update({ where: { id: invite.customerId }, data: { ...input, status: 'PENDING_REVIEW', approvedAt: null, approvedById: null } });
    await tx.customerRegistrationInvite.update({ where: { id: invite.id }, data: { usedAt: new Date(), submittedAt: new Date(), submittedData: input } });
    return customer;
  });
}
module.exports = { createInvite, details, submit };
