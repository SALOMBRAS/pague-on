const customerService = require('../services/customerService');
const { customerCreateSchema, customerUpdateSchema, idSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');
const audit = require('../services/auditService');

function parseId(req) { return idSchema.parse(req.params).id; }

async function list(req, res) {
  const customers = await customerService.listCustomers(req.user.id, req.query);
  return sendSuccess(res, serialize(customers));
}

async function getById(req, res) {
  const customer = await customerService.customerDetail(req.user.id, parseId(req));
  return sendSuccess(res, serialize(customer));
}

async function create(req, res) {
  const customer = await customerService.createCustomer(req.user.id, customerCreateSchema.parse(req.body));
  return sendSuccess(res, serialize(customer), 'Cliente cadastrado com sucesso.', 201);
}

async function update(req, res) {
  const customer = await customerService.updateCustomer(req.user.id, parseId(req), customerUpdateSchema.parse(req.body));
  return sendSuccess(res, serialize(customer), 'Cliente atualizado com sucesso.');
}

async function remove(req, res) {
  const customer = await customerService.updateCustomer(req.user.id, parseId(req), { isActive: false });
  return sendSuccess(res, serialize(customer), 'Cliente arquivado com sucesso.');
}
async function approve(req, res) { const customer = await customerService.approveCustomer(req.user.id, parseId(req), req.actor.id); await audit.record({ eventType: 'customer_approved', req, actor: req.actor, workspaceOwnerId: req.user.id, targetId: customer.id, targetType: 'customer' }); return sendSuccess(res, serialize(customer), 'Cliente aprovado com sucesso.'); }

module.exports = { list, getById, create, update, remove, approve };
