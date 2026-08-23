const ruleService = require('../services/ruleService');
const { ruleCreateSchema, ruleUpdateSchema, ruleTestSchema, idSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');

const parseId = (req) => idSchema.parse(req.params).id;
async function list(req, res) { return sendSuccess(res, serialize(await ruleService.listRules(req.user.id))); }
async function getById(req, res) { return sendSuccess(res, serialize(await ruleService.findRule(req.user.id, parseId(req)))); }
async function create(req, res) { return sendSuccess(res, serialize(await ruleService.createRule(req.user.id, ruleCreateSchema.parse(req.body))), 'Regra criada com sucesso.', 201); }
async function update(req, res) { return sendSuccess(res, serialize(await ruleService.updateRule(req.user.id, parseId(req), ruleUpdateSchema.parse(req.body))), 'Regra atualizada com sucesso.'); }
async function remove(req, res) { return sendSuccess(res, await ruleService.deleteRule(req.user.id, parseId(req)), 'Regra excluída com sucesso.'); }
async function test(req, res) { const input = ruleTestSchema.parse(req.body); return sendSuccess(res, serialize(await ruleService.previewRule(req.user.id, parseId(req), input.debtId))); }
async function runAll(req, res) { return sendSuccess(res, await ruleService.runAll(req.user.id), 'Regras aplicadas às dívidas compatíveis.'); }
module.exports = { list, getById, create, update, remove, test, runAll };
