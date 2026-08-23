const assetService = require('../services/assetService');
const { assetCreateSchema, assetUpdateSchema, idSchema } = require('../utils/validators');
const { sendSuccess } = require('../utils/responseHelper');
const { serialize } = require('../utils/serializers');

const id = (req) => idSchema.parse(req.params).id;
async function list(req, res) { return sendSuccess(res, serialize(await assetService.listAssets(req.user.id))); }
async function create(req, res) { return sendSuccess(res, serialize(await assetService.createAsset(req.user.id, assetCreateSchema.parse(req.body))), 'Ativo cadastrado com sucesso.', 201); }
async function update(req, res) { return sendSuccess(res, serialize(await assetService.updateAsset(req.user.id, id(req), assetUpdateSchema.parse(req.body))), 'Ativo atualizado com sucesso.'); }
async function remove(req, res) { await assetService.removeAsset(req.user.id, id(req)); return sendSuccess(res, null, 'Ativo removido com sucesso.'); }
async function summary(req, res) { return sendSuccess(res, serialize(await assetService.netWorth(req.user.id))); }

module.exports = { list, create, update, remove, summary };
