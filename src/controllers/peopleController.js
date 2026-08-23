const customerService = require('../services/customerService');
const peopleService = require('../services/peopleService');
const { customerCreateSchema, customerUpdateSchema, idSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');

const id = (req) => idSchema.parse(req.params).id;
async function list(req, res) { return sendSuccess(res, serialize(await peopleService.listPeople(req.user.id, req.query))); }
async function search(req, res) { return sendSuccess(res, serialize(await peopleService.listPeople(req.user.id, { q: req.query.q || '' }))); }
async function getById(req, res) { return sendSuccess(res, serialize(await peopleService.findPerson(req.user.id, id(req), true))); }
async function sales(req, res) { return sendSuccess(res, serialize(await peopleService.personSales(req.user.id, id(req)))); }
async function create(req, res) { return sendSuccess(res, serialize(await customerService.createCustomer(req.user.id, customerCreateSchema.parse(req.body))), 'Pessoa cadastrada com sucesso.', 201); }
async function update(req, res) { return sendSuccess(res, serialize(await customerService.updateCustomer(req.user.id, id(req), customerUpdateSchema.parse(req.body))), 'Pessoa atualizada com sucesso.'); }
async function remove(req, res) { return sendSuccess(res, serialize(await customerService.updateCustomer(req.user.id, id(req), { isActive: false })), 'Pessoa arquivada com sucesso.'); }
module.exports = { list, search, getById, sales, create, update, remove };
