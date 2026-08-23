const budgetService = require('../services/budgetService');
const { budgetCreateSchema, budgetUpdateSchema, budgetQuerySchema, idSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');
const id = (req) => idSchema.parse(req.params).id;
async function list(req, res) { return sendSuccess(res, serialize(await budgetService.listBudgets(req.user.id, budgetQuerySchema.parse(req.query)))); }
async function create(req, res) { return sendSuccess(res, serialize(await budgetService.upsertBudget(req.user.id, budgetCreateSchema.parse(req.body))), 'Orçamento salvo com sucesso.', 201); }
async function update(req, res) { return sendSuccess(res, serialize(await budgetService.updateBudget(req.user.id, id(req), budgetUpdateSchema.parse(req.body))), 'Orçamento atualizado com sucesso.'); }
async function remove(req, res) { return sendSuccess(res, await budgetService.removeBudget(req.user.id, id(req)), 'Orçamento removido com sucesso.'); }
module.exports = { list, create, update, remove };
