const service = require('../services/reconciliationService');
const { reconciliationUploadSchema, reconciliationMatchSchema, reconciliationConfirmSchema, idSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');

async function upload(req, res) { const result = await service.importStatement(req.user.id, reconciliationUploadSchema.parse(req.body)); return sendSuccess(res, serialize(result), 'Extrato importado com sucesso.', 201); }
async function match(req, res) { return sendSuccess(res, serialize(await service.matchStatement(req.user.id, reconciliationMatchSchema.parse(req.body).statementId))); }
async function confirm(req, res) { return sendSuccess(res, serialize(await service.confirmDecisions(req.user.id, reconciliationConfirmSchema.parse(req.body))), 'Conciliação atualizada com sucesso.'); }
async function list(req, res) { return sendSuccess(res, serialize(await service.listStatements(req.user.id))); }
async function get(req, res) { return sendSuccess(res, serialize(await service.getStatement(req.user.id, idSchema.parse(req.params).id))); }
module.exports = { upload, match, confirm, list, get };
