const customerService = require('../services/customerService');
const peopleService = require('../services/peopleService');
const { customerCreateSchema, customerUpdateSchema, idSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');

const id = (req) => idSchema.parse(req.params).id;
const scope = (req) => ({ role: req.actor?.role || 'ADMIN', actorId: req.actor?.id || req.user.id, customerId: req.actor?.clientProfile?.id || null });
async function list(req, res) { return sendSuccess(res, serialize(await peopleService.listPeople(req.workspaceOwner?.id || req.user.id, req.query, scope(req)))); }
async function search(req, res) { return sendSuccess(res, serialize(await peopleService.listPeople(req.workspaceOwner?.id || req.user.id, { q: req.query.q || '' }, scope(req)))); }
async function getById(req, res) { return sendSuccess(res, serialize(await peopleService.findPerson(req.workspaceOwner?.id || req.user.id, id(req), true, scope(req)))); }
async function sales(req, res) { return sendSuccess(res, serialize(await peopleService.personSales(req.workspaceOwner?.id || req.user.id, id(req), scope(req)))); }
async function create(req, res) { return sendSuccess(res, serialize(await customerService.createCustomer(req.user.id, customerCreateSchema.parse(req.body))), 'Pessoa cadastrada com sucesso.', 201); }
async function update(req, res) { return sendSuccess(res, serialize(await customerService.updateCustomer(req.user.id, id(req), customerUpdateSchema.parse(req.body))), 'Pessoa atualizada com sucesso.'); }
async function remove(req, res) { return sendSuccess(res, serialize(await customerService.updateCustomer(req.user.id, id(req), { isActive: false })), 'Pessoa arquivada com sucesso.'); }
module.exports = { list, search, getById, sales, create, update, remove };
